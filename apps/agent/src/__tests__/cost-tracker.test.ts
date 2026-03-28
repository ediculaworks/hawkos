import { describe, expect, it } from 'vitest';
import { createSessionCost, trackLLMCall, trackToolCall } from '../cost-tracker';

describe('Cost Tracker', () => {
  it('should initialize with zero values', () => {
    const cost = createSessionCost('openrouter/auto');
    expect(cost.totalTokens).toBe(0);
    expect(cost.llmCalls).toBe(0);
    expect(cost.toolCalls).toBe(0);
    expect(cost.model).toBe('openrouter/auto');
  });

  it('should accumulate LLM call tokens', () => {
    const cost = createSessionCost('test-model');
    trackLLMCall(cost, { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 });
    expect(cost.promptTokens).toBe(100);
    expect(cost.completionTokens).toBe(50);
    expect(cost.totalTokens).toBe(150);
    expect(cost.llmCalls).toBe(1);
  });

  it('should accumulate multiple LLM calls', () => {
    const cost = createSessionCost('test-model');
    trackLLMCall(cost, { total_tokens: 100 });
    trackLLMCall(cost, { total_tokens: 200 });
    trackLLMCall(cost, { total_tokens: 50 });
    expect(cost.totalTokens).toBe(350);
    expect(cost.llmCalls).toBe(3);
  });

  it('should handle undefined usage gracefully', () => {
    const cost = createSessionCost('test-model');
    trackLLMCall(cost, undefined);
    expect(cost.totalTokens).toBe(0);
    expect(cost.llmCalls).toBe(1);
  });

  it('should track tool calls', () => {
    const cost = createSessionCost('test-model');
    trackToolCall(cost, 3);
    trackToolCall(cost, 2);
    expect(cost.toolCalls).toBe(5);
  });

  it('should default tool count to 1', () => {
    const cost = createSessionCost('test-model');
    trackToolCall(cost);
    expect(cost.toolCalls).toBe(1);
  });
});
