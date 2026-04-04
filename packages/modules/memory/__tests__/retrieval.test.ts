import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFrom, mockRpc, mockGetFeatureFlag } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetFeatureFlag: vi.fn(),
}));

vi.mock('../../../../packages/db/src/client.ts', () => ({
  db: { from: mockFrom, rpc: mockRpc },
  tenantStore: { getStore: () => null, run: vi.fn() },
  createTenantClient: vi.fn(),
}));

vi.mock('@hawk/shared', () => ({
  HawkError: class HawkError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
}));

// Mock OpenAI so generateEmbedding returns a fake vector (embeddings.ts uses it)
vi.mock('openai', () => ({
  default: class OpenAI {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }],
      }),
    };
  },
}));

import { retrieveMemories } from '../retrieval.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = '2026-04-03T12:00:00Z';

function makeMemory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: overrides.id ?? 'mem-1',
    category: overrides.category ?? 'fact',
    memory_type: overrides.memory_type ?? 'entity',
    content: overrides.content ?? 'Test memory content',
    module: overrides.module ?? 'finances',
    related_modules: overrides.related_modules ?? [],
    source_message_id: overrides.source_message_id ?? null,
    importance: overrides.importance ?? 5,
    confidence: overrides.confidence ?? 0.8,
    status: overrides.status ?? 'active',
    last_accessed: overrides.last_accessed ?? NOW,
    access_count: overrides.access_count ?? 1,
    expires_at: overrides.expires_at ?? null,
    tags: overrides.tags ?? [],
    mergeable: overrides.mergeable ?? false,
    origin_session_id: overrides.origin_session_id ?? null,
    path: overrides.path ?? null,
    l0_abstract: overrides.l0_abstract ?? null,
    l1_overview: overrides.l1_overview ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

/** Chainable Supabase mock that resolves to { data, error } */
function makeChain(finalValue: { data: unknown; error: unknown }) {
  const promise = Promise.resolve(finalValue);
  const obj = Object.assign(promise, {} as Record<string, unknown>);
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'gte', 'lte', 'is', 'update']) {
    (obj as Record<string, unknown>)[m] = vi.fn().mockReturnValue(obj);
  }
  return obj;
}

/**
 * Configure mockRpc and mockFrom for a test.
 * - searchData: returned by 'match_memories' RPC (semantic search path)
 * - hotData / importantData: returned by db.from('agent_memories') queries
 * - hybridRrfData: if set, 'hybrid_search_memories_rrf' succeeds
 */
function setupMocks(opts: {
  searchData?: unknown[];
  hotData?: unknown[];
  importantData?: unknown[];
  hybridRrfData?: unknown[];
}) {
  const { searchData = [], hotData = [], importantData = [], hybridRrfData } = opts;

  mockRpc.mockImplementation((name: string) => {
    if (name === 'match_memories') {
      return Promise.resolve({ data: searchData, error: null });
    }
    if (name === 'hybrid_search_memories_rrf') {
      if (hybridRrfData) return Promise.resolve({ data: hybridRrfData, error: null });
      return Promise.resolve({ data: null, error: { message: 'not found' } });
    }
    if (name === 'hybrid_search_memories') {
      return Promise.resolve({ data: null, error: { message: 'not found' } });
    }
    return Promise.resolve({ data: null, error: null });
  });

  let fromCallIndex = 0;
  mockFrom.mockImplementation(() => {
    const dataset = fromCallIndex === 0 ? hotData : importantData;
    fromCallIndex++;
    return makeChain({ data: dataset, error: null });
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('retrieveMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureFlag.mockReturnValue(false);
    setupMocks({});
  });

  it('returns empty array when all searches return empty', async () => {
    const results = await retrieveMemories('test query');
    expect(results).toEqual([]);
  });

  it('ranks results by combined score (higher similarity = higher rank)', async () => {
    setupMocks({
      searchData: [
        { ...makeMemory({ id: 'high', confidence: 0.8 }), similarity: 0.95 },
        { ...makeMemory({ id: 'low', confidence: 0.8 }), similarity: 0.3 },
      ],
    });

    const results = await retrieveMemories('test', 10);
    expect(results.length).toBe(2);
    expect(results[0]!.id).toBe('high');
    expect(results[1]!.id).toBe('low');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });

  it('NaN guard: result without similarity gets score 0 for similarity', async () => {
    setupMocks({
      searchData: [{ ...makeMemory({ id: 'no-score', confidence: 0.5 }) }],
    });

    const results = await retrieveMemories('test', 10);
    expect(results.length).toBe(1);
    expect(Number.isNaN(results[0]!.score)).toBe(false);
    // Only confidence contributes: 0.5 * 0.15 = 0.075
    expect(results[0]!.score).toBeCloseTo(0.5 * 0.15, 5);
  });

  it('confidence weight: memory with confidence=0.9 ranks higher than confidence=0.3', async () => {
    setupMocks({
      searchData: [
        { ...makeMemory({ id: 'high-conf', confidence: 0.9 }), similarity: 0.5 },
        { ...makeMemory({ id: 'low-conf', confidence: 0.3 }), similarity: 0.5 },
      ],
    });

    const results = await retrieveMemories('test', 10);
    expect(results.length).toBe(2);
    expect(results[0]!.id).toBe('high-conf');
    expect(results[1]!.id).toBe('low-conf');
    // Difference should be (0.9 - 0.3) * 0.15 = 0.09
    expect(results[0]!.score - results[1]!.score).toBeCloseTo(0.09, 5);
  });

  it('uses hybrid search when feature flag enabled', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    setupMocks({
      hybridRrfData: [{ ...makeMemory({ id: 'h1' }), combined_score: 0.8 }],
    });

    const results = await retrieveMemories('test', 5);

    expect(mockRpc).toHaveBeenCalledWith('hybrid_search_memories_rrf', expect.any(Object));
    const rpcNames = mockRpc.mock.calls.map((c: unknown[]) => c[0]);
    expect(rpcNames).not.toContain('match_memories');
    expect(results.length).toBe(1);
  });

  it('falls back to semantic search when hybrid fails', async () => {
    mockGetFeatureFlag.mockReturnValue(true);
    setupMocks({
      searchData: [{ ...makeMemory({ id: 'fallback' }), similarity: 0.6 }],
    });

    const results = await retrieveMemories('test', 5);

    const rpcNames = mockRpc.mock.calls.map((c: unknown[]) => c[0]);
    // Hybrid RPCs were attempted
    expect(rpcNames).toContain('hybrid_search_memories_rrf');
    // Semantic fallback eventually called match_memories
    expect(rpcNames).toContain('match_memories');
    expect(results.length).toBe(1);
  });

  it('deduplicates memories that appear in both search and hot results', async () => {
    const mem = makeMemory({ id: 'dup-1', importance: 8, access_count: 10, confidence: 0.8 });

    setupMocks({
      searchData: [{ ...mem, similarity: 0.7 }],
      hotData: [mem],
    });

    const results = await retrieveMemories('test', 10);
    const ids = results.map((r) => r.id);
    expect(ids.filter((id) => id === 'dup-1')).toHaveLength(1);
    // Score should include both similarity and hotness contributions
    expect(results[0]!.score).toBeGreaterThan(0.7 * 0.45);
  });

  it('respects limit parameter', async () => {
    const mems = Array.from({ length: 10 }, (_, i) =>
      makeMemory({ id: `mem-${i}`, confidence: 0.8 }),
    );

    setupMocks({
      searchData: mems.map((m, i) => ({ ...m, similarity: 1 - i * 0.05 })),
    });

    const results = await retrieveMemories('test', 3);
    expect(results).toHaveLength(3);
    expect(results[0]!.id).toBe('mem-0');
    expect(results[1]!.id).toBe('mem-1');
    expect(results[2]!.id).toBe('mem-2');
  });
});
