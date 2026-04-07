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
import { getChatClient, getClientForChainEntry, getWorkerClient } from '../llm-client.js';
import { metrics } from '../metrics.js';
import {
  estimateTokenCount,
  getContextLimit,
  getDailyUsage,
  supportsToolChoice,
  trackUsage,
} from '../model-router.js';
import { type ChainEntry, getDefaultChain, getProvider } from '../providers.js';
import { executeToolCall } from '../tool-executor.js';
import type { HandlerContext, Middleware } from './types.js';

const logger = createLogger('middleware:llm');

/**
 * Return the right OpenAI client for a chain entry.
 * Falls back to legacy getClientForModel() if no chain entry provided.
 */
function getClientForModel(model: string, tenantApiKey?: string): OpenAI {
  if (!model.includes('/') && process.env.OLLAMA_BASE_URL) {
    return getWorkerClient();
  }
  if (tenantApiKey && tenantApiKey !== process.env.OPENROUTER_API_KEY) {
    return new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: tenantApiKey,
      defaultHeaders: { 'HTTP-Referer': 'https://github.com/hawk-os', 'X-Title': 'Hawk OS' },
    });
  }
  return getChatClient();
}

const MAX_TOOL_ROUNDS = 5;

// ── Per-provider in-flight counters ─────────────────────────────────────────
// Used to skip providers at capacity and route to next in chain immediately.
const providerInflight = new Map<string, number>();
const MAX_LOCAL_CONCURRENT = 2; // Ollama CPU can handle 2 parallel (OLLAMA_NUM_PARALLEL)
const MAX_REMOTE_CONCURRENT = 10; // Remote APIs handle much more

function getInflight(providerId: string): number {
  return providerInflight.get(providerId) ?? 0;
}

function incInflight(providerId: string): void {
  providerInflight.set(providerId, getInflight(providerId) + 1);
}

function decInflight(providerId: string): void {
  const val = getInflight(providerId);
  if (val > 0) providerInflight.set(providerId, val - 1);
}

function isProviderAtCapacity(providerId: string): boolean {
  const provider = getProvider(providerId);
  const max = provider?.isLocal ? MAX_LOCAL_CONCURRENT : MAX_REMOTE_CONCURRENT;
  return getInflight(providerId) >= max;
}

/**
 * Build the ordered list of (model, client, providerId) to try for this request.
 * Uses tenant's custom chain if configured, otherwise the global default.
 */
function buildModelsToTry(
  ctx: HandlerContext,
  complexity: string,
  _hasTools: boolean,
): { model: string; client: OpenAI; providerId: string }[] {
  const chain: ChainEntry[] = ctx.tenantLLMChain ?? getDefaultChain();
  const tenantKeys = ctx.tenantProviderKeys;
  const result: { model: string; client: OpenAI; providerId: string }[] = [];

  for (const entry of chain) {
    if (!entry.enabled) continue;
    if (entry.tier !== 'all' && entry.tier !== complexity) continue;
    if (isProviderAtCapacity(entry.providerId)) {
      logger.warn(
        { provider: entry.providerId, inflight: getInflight(entry.providerId) },
        'Provider at capacity — skipping',
      );
      continue;
    }

    // Resolve client (needs API key)
    const client = getClientForChainEntry(entry, tenantKeys);
    if (!client) continue; // No API key available for this provider

    result.push({ model: entry.modelId, client, providerId: entry.providerId });
  }

  // If tenant chain produced nothing usable (no keys, all at capacity), fall back to legacy
  if (result.length === 0) {
    const legacyClient = getClientForModel(ctx.selectedModel, ctx.tenantApiKey);
    result.push({
      model: ctx.selectedModel,
      client: legacyClient,
      providerId: ctx.selectedModel.includes('/') ? 'openrouter' : 'ollama',
    });
  }

  return result;
}

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

    // Build provider chain — uses tenant config or global default
    const complexity = ctx.complexity ?? 'moderate';
    const candidates = buildModelsToTry(ctx, complexity, hasTools);

    // LLM call with fallback through the chain
    async function callLLM(msgs: OpenAI.ChatCompletionMessageParam[], stream: boolean) {
      for (let i = 0; i < candidates.length; i++) {
        const { model, client, providerId } = candidates[i]!;
        const llmStart = performance.now();
        try {
          const res = await callLLMOnce(msgs, stream, model, hasTools, ctx, client, providerId);
          metrics.observeHistogram(
            'hawk_llm_latency_seconds',
            (performance.now() - llmStart) / 1000,
            { model, provider: providerId, tier: i === 0 ? 'primary' : 'fallback' },
          );
          metrics.incCounter('hawk_llm_calls_total', {
            model,
            provider: providerId,
            tier: i === 0 ? 'primary' : 'fallback',
            status: 'success',
          });
          return res;
        } catch (err) {
          metrics.incCounter('hawk_llm_calls_total', {
            model,
            provider: providerId,
            tier: i === 0 ? 'primary' : 'fallback',
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
            logger.warn({ model, provider: providerId, reason }, 'Model failed, trying fallback');
            if (i < candidates.length - 1) {
              const next = candidates[i + 1]!;
              metrics.incCounter('hawk_fallbacks_total', {
                from_model: model,
                to_model: next.model,
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
  client?: OpenAI,
  providerId?: string,
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

  const resolvedClient = client ?? getClientForModel(model, ctx.tenantApiKey);
  const resolvedProvider = providerId ?? (model.includes('/') ? 'openrouter' : 'ollama');
  const isLocal = getProvider(resolvedProvider)?.isLocal ?? false;

  const useToolChoice = hasTools && supportsToolChoice(model);
  const opts: Record<string, unknown> = {
    model,
    max_tokens: ctx.agent.maxTokens,
    messages: msgs,
    tools: hasTools ? ctx.filteredTools : undefined,
    tool_choice: useToolChoice ? 'auto' : undefined,
    ...(isLocal ? { think: false } : {}),
  };

  const LLM_TIMEOUT_MS = 90_000;

  incInflight(resolvedProvider);
  try {
    if (stream && ctx.onChunk) {
      const streamResponse = await resolvedClient.chat.completions.create(
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
              const existing = toolCalls[tc.index];
              if (existing) {
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name = tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
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

    const response = await resolvedClient.chat.completions.create(opts as never, {
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    const choice = response.choices[0];
    return {
      content: choice?.message.content ?? null,
      toolCalls: choice?.message.tool_calls ?? [],
      finishReason: choice?.finish_reason ?? null,
      usage: response.usage as { total_tokens?: number } | undefined,
    };
  } finally {
    decInflight(resolvedProvider);
  }
}
