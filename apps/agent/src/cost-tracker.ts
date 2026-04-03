/**
 * Session cost tracking — accumulates token usage across LLM calls.
 * Logs final cost to activity_log when session completes.
 */

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
  }
}

export function trackToolCall(cost: SessionCost, count = 1): void {
  cost.toolCalls += count;
}
