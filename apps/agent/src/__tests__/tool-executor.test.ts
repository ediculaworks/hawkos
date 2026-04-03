import { describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@hawk/db', () => ({
  db: { from: vi.fn() },
}));
vi.mock('@hawk/module-memory/embeddings', () => ({
  embedMemory: vi.fn().mockResolvedValue(null),
}));
vi.mock('@hawk/module-memory/queries', () => ({
  createMemory: vi.fn().mockResolvedValue({ id: 'mem-1' }),
}));
vi.mock('../activity-logger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../hooks/index.js', () => ({
  hookRegistry: { emit: vi.fn().mockResolvedValue(undefined) },
}));

import { executeToolCall } from '../tool-executor.js';
import type { TOOLS } from '../tools/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeToolCall(name: string, args: Record<string, unknown>) {
  return {
    id: 'tc-1',
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
}

function makeToolMap(handler: (args: Record<string, unknown>) => Promise<string>) {
  const map = new Map<string, (typeof TOOLS)[string]>();
  map.set('some_tool', {
    name: 'some_tool',
    modules: ['finances'],
    description: 'Test tool',
    parameters: { type: 'object', properties: {} },
    handler,
  });
  return map;
}

// ── Zod validation ─────────────────────────────────────────────────────────

describe('executeToolCall — Zod validation', () => {
  const SESSION = 'session-test';

  it('rejects save_memory with empty content', async () => {
    const result = await executeToolCall(
      makeToolCall('save_memory', { content: '', memory_type: 'profile' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('content');
  });

  it('rejects save_memory with invalid memory_type', async () => {
    const result = await executeToolCall(
      makeToolCall('save_memory', { content: 'hello', memory_type: 'invalid_type' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('memory_type');
  });

  it('accepts valid save_memory args and calls createMemory', async () => {
    const result = await executeToolCall(
      makeToolCall('save_memory', {
        content: 'Test memory',
        memory_type: 'profile',
        importance: 7,
      }),
      new Map(),
      SESSION,
    );
    expect(result).not.toContain('argumentos inválidos');
  });

  it('rejects create_transaction with negative amount', async () => {
    const result = await executeToolCall(
      makeToolCall('create_transaction', { amount: -50, type: 'expense', category: 'Food' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('amount');
  });

  it('rejects log_sleep with duration > 24', async () => {
    const result = await executeToolCall(
      makeToolCall('log_sleep', { duration_h: 25 }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('duration_h');
  });

  it('rejects log_sleep with invalid date format', async () => {
    const result = await executeToolCall(
      makeToolCall('log_sleep', { duration_h: 7, date: '29-03-2026' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('date');
  });

  it('accepts valid log_sleep args', async () => {
    const toolMap = makeToolMap(async () => 'sleep logged');
    toolMap.set('log_sleep', {
      name: 'log_sleep',
      modules: ['health'],
      description: 'Log sleep',
      parameters: { type: 'object', properties: {} },
      handler: async () => 'sleep logged',
    });
    const result = await executeToolCall(
      makeToolCall('log_sleep', { duration_h: 7.5, quality: 8, date: '2026-03-29' }),
      toolMap,
      SESSION,
    );
    expect(result).toBe('sleep logged');
  });

  it('rejects create_person with empty name', async () => {
    const result = await executeToolCall(
      makeToolCall('create_person', { name: '' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
    expect(result).toContain('name');
  });

  it('rejects log_workout with empty exercise_name', async () => {
    const result = await executeToolCall(
      makeToolCall('log_workout', { exercise_name: '' }),
      new Map(),
      SESSION,
    );
    expect(result).toContain('argumentos inválidos');
  });
});

// ── Tool routing ───────────────────────────────────────────────────────────

describe('executeToolCall — routing', () => {
  const SESSION = 'session-test';

  it('returns error for unknown tool', async () => {
    const result = await executeToolCall(makeToolCall('nonexistent_tool', {}), new Map(), SESSION);
    expect(result).toContain('não encontrada');
  });

  it('calls handler and returns result', async () => {
    const handler = vi.fn().mockResolvedValue('ok result');
    const toolMap = makeToolMap(handler);
    const result = await executeToolCall(
      makeToolCall('some_tool', { foo: 'bar' }),
      toolMap,
      SESSION,
    );
    expect(result).toBe('ok result');
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('handles malformed JSON args', async () => {
    const tc = {
      id: 'tc-1',
      type: 'function' as const,
      function: { name: 'some_tool', arguments: '{not valid json' },
    };
    const result = await executeToolCall(tc, new Map(), SESSION);
    expect(result).toContain('JSON malformado');
  });

  it('catches and returns handler errors as strings', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    const toolMap = makeToolMap(handler);
    const result = await executeToolCall(makeToolCall('some_tool', {}), toolMap, SESSION);
    expect(result).toContain('DB connection failed');
  });
});
