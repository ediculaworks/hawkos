import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import type OpenAI from 'openai';

const logger = createLogger('memory');
import { generateEmbedding, semanticSearchMemories } from './embeddings';
import { getWorkerClientFn, getWorkerModel, setWorkerLLM } from './session-commit';

// Re-export setWorkerLLM so agent can inject the worker client once
export { setWorkerLLM };

function getClient(): OpenAI {
  const clientFn = getWorkerClientFn();
  if (clientFn) return clientFn();
  const OpenAIModule = require('openai') as {
    default: new (opts: Record<string, unknown>) => OpenAI;
  };
  return new OpenAIModule.default({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
  });
}

// Activity logging for ML training data (uses same db client)
function logDedupDecision(
  candidate: MemoryCandidate,
  decision: DedupDecision,
  topSimilarity: number | null,
  method: 'threshold' | 'llm' | 'no_match',
): void {
  db.from('activity_log')
    .insert({
      event_type: 'dedup_decision' as const,
      module: candidate.module ?? null,
      summary: `[${method}] ${decision} (sim=${topSimilarity?.toFixed(3) ?? 'n/a'}) ${candidate.memory_type}`,
      metadata: JSON.parse(
        JSON.stringify({
          decision,
          method,
          memory_type: candidate.memory_type,
          similarity: topSimilarity,
          content_preview: candidate.content.slice(0, 100),
        }),
      ),
    })
    .then(
      () => {},
      () => {},
    );
}

// Worker model: uses the same model injected into session-commit (Ollama local or OpenRouter)

// ── Types ──────────────────────────────────────────────────

export type MemoryCandidate = {
  content: string;
  memory_type: 'profile' | 'preference' | 'entity' | 'event' | 'case' | 'pattern' | 'procedure';
  module: string | null;
  importance: number;
};

type DedupDecision = 'SKIP' | 'CREATE' | 'MERGE';

type DedupResult = {
  decision: DedupDecision;
  mergeTargetId?: string;
  mergedContent?: string;
};

// ── Deduplication (OpenViking 2-stage + threshold optimization) ──

const SIMILARITY_THRESHOLD = 0.85;
const AUTO_SKIP_THRESHOLD = 0.95; // Clearly duplicate — skip without LLM
const AUTO_MERGE_THRESHOLD = 0.92; // Very similar — auto-merge without LLM
// Borderline zone (0.85 - 0.92): only these go to LLM (~20% of cases)

/**
 * Two-stage deduplication for a memory candidate:
 *
 * Stage 1: Vector pre-filtering — find similar existing memories
 * Stage 2: Threshold-based decisions for clear cases, LLM only for borderline
 *
 * Threshold bands (for mergeable types):
 *   ≥ 0.95 → SKIP (clearly duplicate, no LLM needed)
 *   ≥ 0.92 → MERGE (auto-append, no LLM needed)
 *   0.85-0.92 → LLM decides (borderline zone, ~20% of cases)
 *   < 0.85 → CREATE (clearly different)
 */
export async function deduplicateMemory(candidate: MemoryCandidate): Promise<DedupResult> {
  // Stage 1: Vector pre-filtering
  const similar = await semanticSearchMemories(candidate.content, 5, candidate.memory_type).catch(
    () => [],
  );

  // No similar memories found → create
  if (similar.length === 0) {
    logDedupDecision(candidate, 'CREATE', null, 'no_match');
    return { decision: 'CREATE' };
  }

  // Check if any are above similarity threshold
  const highSimilarity = similar.filter((s) => s.similarity >= SIMILARITY_THRESHOLD);

  if (highSimilarity.length === 0) {
    logDedupDecision(candidate, 'CREATE', similar[0]?.similarity ?? null, 'threshold');
    return { decision: 'CREATE' };
  }

  const topMatch = highSimilarity[0];
  if (!topMatch) return { decision: 'CREATE' };

  // Non-mergeable types (event, case): each instance matters
  if (candidate.memory_type === 'event' || candidate.memory_type === 'case') {
    if (topMatch.similarity >= AUTO_SKIP_THRESHOLD) {
      logDedupDecision(candidate, 'SKIP', topMatch.similarity, 'threshold');
      return { decision: 'SKIP' };
    }
    logDedupDecision(candidate, 'CREATE', topMatch.similarity, 'threshold');
    return { decision: 'CREATE' };
  }

  // Stage 2: Threshold-based decisions for mergeable types
  // Band 1: Clearly duplicate → SKIP (no LLM)
  if (topMatch.similarity >= AUTO_SKIP_THRESHOLD) {
    logDedupDecision(candidate, 'SKIP', topMatch.similarity, 'threshold');
    return { decision: 'SKIP' };
  }

  // Band 2: Very similar → auto-MERGE with template (no LLM)
  if (topMatch.similarity >= AUTO_MERGE_THRESHOLD) {
    const today = new Date().toISOString().slice(0, 10);
    const mergedContent = `${topMatch.content}\n\n---\nAtualização (${today}): ${candidate.content}`;
    logDedupDecision(candidate, 'MERGE', topMatch.similarity, 'threshold');
    return {
      decision: 'MERGE',
      mergeTargetId: topMatch.id,
      mergedContent,
    };
  }

  // Band 3: Borderline (0.85-0.92) → LLM decides
  try {
    const llmDecision = await askLLMForDedupDecision(candidate, topMatch);
    logDedupDecision(candidate, llmDecision.decision, topMatch.similarity, 'llm');
    return llmDecision;
  } catch {
    // If LLM fails, default to create (conservative)
    logDedupDecision(candidate, 'CREATE', topMatch.similarity, 'llm');
    return { decision: 'CREATE' };
  }
}

/**
 * Ask the LLM to decide whether to SKIP, MERGE, or CREATE.
 * For MERGE, the LLM also generates the merged content.
 */
async function askLLMForDedupDecision(
  candidate: MemoryCandidate,
  existing: { id: string; content: string; similarity: number },
): Promise<DedupResult> {
  const prompt = `You are a memory deduplication system. Compare these two memories and decide what to do.

EXISTING MEMORY (ID: ${existing.id}):
"${existing.content}"

NEW CANDIDATE:
"${candidate.content}"

Type: ${candidate.memory_type} (${candidate.memory_type === 'profile' || candidate.memory_type === 'preference' || candidate.memory_type === 'entity' || candidate.memory_type === 'pattern' ? 'mergeable' : 'non-mergeable'})
Similarity: ${(existing.similarity * 100).toFixed(1)}%

Decide:
- SKIP: The new candidate is essentially a duplicate of the existing memory. No action needed.
- MERGE: The candidate contains new or updated information that should be combined with the existing memory. Provide the merged content.
- CREATE: The candidate is sufficiently different to warrant a separate memory entry.

Respond in JSON format:
{"decision": "SKIP|MERGE|CREATE", "merged_content": "only if MERGE, the combined text in Portuguese"}`;

  const response = await getClient().chat.completions.create({
    model: getWorkerModel(),
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message.content;
  if (!content) return { decision: 'CREATE' };

  let parsed: { decision: string; merged_content?: string };
  try {
    parsed = JSON.parse(content) as { decision: string; merged_content?: string };
  } catch {
    // biome-ignore lint/suspicious/noConsole: error logging for invalid LLM output
    console.error('[deduplicator] LLM returned invalid JSON:', content.slice(0, 200));
    return { decision: 'CREATE' };
  }

  if (parsed.decision === 'SKIP') {
    return { decision: 'SKIP' };
  }

  if (parsed.decision === 'MERGE' && parsed.merged_content) {
    return {
      decision: 'MERGE',
      mergeTargetId: existing.id,
      mergedContent: parsed.merged_content,
    };
  }

  return { decision: 'CREATE' };
}

/**
 * Apply a dedup result: create new memory, merge into existing, or skip.
 * Returns the memory ID (new or merged) or null if skipped.
 */
export async function applyDedupResult(
  candidate: MemoryCandidate,
  result: DedupResult,
  originSessionId?: string,
): Promise<string | null> {
  if (result.decision === 'SKIP') {
    return null;
  }

  if (result.decision === 'MERGE' && result.mergeTargetId && result.mergedContent) {
    // Update existing memory with merged content
    const embedding = await generateEmbedding(result.mergedContent).catch(() => null);

    const updateData = {
      content: result.mergedContent,
      embedding: embedding ? `[${embedding.join(',')}]` : null,
    };

    const { error } = await db
      .from('agent_memories')
      .update(updateData)
      .eq('id', result.mergeTargetId);

    if (error) {
      logger.error({ error: error.message }, 'Failed to merge memory');
      throw new HawkError(`Failed to merge memory: ${error.message}`, 'DB_UPDATE_FAILED');
    }
    return result.mergeTargetId;
  }

  // CREATE: insert new memory with embedding
  const embedding = await generateEmbedding(candidate.content).catch(() => null);

  const insertData = {
    category: mapMemoryTypeToCategory(candidate.memory_type),
    memory_type: candidate.memory_type,
    content: candidate.content,
    module: candidate.module,
    importance: candidate.importance,
    status: 'active' as const,
    mergeable: ['profile', 'preference', 'entity', 'pattern'].includes(candidate.memory_type),
    origin_session_id: originSessionId ?? null,
    embedding: embedding ? `[${embedding.join(',')}]` : null,
  };

  const { data, error } = await db.from('agent_memories').insert(insertData).select('id').single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create memory');
    throw new HawkError(`Failed to create memory: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return (data as { id: string }).id;
}

/**
 * Map OpenViking memory_type back to legacy category for backward compatibility.
 */
function mapMemoryTypeToCategory(memoryType: string): string {
  const mapping: Record<string, string> = {
    profile: 'fact',
    preference: 'preference',
    entity: 'relationship',
    event: 'fact',
    case: 'correction',
    pattern: 'pattern',
  };
  return mapping[memoryType] ?? 'fact';
}
