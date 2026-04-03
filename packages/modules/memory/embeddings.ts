'use server';

import { db } from '@hawk/db';
import { HawkError } from '@hawk/shared';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'placeholder',
    });
  }
  return _openai;
}

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/**
 * Generate an embedding vector for a given text using OpenRouter.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // truncate to model limit
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding)
    throw new HawkError('Failed to generate embedding: empty response', 'EMBEDDING_FAILED');
  return embedding;
}

/**
 * Generate and store embedding for a memory by ID.
 */
export async function embedMemory(memoryId: string, content: string): Promise<void> {
  const embedding = await generateEmbedding(content);
  const vectorStr = `[${embedding.join(',')}]`;

  const { error } = await db.rpc('update_memory_embedding', {
    memory_id: memoryId,
    embedding_vector: vectorStr,
  });

  // Fallback: direct update if RPC doesn't exist
  if (error) {
    await db
      .from('agent_memories')
      .update({ embedding: vectorStr } as Record<string, unknown>)
      .eq('id', memoryId);
  }
}

/**
 * Semantic search: find memories similar to a query using vector cosine similarity.
 * Returns memories ordered by similarity (most similar first).
 */
export async function semanticSearchMemories(
  query: string,
  limit = 10,
  memoryType?: string,
): Promise<Array<{ id: string; content: string; memory_type: string; similarity: number }>> {
  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // Use Supabase RPC for vector similarity search
  const { data, error } = await db.rpc('match_memories', {
    query_embedding: vectorStr,
    match_threshold: 0.3,
    match_count: limit,
    filter_type: memoryType ?? undefined,
  });

  if (error) {
    return [];
  }

  return (data ?? []) as Array<{
    id: string;
    content: string;
    memory_type: string;
    similarity: number;
  }>;
}

/**
 * Hybrid search: combines vector similarity (pgvector) + keyword relevance (pg_trgm).
 * Falls back to vector-only search if the hybrid RPC doesn't exist.
 */
export async function hybridSearchMemories(
  query: string,
  limit = 10,
  options?: {
    memoryType?: string;
    vectorWeight?: number;
    keywordWeight?: number;
    minScore?: number;
  },
): Promise<
  Array<{
    id: string;
    content: string;
    memory_type: string;
    module: string | null;
    importance: number;
    access_count: number;
    vector_score: number;
    keyword_score: number;
    combined_score: number;
  }>
> {
  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  const { data, error } = await db.rpc('hybrid_search_memories', {
    query_embedding: vectorStr,
    query_text: query,
    match_count: limit,
    vector_weight: options?.vectorWeight ?? 0.5,
    keyword_weight: options?.keywordWeight ?? 0.5,
    min_score: options?.minScore ?? 0.1,
    filter_type: options?.memoryType ?? null,
  });

  // Fallback to vector-only if hybrid RPC doesn't exist yet
  if (error) {
    const fallback = await semanticSearchMemories(query, limit, options?.memoryType);
    return fallback.map((m) => ({
      ...m,
      module: null,
      importance: 5,
      access_count: 0,
      vector_score: m.similarity,
      keyword_score: 0,
      combined_score: m.similarity,
    }));
  }

  return (data ?? []) as Array<{
    id: string;
    content: string;
    memory_type: string;
    module: string | null;
    importance: number;
    access_count: number;
    vector_score: number;
    keyword_score: number;
    combined_score: number;
  }>;
}

/**
 * Batch embed all memories that don't have embeddings yet.
 * Useful for backfilling after migration.
 */
export async function backfillEmbeddings(batchSize = 50): Promise<number> {
  const { data, error } = await db
    .from('agent_memories')
    .select('id, content')
    .is('embedding', null)
    .eq('status', 'active')
    .limit(batchSize);

  if (error || !data?.length) return 0;

  let processed = 0;
  for (const memory of data) {
    try {
      await embedMemory(memory.id, memory.content);
      processed++;
    } catch (_err) {}
  }

  return processed;
}
