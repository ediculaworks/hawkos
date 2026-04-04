import { describe, expect, it, vi } from 'vitest';
import {
  executePattern,
  getPattern,
  listPatterns,
  registerPattern,
  renderPattern,
} from '../prompts/index.js';
import type { PatternDefinition } from '../prompts/index.js';

describe('Prompt Pattern Library', () => {
  describe('built-in patterns', () => {
    it('has at least 12 built-in patterns registered', () => {
      const all = listPatterns();
      expect(all.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('getPattern', () => {
    it('returns correct pattern by ID', () => {
      const pattern = getPattern('finances/analyze-spending');
      expect(pattern).toBeDefined();
      expect(pattern!.id).toBe('finances/analyze-spending');
      expect(pattern!.module).toBe('finances');
    });

    it('returns undefined for unknown ID', () => {
      expect(getPattern('nonexistent/pattern')).toBeUndefined();
    });
  });

  describe('listPatterns', () => {
    it('returns all patterns when no module specified', () => {
      const all = listPatterns();
      expect(all.length).toBeGreaterThanOrEqual(12);
    });

    it('filters by module and includes universal patterns', () => {
      const financePatterns = listPatterns('finances');
      const universalCount = listPatterns().filter((p) => p.module === 'universal').length;

      expect(financePatterns.length).toBeGreaterThan(0);
      // Every result is either finances or universal
      for (const p of financePatterns) {
        expect(['finances', 'universal']).toContain(p.module);
      }
      // Universal patterns are included
      const universalInResult = financePatterns.filter((p) => p.module === 'universal');
      expect(universalInResult.length).toBe(universalCount);
    });

    it('returns universal patterns when filtering by "universal"', () => {
      const universal = listPatterns('universal');
      expect(universal.length).toBeGreaterThanOrEqual(4);
      for (const p of universal) {
        expect(p.module).toBe('universal');
      }
    });
  });

  describe('renderPattern', () => {
    const testPattern: PatternDefinition = {
      id: 'test/render',
      name: 'Test Render',
      description: 'For testing renderPattern',
      module: 'test',
      template: 'Hello {{name}}, welcome to {{place}}. Enjoy {{activity}}.',
      requiredVars: ['name', 'place'],
      optionalVars: { activity: 'relaxing' },
    };

    it('replaces {{variable}} placeholders correctly', () => {
      const result = renderPattern(testPattern, {
        name: 'Alice',
        place: 'Hawk OS',
        activity: 'coding',
      });
      expect(result).toBe('Hello Alice, welcome to Hawk OS. Enjoy coding.');
    });

    it('applies defaults for optional vars not provided', () => {
      const result = renderPattern(testPattern, {
        name: 'Bob',
        place: 'the lab',
      });
      expect(result).toBe('Hello Bob, welcome to the lab. Enjoy relaxing.');
    });

    it('throws on missing required variable', () => {
      expect(() => renderPattern(testPattern, { name: 'Alice' })).toThrow(
        /Missing required variable "place"/,
      );
    });

    it('warns on unresolved placeholders', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const patternWithExtra: PatternDefinition = {
        id: 'test/unresolved',
        name: 'Test Unresolved',
        description: 'Has an extra placeholder',
        module: 'test',
        template: 'Hello {{name}}. See {{unknown_var}} for details.',
        requiredVars: ['name'],
      };

      const result = renderPattern(patternWithExtra, { name: 'Alice' });
      expect(result).toContain('{{unknown_var}}');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unresolved placeholders'));

      warnSpy.mockRestore();
    });
  });

  describe('registerPattern', () => {
    it('throws if requiredVar not found as {{var}} in template', () => {
      expect(() =>
        registerPattern({
          id: 'test/bad-var',
          name: 'Bad Var',
          description: 'Missing placeholder',
          module: 'test',
          template: 'This template has no placeholder',
          requiredVars: ['missing'],
        }),
      ).toThrow(/requiredVar "missing" not found as \{\{missing\}\}/);
    });
  });

  describe('executePattern', () => {
    it('throws on unknown pattern ID', () => {
      expect(() => executePattern('does-not/exist', {})).toThrow(
        /Pattern "does-not\/exist" not found/,
      );
    });

    it('renders a built-in pattern correctly', () => {
      const result = executePattern('finances/categorize-transaction', {
        description: 'Uber ride',
        amount: '25.00',
        type: 'expense',
      });
      expect(result).toContain('Uber ride');
      expect(result).toContain('25.00');
      expect(result).toContain('expense');
    });
  });

  describe('regex-special-char safety', () => {
    it('handles keys with regex special chars ($, ., *) via replaceAll', () => {
      const pattern: PatternDefinition = {
        id: 'test/special-chars',
        name: 'Special Chars',
        description: 'Tests regex-unsafe variable names',
        module: 'test',
        template: 'Price is {{price$usd}} and rate is {{rate.daily}} with {{wild*card}}.',
        requiredVars: ['price$usd', 'rate.daily', 'wild*card'],
      };

      // Register should succeed (validates {{var}} presence)
      registerPattern(pattern);

      const result = renderPattern(pattern, {
        price$usd: '99.99',
        'rate.daily': '1.5',
        'wild*card': 'ok',
      });
      expect(result).toBe('Price is 99.99 and rate is 1.5 with ok.');
    });
  });
});
