/**
 * LLM middleware — handles the LLM call with fallback chain + tool execution loop.
 */

import { HawkError, createLogger } from '@hawk/shared';
import OpenAI from 'openai';
import {
  createSessionCost,
  estimateCostUsd,
  trackLLMCall,
  trackToolCall,
} from '../cost-tracker.js';
import { getChatClient, getWorkerClient } from '../llm-client.js';
import {
  estimateTokenCount,
  getContextLimit,
  getDailyUsage,
  supportsToolChoice,
  trackUsage,
} from '../model-router.js';
import { executeToolCall } from '../tool-executor.js';
import type { HandlerContext, Middleware } from './types.js';

const logger = createLogger('middleware:llm');

/**
 * Return the right OpenAI client for the given model.
 * Ollama models have no '/' (e.g. 'qwen2.5:3b').
 * OpenRouter models always have '/' (e.g. 'qwen/qwen3.6-plus:free').
 * When a per-tenant API key is provided, it takes precedence over the global key.
 */
function getClientForModel(model: string, tenantApiKey?: string): OpenAI {
  if (!model.includes('/') && process.env.OLLAMA_BASE_URL) {
    return getWorkerClient(); // points to local Ollama
  }
  if (tenantApiKey && tenantApiKey !== process.env.OPENROUTER_API_KEY) {
    return new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: tenantApiKey,
      defaultHeaders: { 'HTTP-Referer': 'https://github.com/hawk-os', 'X-Title': 'Hawk OS' },
    });
  }
  return getChatClient(); // points to OpenRouter (global key)
}

const FALLBACK_MODELS_WITH_TOOL_CHOICE = [
  'qwen/qwen3.6-plus:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];
const FALLBACK_MODELS_NO_TOOL_CHOICE = ['stepfun/step-3.5-flash:free', 'openrouter/free'];

const MAX_TOOL_ROUNDS = 5;

export const llmMiddleware: Middleware = {
  name: 'llm',
  execute: async (ctx: HandlerContext, next) => {
    const hasTools = ctx.filteredTools.length > 0;

    // Initialize cost tracking
    ctx.sessionCost = ctx.agent.costTrackingEnabled ? createSessionCost(ctx.agent.model) : null;

    // Check daily budget
    const { overBudget } = trackUsage(0, 0);
    if (overBudget) {
      const usage = getDailyUsage();
      ctx.response = `[Hawk OS] Limite diário de custo atingido ($${usage.cost.toFixed(2)}). Tente novamente amanhã.`;
      await next();
      return;
    }

    // Build fallback model list
    const fallbacks = hasTools
      ? FALLBACK_MODELS_WITH_TOOL_CHOICE
      : [...FALLBACK_MODELS_WITH_TOOL_CHOICE, ...FALLBACK_MODELS_NO_TOOL_CHOICE];
    const modelsToTry = [ctx.selectedModel, ...fallbacks.filter((m) => m !== ctx.selectedModel)];

    // LLM call with fallback
    async function callLLM(msgs: OpenAI.ChatCompletionMessageParam[], stream: boolean) {
      for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i]!;
        try {
          return await callLLMOnce(msgs, stream, model, hasTools, ctx);
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 429 || status === 403) {
            console.warn(`[middleware:llm] Model ${model} returned ${status}, trying fallback...`);
            if (i < modelsToTry.length - 1) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
          }
          throw err;
        }
      }
      throw new HawkError('All models exhausted', 'LLM_CALL_FAILED');
    }

    // First LLM call
    let result = await callLLM(ctx.messages, !!ctx.onChunk);
    if (ctx.sessionCost) trackLLMCall(ctx.sessionCost, result.usage);
    if (result.usage?.total_tokens) {
      trackUsage(
        result.usage.total_tokens,
        estimateCostUsd(result.usage.total_tokens, ctx.selectedModel),
      );
      ctx.totalTokens += result.usage.total_tokens;
    }

    // Tool execution loop — accumulate tool history to avoid duplicating ctx.messages
    let toolRound = 0;
    const toolHistory: OpenAI.ChatCompletionMessageParam[] = [];

    while (
      result.finishReason === 'tool_calls' &&
      result.toolCalls.length > 0 &&
      toolRound < MAX_TOOL_ROUNDS
    ) {
      toolRound++;

      // Append assistant tool_calls to history
      toolHistory.push({
        role: 'assistant',
        content: result.content,
        tool_calls: result.toolCalls,
      });

      for (const tc of result.toolCalls) {
        ctx.toolsUsed.push(tc.function.name);
      }

      // Execute tool calls in parallel
      const toolResults = await Promise.allSettled(
        result.toolCalls.map((tc) => executeToolCall(tc, ctx.toolMap, ctx.sessionId)),
      );
      for (let i = 0; i < result.toolCalls.length; i++) {
        const tc = result.toolCalls[i];
        if (!tc) continue;
        const settled = toolResults[i];
        const toolResult =
          settled?.status === 'fulfilled'
            ? (settled.value ?? `Tool "${tc.function.name}" returned empty result`)
            : `Erro ao executar ${tc.function.name}: ${settled?.status === 'rejected' ? settled.reason : 'unknown'}`;
        toolHistory.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
      }

      if (ctx.sessionCost) trackToolCall(ctx.sessionCost, result.toolCalls.length);

      // ReAct reflect step
      if (ctx.isComplexQuery && result.toolCalls.length > 1) {
        toolHistory.push({
          role: 'system',
          content:
            'Reflect briefly on the tool results above. Did they provide what you needed? If something is missing, explain what and use additional tools. Otherwise, synthesize a complete answer.',
        });
      }

      // Build full message array: original messages + accumulated tool history
      result = await callLLM([...ctx.messages, ...toolHistory], !!ctx.onChunk);
      if (ctx.sessionCost) trackLLMCall(ctx.sessionCost, result.usage);
      if (result.usage?.total_tokens) {
        trackUsage(
          result.usage.total_tokens,
          estimateCostUsd(result.usage.total_tokens, ctx.selectedModel),
        );
        ctx.totalTokens += result.usage.total_tokens;
      }
    }

    if (toolRound >= MAX_TOOL_ROUNDS) {
      logger.warn(
        { sessionId: ctx.sessionId, toolRound, tools: ctx.toolsUsed },
        'Hit max tool rounds limit',
      );
    }

    if (!result.content) {
      const errorMsg = `Empty response from AI (${ctx.agent.name}/${ctx.agent.model}): finish_reason=${result.finishReason}`;
      logger.error(
        { agent: ctx.agent.name, model: ctx.agent.model, finishReason: result.finishReason },
        'Empty LLM response',
      );
      throw new HawkError(errorMsg, 'LLM_CALL_FAILED');
    }

    ctx.response = result.content;

    await next();
  },
};

// ── Internal LLM call ───────────────────────────────────────────

async function callLLMOnce(
  msgs: OpenAI.ChatCompletionMessageParam[],
  stream: boolean,
  model: string,
  hasTools: boolean,
  ctx: HandlerContext,
): Promise<{
  content: string | null;
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  finishReason: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}> {
  const contextLimit = getContextLimit(model);
  const msgTokens = msgs.reduce((sum, m) => {
    const content = (m as { content?: unknown }).content;
    let text: string;
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = (content as { type: string; text?: string }[])
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text!)
        .join(' ');
    } else {
      text = '';
    }
    return sum + estimateTokenCount(text, model);
  }, 0);
  if (msgTokens > contextLimit * 0.9) {
    logger.warn(
      { model, estimatedTokens: msgTokens, contextLimit },
      'Message tokens exceed 90% of model context window',
    );
  }

  const useToolChoice = hasTools && supportsToolChoice(model);
  const isOllamaModel = !model.includes('/') && !!process.env.OLLAMA_BASE_URL;
  const opts: Record<string, unknown> = {
    model,
    max_tokens: ctx.agent.maxTokens,
    messages: msgs,
    tools: hasTools ? ctx.filteredTools : undefined,
    tool_choice: useToolChoice ? 'auto' : undefined,
    // Disable qwen3 extended thinking mode — it causes 90s+ latency in chat
    ...(isOllamaModel ? { think: false } : {}),
  };

  // Ollama local inference is typically much faster than remote APIs
  const LLM_TIMEOUT_MS = isOllamaModel ? 30_000 : 90_000;

  if (stream && ctx.onChunk) {
    const streamResponse = await getClientForModel(model, ctx.tenantApiKey).chat.completions.create(
      { ...opts, stream: true } as never,
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
    );
    let content = '';
    const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    let finishReason: string | null = null;

    for await (const chunk of streamResponse as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        ctx.onChunk(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = {
                id: tc.id ?? '',
                type: 'function',
                function: { name: tc.function?.name ?? '', arguments: '' },
              };
            }
            const entry = toolCalls[tc.index];
            if (entry) {
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.function.name = tc.function.name;
              if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
            }
          }
        }
      }
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }
    }

    return { content: content || null, toolCalls: toolCalls.filter(Boolean), finishReason };
  }

  const response = await getClientForModel(model, ctx.tenantApiKey).chat.completions.create(opts as never, {
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  const choice = response.choices[0];
  return {
    content: choice?.message.content ?? null,
    toolCalls: choice?.message.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? null,
    usage: response.usage as { total_tokens?: number } | undefined,
  };
}
