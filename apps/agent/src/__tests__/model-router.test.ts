import { describe, expect, it } from 'vitest';
import { classifyComplexity, selectModel } from '../model-router';

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
      const longQuestion = 'a'.repeat(301) + '?';
      expect(classifyComplexity(longQuestion, 1)).toBe('complex');
    });
  });

  describe('selectModel', () => {
    it('should return agent model when no tier env vars set', () => {
      expect(selectModel('simple', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('moderate', 'openrouter/auto')).toBe('openrouter/auto');
      expect(selectModel('complex', 'openrouter/auto')).toBe('openrouter/auto');
    });
  });
});
