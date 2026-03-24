-- Migration: Memory RPC functions for vector search and access tracking
-- W1.6: Create RPC functions for embeddings and memory access

-- ── RPC: update_memory_embedding ──────────────────────────────────────────────
-- Stores the embedding vector for a memory

CREATE OR REPLACE FUNCTION update_memory_embedding(
  memory_id UUID,
  embedding_vector TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE agent_memories
  SET
    embedding = embedding_vector::vector,
    updated_at = NOW()
  WHERE id = memory_id;
END;
$$;

-- ── RPC: match_memories ────────────────────────────────────────────────────────
-- Performs cosine similarity search using HNSW index
-- Returns memories with similarity score above threshold

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding TEXT,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content::TEXT,
    m.memory_type::TEXT,
    1 - (m.embedding <=> query_embedding::vector)::FLOAT AS similarity
  FROM agent_memories m
  WHERE
    m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding::vector) > match_threshold
    AND (filter_type IS NULL OR m.memory_type = filter_type)
  ORDER BY m.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;

-- ── RPC: increment_memory_access ─────────────────────────────────────────────
-- Increments access_count for multiple memories atomically

CREATE OR REPLACE FUNCTION increment_memory_access(
  memory_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE agent_memories
  SET
    access_count = access_count + 1,
    last_accessed = NOW()
  WHERE id = ANY(memory_ids);
END;
$$;

-- ── Grant permissions ─────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION update_memory_embedding TO service_role;
GRANT EXECUTE ON FUNCTION match_memories TO service_role;
GRANT EXECUTE ON FUNCTION increment_memory_access TO service_role;
