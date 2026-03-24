import { db } from '@hawk/db';
import { getAdaptiveHalfLife } from './adaptive';
import { semanticSearchMemories } from './embeddings';
import type { AgentMemory } from './types';

// ── Scoring Constants (OpenViking-inspired) ────────────────

/** Weight for semantic similarity in final memory score */
const SEMANTIC_WEIGHT = 0.5;
/** Weight for hotness (recency × frequency) in final memory score */
const HOTNESS_WEIGHT = 0.3;
/** Weight for importance in final memory score */
const IMPORTANCE_WEIGHT = 0.2;

// ── Hotness Scoring ────────────────────────────────────────

export const MEMORY_HALF_LIVES: Record<string, number> = {
  routine: 3,
  health: 7,
  finances: 30,
  calendar: 14,
  objectives: 30,
  knowledge: 90,
  career: 90,
  entertainment: 60,
  housing: 60,
  legal: 90,
  social: 30,
  assets: 120,
  people: 180,
  spirituality: 365,
  procedure: 365, // learned corrections — nearly permanent
  default: 180, // profiles, preferences, general memories — should be long-lived
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function hotnessScore(accessCount: number, updatedAt: string, module: string): number {
  const frequency = sigmoid(Math.log1p(accessCount));
  const daysSinceUpdate = Math.max((Date.now() - new Date(updatedAt).getTime()) / 86_400_000, 0);
  // Use adaptive half-life (falls back to hardcoded default if no data yet)
  const halfLife = getAdaptiveHalfLife(module);
  const recency = Math.exp((-Math.LN2 / halfLife) * daysSinceUpdate);
  return frequency * recency;
}

// ── Memory Retrieval ───────────────────────────────────────

type ScoredMemory = AgentMemory & { score: number; display_content: string };

/**
 * Retrieve memories using a multi-signal blend:
 * 1. Semantic similarity (vector search)
 * 2. Hotness (frequency × recency)
 * 3. Static importance
 *
 * Returns deduplicated top-N memories ranked by combined score.
 */
export async function retrieveMemories(query: string, limit = 10): Promise<ScoredMemory[]> {
  const [semanticResults, hotResults, importantResults] = await Promise.all([
    semanticSearchMemories(query, limit * 2).catch(() => []),
    getHottestMemories(limit),
    getTopByImportance(limit),
  ]);

  // Build score map: memory_id → accumulated score
  const scoreMap = new Map<string, { memory: AgentMemory; score: number }>();

  // Semantic results: weight 0.5 (similarity already 0-1)
  for (const result of semanticResults) {
    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += result.similarity * SEMANTIC_WEIGHT;
    } else {
      // We'll need to fetch full memory data for semantic-only results
      scoreMap.set(result.id, {
        memory: { id: result.id, content: result.content } as AgentMemory,
        score: result.similarity * SEMANTIC_WEIGHT,
      });
    }
  }

  // Hot results: weight 0.3
  for (let i = 0; i < hotResults.length; i++) {
    const mem = hotResults[i];
    if (!mem) continue;
    const hotScore = hotnessScore(mem.access_count, mem.updated_at, mem.module ?? 'default');
    const existing = scoreMap.get(mem.id);
    if (existing) {
      existing.score += hotScore * HOTNESS_WEIGHT;
      existing.memory = mem; // upgrade to full data
    } else {
      scoreMap.set(mem.id, { memory: mem, score: hotScore * HOTNESS_WEIGHT });
    }
  }

  // Important results: weight 0.2 (importance normalized to 0-1)
  for (let i = 0; i < importantResults.length; i++) {
    const mem = importantResults[i];
    if (!mem) continue;
    const importanceScore = mem.importance / 10;
    const existing = scoreMap.get(mem.id);
    if (existing) {
      existing.score += importanceScore * IMPORTANCE_WEIGHT;
      existing.memory = mem;
    } else {
      scoreMap.set(mem.id, { memory: mem, score: importanceScore * IMPORTANCE_WEIGHT });
    }
  }

  // Sort by combined score, return top N
  const ranked = [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory, score }) => ({
      ...memory,
      score,
      display_content: memory.l1_overview ?? memory.content,
    }));

  return ranked;
}

/**
 * Increment access_count for memories that were included in context.
 * Call this after memories are sent to the LLM.
 */
export async function trackMemoryAccess(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return;

  const { error } = await db.rpc('increment_memory_access', {
    memory_ids: memoryIds,
  });

  // Fallback: batch update if RPC doesn't exist
  if (error) {
    await db
      .from('agent_memories')
      .update({ last_accessed: new Date().toISOString() })
      .in('id', memoryIds)
      .then(
        () => {},
        () => {},
      );
  }
}

// ── Internal queries ───────────────────────────────────────

async function getHottestMemories(limit: number): Promise<AgentMemory[]> {
  const { data, error } = await db
    .from('agent_memories')
    .select(
      'id, category, content, module, related_modules, source_message_id, importance, confidence, status, last_accessed, access_count, expires_at, tags, path, l0_abstract, l1_overview, created_at, updated_at',
    )
    .eq('status', 'active')
    .order('access_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get hot memories: ${error.message}`);
  return (data ?? []) as AgentMemory[];
}

async function getTopByImportance(limit: number): Promise<AgentMemory[]> {
  const { data, error } = await db
    .from('agent_memories')
    .select(
      'id, category, content, module, related_modules, source_message_id, importance, confidence, status, last_accessed, access_count, expires_at, tags, path, l0_abstract, l1_overview, created_at, updated_at',
    )
    .eq('status', 'active')
    .order('importance', { ascending: false })
    .order('last_accessed', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get important memories: ${error.message}`);
  return (data ?? []) as AgentMemory[];
}
