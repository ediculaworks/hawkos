import { db } from '@hawk/db';
import { HawkError, createLogger, getFeatureFlag } from '@hawk/shared';
import { getAdaptiveHalfLife } from './adaptive';

const logger = createLogger('memory');
import { hybridSearchMemories, semanticSearchMemories } from './embeddings';
import type { AgentMemory } from './types';

// ── Scoring Constants (OpenViking-inspired) ────────────────

/** Weight for semantic similarity in final memory score */
const SEMANTIC_WEIGHT = 0.45;
/** Weight for hotness (recency × frequency) in final memory score */
const HOTNESS_WEIGHT = 0.25;
/** Weight for importance in final memory score */
const IMPORTANCE_WEIGHT = 0.15;
/** Weight for confidence (DeerFlow-inspired) — how certain the extracted fact is */
const CONFIDENCE_WEIGHT = 0.15;

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
  const useHybrid = getFeatureFlag('hybrid-search');

  const [searchResults, hotResults, importantResults] = await Promise.all([
    useHybrid
      ? hybridSearchMemories(query, limit * 2).catch((err) => {
          logger.warn({ err }, 'Hybrid search failed, falling back to semantic');
          return semanticSearchMemories(query, limit * 2).catch((err2) => {
            logger.warn({ err: err2 }, 'Semantic search also failed, returning empty');
            return [];
          });
        })
      : semanticSearchMemories(query, limit * 2).catch((err) => {
          logger.warn({ err }, 'Semantic search failed, returning empty');
          return [];
        }),
    getHottestMemories(limit),
    getTopByImportance(limit),
  ]);

  // Build score map: memory_id → accumulated score
  const scoreMap = new Map<string, { memory: AgentMemory; score: number }>();

  // Search results: weight 0.45 (combined_score or similarity already 0-1)
  for (const result of searchResults) {
    const rawScore =
      'combined_score' in result
        ? (result as { combined_score: number }).combined_score
        : (result as { similarity: number }).similarity;
    // M5: NaN guard — if neither field exists, default to 0
    const similarity = Number(rawScore) || 0;
    const existing = scoreMap.get(result.id);
    if (existing) {
      existing.score += similarity * SEMANTIC_WEIGHT;
    } else {
      // M6: include all available fields from search result (partial — upgraded later by hot/important results)
      scoreMap.set(result.id, {
        memory: result as unknown as AgentMemory,
        score: similarity * SEMANTIC_WEIGHT,
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

  // Apply confidence weight — memories with higher confidence score higher
  for (const entry of scoreMap.values()) {
    const confidence = (entry.memory as AgentMemory & { confidence?: number }).confidence ?? 0.8;
    entry.score += confidence * CONFIDENCE_WEIGHT;
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get hot memories');
    throw new HawkError(`Failed to get hot memories: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get important memories');
    throw new HawkError(`Failed to get important memories: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as AgentMemory[];
}
