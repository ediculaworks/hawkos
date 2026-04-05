/**
 * Session cost tracking — accumulates token usage across LLM calls.
 * Logs final cost to activity_log when session completes.
 */
import { metrics } from './metrics.js';

export interface SessionCost {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCalls: number;
  toolCalls: number;
  model: string;
}

export function createSessionCost(model: string): SessionCost {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    llmCalls: 0,
    toolCalls: 0,
    model,
  };
}

// Approximate cost per 1M tokens for OpenRouter paid models
const COST_PER_1M = 3.0; // USD (conservative estimate)

/**
 * Estimate cost in USD for token usage.
 * Free models (ending in :free) are $0.
 */
export function estimateCostUsd(tokens: number, model?: string): number {
  if (model && (model.endsWith(':free') || model === 'openrouter/free')) return 0;
  return (tokens / 1_000_000) * COST_PER_1M;
}

export function trackLLMCall(
  cost: SessionCost,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
): void {
  cost.llmCalls++;
  if (usage) {
    cost.promptTokens += usage.prompt_tokens ?? 0;
    cost.completionTokens += usage.completion_tokens ?? 0;
    cost.totalTokens += usage.total_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? 0;
    if (totalTokens > 0) {
      const costUsd = estimateCostUsd(totalTokens, cost.model);
      metrics.incGauge('hawk_daily_tokens_used', totalTokens);
      metrics.incGauge('hawk_daily_cost_usd', costUsd);
    }
  }
}

export function trackToolCall(cost: SessionCost, count = 1): void {
  cost.toolCalls += count;
}

// ── Per-Task Auxiliary Model Tracking ────────────────────────────────────────
// Tracks token usage for background worker LLM calls (compression, memory
// extraction, deduplication) separately from primary model usage.
// Inspired by Hermes Agent's per-task auxiliary model pattern.

export type WorkerTask =
  | 'compression'
  | 'memory_extraction'
  | 'memory_layers'
  | 'dedup_decision'
  | 'title_generation'
  | 'insight_synthesis'
  | 'gap_scan';

interface WorkerUsage {
  tokens: number;
  calls: number;
  lastCallAt: number;
}

const _workerUsage = new Map<WorkerTask, WorkerUsage>();

/**
 * Track a worker LLM call for a specific background task.
 */
export function trackWorkerCall(task: WorkerTask, tokens: number): void {
  const existing = _workerUsage.get(task) ?? { tokens: 0, calls: 0, lastCallAt: 0 };
  existing.tokens += tokens;
  existing.calls++;
  existing.lastCallAt = Date.now();
  _workerUsage.set(task, existing);
}

/**
 * Get usage summary for all worker tasks.
 */
export function getWorkerUsageSummary(): Record<WorkerTask, WorkerUsage> {
  const result = {} as Record<WorkerTask, WorkerUsage>;
  for (const [task, usage] of _workerUsage) {
    result[task] = { ...usage };
  }
  return result;
}

/**
 * Get total worker tokens used today.
 */
export function getTotalWorkerTokens(): number {
  let total = 0;
  for (const usage of _workerUsage.values()) {
    total += usage.tokens;
  }
  return total;
}

/**
 * Reset daily worker usage (called at midnight or startup).
 */
export function resetWorkerUsage(): void {
  _workerUsage.clear();
}
