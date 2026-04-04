import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  classifyComplexity,
  estimateTokenCount,
  getContextLimit,
  getDailyUsage,
  selectModel,
  supportsToolChoice,
  trackUsage,
} from '../model-router';

describe('Model Router', () => {
  describe('classifyComplexity', () => {
    it('should classify greetings as simple', () => {
      expect(classifyComplexity('bom dia!', 0)).toBe('simple');
      expect(classifyComplexity('obrigado!', 0)).toBe('simple');
      expect(classifyComplexity('ok', 0)).toBe('simple');
      expect(classifyComplexity('valeu', 0)).toBe('simple');
      expect(classifyComplexity('tchau', 0)).toBe('simple');
    });

    it('should classify single-module queries appropriately', () => {
      expect(classifyComplexity('quanto gastei esse mês?', 1)).toBe('moderate');
      // Short CRUD operations on single module → simple (cost-aware routing)
      expect(classifyComplexity('registra meu treino de hoje', 1)).toBe('simple');
      expect(classifyComplexity('lista meus hábitos', 1)).toBe('simple');
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
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
      savedEnv.MODEL_TIER_SIMPLE = process.env.MODEL_TIER_SIMPLE;
      savedEnv.MODEL_TIER_COMPLEX = process.env.MODEL_TIER_COMPLEX;
      savedEnv.MODEL_DAILY_BUDGET_USD = process.env.MODEL_DAILY_BUDGET_USD;
    });

    afterEach(() => {
      for (const [key, val] of Object.entries(savedEnv)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    });

    it('should return agent model when no tier env vars set', () => {
      delete process.env.MODEL_TIER_SIMPLE;
      delete process.env.MODEL_TIER_COMPLEX;
      expect(selectModel('simple', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('moderate', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('complex', 'openrouter/auto')).toBe('openrouter/auto');
    });

    it('should use MODEL_TIER_SIMPLE when set', () => {
      process.env.MODEL_TIER_SIMPLE = 'fast-model';
      expect(selectModel('simple', 'openrouter/auto')).toBe('fast-model');
    });

    it('should use MODEL_TIER_COMPLEX when set', () => {
      process.env.MODEL_TIER_COMPLEX = 'powerful-model';
      expect(selectModel('complex', 'openrouter/auto')).toBe('powerful-model');
    });
  });
});

describe('Model capabilities', () => {
  describe('getContextLimit', () => {
    it('should return known limits for registered models', () => {
      expect(getContextLimit('qwen/qwen3.6-plus:free')).toBe(1_000_000);
      expect(getContextLimit('meta-llama/llama-3.3-70b-instruct:free')).toBe(65_536);
      expect(getContextLimit('nvidia/nemotron-3-super-120b-a12b:free')).toBe(262_144);
    });

    it('should return conservative 65K default for unknown models', () => {
      expect(getContextLimit('unknown/model')).toBe(65_536);
      expect(getContextLimit('openrouter/auto')).toBe(65_536);
    });
  });

  describe('supportsToolChoice', () => {
    it('should return true for models with tool_choice support', () => {
      expect(supportsToolChoice('qwen/qwen3.6-plus:free')).toBe(true);
      expect(supportsToolChoice('meta-llama/llama-3.3-70b-instruct:free')).toBe(true);
      expect(supportsToolChoice('openrouter/auto')).toBe(true);
    });

    it('should return false for models without tool_choice', () => {
      expect(supportsToolChoice('stepfun/step-3.5-flash:free')).toBe(false);
      expect(supportsToolChoice('minimax/minimax-m2.5:free')).toBe(false);
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate ~4 chars/token for standard models', () => {
      const text = 'a'.repeat(400);
      expect(estimateTokenCount(text, 'meta-llama/llama-3.3-70b-instruct:free')).toBe(100);
    });

    it('should estimate ~3 chars/token for multilingual models (Qwen, GLM)', () => {
      const text = 'a'.repeat(300);
      expect(estimateTokenCount(text, 'qwen/qwen3.6-plus:free')).toBe(100);
      expect(estimateTokenCount(text, 'z-ai/glm-4.5-air:free')).toBe(100);
    });

    it('should default to 4 chars/token when no model specified', () => {
      const text = 'a'.repeat(400);
      expect(estimateTokenCount(text)).toBe(100);
    });

    it('should handle empty strings', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('', 'qwen/qwen3.6-plus:free')).toBe(0);
    });
  });
});

describe('Daily budget tracking', () => {
  const savedBudget = process.env.MODEL_DAILY_BUDGET_USD;

  afterEach(() => {
    if (savedBudget === undefined) process.env.MODEL_DAILY_BUDGET_USD = undefined;
    else process.env.MODEL_DAILY_BUDGET_USD = savedBudget;
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
    const usageBefore = getDailyUsage();
    process.env.MODEL_DAILY_BUDGET_USD = String(usageBefore.cost + 0.001);
    trackUsage(0, 0.002);
    const result = trackUsage(0, 0);
    expect(result.overBudget).toBe(true);
  });
});
