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
import { metrics } from '../metrics.js';
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

// Fallback chain: Ollama local first (free), then OpenRouter free models.
// Nemotron/Llama before Qwen — Alibaba rate limits are more aggressive on free tier.
const FALLBACK_MODELS_WITH_TOOL_CHOICE = [
  ...(process.env.OLLAMA_BASE_URL ? ['gemma4:e2b'] : []),
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3.6-plus:free',
];
const FALLBACK_MODELS_NO_TOOL_CHOICE = ['stepfun/step-3.5-flash:free', 'openrouter/free'];

const MAX_TOOL_ROUNDS = 5;

// In-flight counter for Ollama — used to skip Ollama when at capacity and route
// directly to OpenRouter instead of waiting + timing out.
let ollamaInflight = 0;
const MAX_OLLAMA_CONCURRENT = 2; // align with OLLAMA_NUM_PARALLEL in docker-compose

export const llmMiddleware: Middleware = {
  name: 'llm',
  execute: async (ctx: HandlerContext, next) => {
    // ── S2.1 — Skip LLM if intent was short-circuited ──────────────────────
    if (ctx.shortCircuited && ctx.response !== null) {
      ctx.sessionCost = null;
      await next();
      return;
    }

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

    // Build fallback model list — skip Ollama if already at capacity
    const fallbacks = hasTools
      ? FALLBACK_MODELS_WITH_TOOL_CHOICE
      : [...FALLBACK_MODELS_WITH_TOOL_CHOICE, ...FALLBACK_MODELS_NO_TOOL_CHOICE];
    const allModels = [ctx.selectedModel, ...fallbacks.filter((m) => m !== ctx.selectedModel)];
    const ollamaAtCapacity = ollamaInflight >= MAX_OLLAMA_CONCURRENT;
    const modelsToTry = ollamaAtCapacity
      ? allModels.filter((m) => m.includes('/')) // skip local Ollama models (no '/')
      : allModels;
    if (ollamaAtCapacity) {
      logger.warn(
        { inflightCount: ollamaInflight, max: MAX_OLLAMA_CONCURRENT },
        'Ollama at capacity — routing directly to OpenRouter',
      );
    }

    // LLM call with fallback
    async function callLLM(msgs: OpenAI.ChatCompletionMessageParam[], stream: boolean) {
      for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i]!;
        const llmStart = performance.now();
        try {
          const res = await callLLMOnce(msgs, stream, model, hasTools, ctx);
          metrics.observeHistogram(
            'hawk_llm_latency_seconds',
            (performance.now() - llmStart) / 1000,
            { model, tier: ctx.selectedModel === model ? 'primary' : 'fallback' },
          );
          metrics.incCounter('hawk_llm_calls_total', {
            model,
            tier: ctx.selectedModel === model ? 'primary' : 'fallback',
            status: 'success',
          });
          return res;
        } catch (err) {
          metrics.incCounter('hawk_llm_calls_total', {
            model,
            tier: ctx.selectedModel === model ? 'primary' : 'fallback',
            status: 'error',
          });
          const status = (err as { status?: number }).status;
          const isRetriable =
            status === 429 ||
            status === 403 ||
            (err instanceof Error &&
              (err.name === 'TimeoutError' ||
                err.name === 'AbortError' ||
                err.message.toLowerCase().includes('aborted') ||
                err.message.toLowerCase().includes('timed out') ||
                err.message.toLowerCase().includes('econnreset')));
          if (isRetriable) {
            const reason = status ?? (err instanceof Error ? err.message : 'unknown');
            console.warn(`[middleware:llm] Model ${model} failed (${reason}), trying fallback...`);
            if (i < modelsToTry.length - 1) {
              const nextModel = modelsToTry[i + 1]!;
              metrics.incCounter('hawk_fallbacks_total', {
                from_model: model,
                to_model: nextModel,
              });
              await new Promise((r) => setTimeout(r, 1000));
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

  const LLM_TIMEOUT_MS = 90_000;

  if (isOllamaModel) ollamaInflight++;
  try {
    if (stream && ctx.onChunk) {
      const streamResponse = await getClientForModel(
        model,
        ctx.tenantApiKey,
      ).chat.completions.create({ ...opts, stream: true } as never, {
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
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

    const response = await getClientForModel(model, ctx.tenantApiKey).chat.completions.create(
      opts as never,
      { signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
    );
    const choice = response.choices[0];
    return {
      content: choice?.message.content ?? null,
      toolCalls: choice?.message.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      usage: response.usage as { total_tokens?: number } | undefined,
    };
  } finally {
    if (isOllamaModel) ollamaInflight--;
  }
}
