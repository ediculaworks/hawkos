import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyComplexity, getDailyUsage, selectModel, trackUsage } from '../model-router';

describe('Model Router', () => {
  describe('classifyComplexity', () => {
    it('should classify greetings as simple', () => {
      // Debug: test with strings ending in space/punctuation
      expect(classifyComplexity('bom dia!', 0)).toBe('simple');
      expect(classifyComplexity('obrigado!', 0)).toBe('simple');
      expect(classifyComplexity('ok', 0)).toBe('simple');
      expect(classifyComplexity('valeu', 0)).toBe('simple');
      expect(classifyComplexity('tchau', 0)).toBe('simple');
    });

    it('should classify single-module queries as moderate', () => {
      expect(classifyComplexity('quanto gastei esse mês?', 1)).toBe('moderate');
      expect(classifyComplexity('registra meu treino de hoje', 1)).toBe('moderate');
      expect(classifyComplexity('lista meus hábitos', 1)).toBe('moderate');
    });

    it('should classify multi-module queries as complex', () => {
      expect(classifyComplexity('analisa meus gastos', 1)).toBe('complex');
      expect(classifyComplexity('compara meu progresso nos objetivos', 2)).toBe('complex');
      expect(classifyComplexity('planeja minha semana', 1)).toBe('complex');
    });

    it('should classify 3+ modules as complex regardless of content', () => {
      expect(classifyComplexity('sim', 3)).toBe('complex');
      expect(classifyComplexity('mostra tudo', 4)).toBe('complex');
    });

    it('should classify long questions as complex', () => {
      const longQuestion = `${'a'.repeat(301)}?`;
      expect(classifyComplexity(longQuestion, 1)).toBe('complex');
    });
  });

  describe('selectModel', () => {
    it('should return agent model when no tier env vars set', () => {
      expect(selectModel('simple', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('moderate', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('complex', 'openrouter/auto')).toBe('openrouter/auto');
    });

    it('should use MODEL_TIER_SIMPLE when set', () => {
      vi.stubEnv('MODEL_TIER_SIMPLE', 'fast-model');
      expect(selectModel('simple', 'openrouter/auto')).toBe('fast-model');
      vi.unstubAllEnvs();
    });

    it('should use MODEL_TIER_COMPLEX when set', () => {
      vi.stubEnv('MODEL_TIER_COMPLEX', 'powerful-model');
      expect(selectModel('complex', 'openrouter/auto')).toBe('powerful-model');
      vi.unstubAllEnvs();
    });
  });
});

describe('Daily budget tracking', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getDailyUsage returns an object with tokens and cost', () => {
    const usage = getDailyUsage();
    expect(usage).toHaveProperty('tokens');
    expect(usage).toHaveProperty('cost');
    expect(typeof usage.tokens).toBe('number');
    expect(typeof usage.cost).toBe('number');
  });

  it('trackUsage returns overBudget=false when no budget limit is set', () => {
    process.env.MODEL_DAILY_BUDGET_USD = '';
    const result = trackUsage(0, 0);
    expect(result.overBudget).toBe(false);
  });

  it('trackUsage accumulates usage and detects limit exceeded', () => {
    // Set a very high limit so we can test with a fresh add
    const usageBefore = getDailyUsage();
    vi.stubEnv('MODEL_DAILY_BUDGET_USD', String(usageBefore.cost + 0.001)); // limit = current + tiny
    trackUsage(0, 0.002); // push over limit
    const result = trackUsage(0, 0);
    expect(result.overBudget).toBe(true);
  });
});
