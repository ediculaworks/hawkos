import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '../errors';
import {
  DateStringSchema,
  NonEmptyStringSchema,
  PositiveNumberSchema,
  TransactionTypeSchema,
  UUIDSchema,
  WorkoutTypeSchema,
  parseCommand,
  sanitizeHtml,
  stripTags,
  validatedCommand,
} from '../validation';

describe('Schema validators', () => {
  describe('TransactionTypeSchema', () => {
    it('accepts valid transaction types', () => {
      expect(TransactionTypeSchema.parse('income')).toBe('income');
      expect(TransactionTypeSchema.parse('expense')).toBe('expense');
      expect(TransactionTypeSchema.parse('transfer')).toBe('transfer');
    });

    it('rejects invalid transaction type', () => {
      expect(() => TransactionTypeSchema.parse('donation')).toThrow();
    });
  });

  describe('WorkoutTypeSchema', () => {
    it('accepts valid workout types', () => {
      expect(WorkoutTypeSchema.parse('musculacao')).toBe('musculacao');
      expect(WorkoutTypeSchema.parse('corrida')).toBe('corrida');
    });

    it('rejects unknown workout type', () => {
      expect(() => WorkoutTypeSchema.parse('crossfit')).toThrow();
    });
  });

  describe('PositiveNumberSchema', () => {
    it('accepts positive numbers', () => {
      expect(PositiveNumberSchema.parse(1)).toBe(1);
      expect(PositiveNumberSchema.parse(0.01)).toBe(0.01);
    });

    it('rejects zero and negative numbers', () => {
      expect(() => PositiveNumberSchema.parse(0)).toThrow();
      expect(() => PositiveNumberSchema.parse(-5)).toThrow();
    });
  });

  describe('NonEmptyStringSchema', () => {
    it('accepts non-empty strings', () => {
      expect(NonEmptyStringSchema.parse('hello')).toBe('hello');
    });

    it('rejects empty string', () => {
      expect(() => NonEmptyStringSchema.parse('')).toThrow();
    });
  });

  describe('DateStringSchema', () => {
    it('accepts YYYY-MM-DD format', () => {
      expect(DateStringSchema.parse('2026-03-29')).toBe('2026-03-29');
    });

    it('rejects wrong date formats', () => {
      expect(() => DateStringSchema.parse('29/03/2026')).toThrow();
      expect(() => DateStringSchema.parse('2026-3-1')).toThrow();
    });
  });

  describe('UUIDSchema', () => {
    it('accepts valid UUIDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(UUIDSchema.parse(uuid)).toBe(uuid);
    });

    it('rejects non-UUID strings', () => {
      expect(() => UUIDSchema.parse('not-a-uuid')).toThrow();
    });
  });
});

describe('validatedCommand', () => {
  const schema = z.object({ amount: z.number().positive(), note: z.string().min(1) });

  it('returns success with data for valid input', () => {
    const result = validatedCommand(schema, { amount: 100, note: 'test' }, 'TestAction');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(100);
    }
  });

  it('returns failure with ValidationError for invalid input', () => {
    const result = validatedCommand(schema, { amount: -1, note: '' }, 'TestAction');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('TestAction');
    }
  });
});

describe('parseCommand', () => {
  const schema = z.object({ value: z.number().positive() });

  it('returns parsed data for valid input', () => {
    const mockInteraction = { editReply: vi.fn().mockResolvedValue(undefined) };
    const result = parseCommand(schema, { value: 42 }, mockInteraction, 'AddValue');
    expect(result).toEqual({ value: 42 });
    expect(mockInteraction.editReply).not.toHaveBeenCalled();
  });

  it('returns null and calls editReply for invalid input', async () => {
    const editReply = vi.fn().mockResolvedValue(undefined);
    const mockInteraction = { editReply };
    const result = parseCommand(schema, { value: -1 }, mockInteraction, 'AddValue');
    expect(result).toBeNull();
    // editReply is called asynchronously (fire-and-forget), wait a tick
    await Promise.resolve();
    expect(editReply).toHaveBeenCalledWith(expect.stringContaining('AddValue'));
  });
});

describe('sanitizeHtml', () => {
  it('escapes HTML tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands', () => {
    expect(sanitizeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes single quotes', () => {
    expect(sanitizeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string unchanged', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('does not modify safe strings', () => {
    expect(sanitizeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('stripTags', () => {
  it('removes all HTML tags', () => {
    expect(stripTags('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
  });

  it('removes self-closing tags', () => {
    expect(stripTags('text<br/>more')).toBe('textmore');
  });

  it('handles nested tags', () => {
    expect(stripTags('<div><span>inner</span></div>')).toBe('inner');
  });

  it('returns plain text unchanged', () => {
    expect(stripTags('no tags here')).toBe('no tags here');
  });
});
