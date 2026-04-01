import { describe, expect, it, vi } from 'vitest';

// ── Mock db using same pattern as agent-resolver tests ─────────────────────
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../../../packages/db/src/client.ts', () => ({
  db: { from: mockFrom },
  tenantStore: { getStore: () => null, run: vi.fn() },
  createTenantClient: vi.fn(),
}));

vi.mock('@hawk/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  };
});

import { getLinkedMemories } from '../queries.ts';

// ── Chainable Supabase mock ───────────────────────────────────────────────
function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'in', 'eq', 'order', 'limit', 'gte', 'lte', 'maybeSingle', 'single'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal calls resolve with value
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue);
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(finalValue);

  // Make chain itself thenable (Supabase query builder is awaitable)
  (chain as Record<string, unknown>).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(finalValue).then(resolve, reject);

  return chain;
}

describe('getLinkedMemories — BFS multi-hop', () => {
  it('returns empty array when no links exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    const results = await getLinkedMemories('mem-1', 1);
    expect(results).toEqual([]);
  });

  it('returns hop=1 links with correct structure', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memory_links') {
        return makeChain({
          data: [{ source_id: 'mem-1', target_id: 'mem-2', relation_type: 'related_to', strength: 0.9 }],
          error: null,
        });
      }
      if (table === 'agent_memories') {
        return makeChain({
          data: [
            {
              id: 'mem-2',
              content: 'Linked memory',
              category: 'fact',
              memory_type: 'entity',
              module: 'people',
              importance: 7,
              created_at: '2026-03-29T00:00:00Z',
            },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const results = await getLinkedMemories('mem-1', 1);
    expect(results).toHaveLength(1);
    expect(results[0]!.hop).toBe(1);
    expect(results[0]!.relation).toBe('related_to');
    expect(results[0]!.strength).toBe(0.9);
    expect(results[0]!.memory.id).toBe('mem-2');
  });

  it('respects maxHops=1 and does not query for hop 2', async () => {
    let linkCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memory_links') {
        linkCalls++;
        if (linkCalls === 1) {
          return makeChain({
            data: [{ source_id: 'mem-1', target_id: 'mem-2', relation_type: 'related_to', strength: 0.8 }],
            error: null,
          });
        }
        return makeChain({ data: [], error: null });
      }
      if (table === 'agent_memories') {
        return makeChain({
          data: [
            {
              id: 'mem-2',
              content: 'Memory 2',
              category: 'fact',
              memory_type: 'entity',
              importance: 5,
              created_at: '2026-03-29T00:00:00Z',
            },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    await getLinkedMemories('mem-1', 1);
    expect(linkCalls).toBe(1);
  });

  it('deduplicates visited nodes across hops', async () => {
    let hop = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'memory_links') {
        hop++;
        if (hop === 1) {
          return makeChain({
            data: [
              { source_id: 'mem-1', target_id: 'mem-2', relation_type: 'related_to', strength: 0.8 },
              { source_id: 'mem-1', target_id: 'mem-3', relation_type: 'related_to', strength: 0.7 },
            ],
            error: null,
          });
        }
        if (hop === 2) {
          // Cycle back to mem-1 (already visited as root)
          return makeChain({
            data: [
              { source_id: 'mem-2', target_id: 'mem-1', relation_type: 'related_to', strength: 0.5 },
            ],
            error: null,
          });
        }
        return makeChain({ data: [], error: null });
      }
      if (table === 'agent_memories') {
        return makeChain({
          data: [
            { id: 'mem-2', content: 'M2', category: 'fact', memory_type: 'entity', importance: 5, created_at: '2026-03-29T00:00:00Z' },
            { id: 'mem-3', content: 'M3', category: 'fact', memory_type: 'entity', importance: 4, created_at: '2026-03-29T00:00:00Z' },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const results = await getLinkedMemories('mem-1', 2);
    const ids = results.map((r) => r.memory.id);
    // Root node mem-1 should never appear (visited set includes it from start)
    expect(ids).not.toContain('mem-1');
    // No duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('throws HawkError when DB returns error', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'connection timeout' } }),
    );
    await expect(getLinkedMemories('mem-1', 1)).rejects.toThrow('connection timeout');
  });
});
