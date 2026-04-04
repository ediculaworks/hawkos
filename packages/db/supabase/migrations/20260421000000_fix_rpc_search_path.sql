-- Migration: Add SET search_path = '' to all RPC functions (defense-in-depth)
--
-- The compat layer (executeRpc) already sets search_path per-tenant via
-- SET LOCAL before calling RPCs. However, as defense-in-depth, we add
-- SET search_path = '' to all SECURITY DEFINER functions so they cannot
-- accidentally reference the wrong schema if called outside the compat layer.
--
-- PostgreSQL best practice: SECURITY DEFINER + SET search_path = ''

BEGIN;

-- ── update_memory_embedding ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_memory_embedding(
  memory_id UUID,
  embedding_vector TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE agent_memories
  SET
    embedding = embedding_vector::vector,
    updated_at = NOW()
  WHERE id = memory_id;
END;
$$;

-- ── match_memories ──────────────────────────────────────────────────────────

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
SET search_path = ''
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

-- ── increment_memory_access ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_memory_access(
  memory_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE agent_memories
  SET
    access_count = access_count + 1,
    last_accessed = NOW()
  WHERE id = ANY(memory_ids);
END;
$$;

-- ── hybrid_search_memories (Wave 4) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION hybrid_search_memories(
  query_embedding VECTOR(1536),
  query_text TEXT,
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.5,
  keyword_weight FLOAT DEFAULT 0.5,
  min_score FLOAT DEFAULT 0.1,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  module TEXT,
  importance INT,
  access_count INT,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      am.id,
      am.content,
      am.memory_type,
      am.module,
      am.importance,
      am.access_count,
      1 - (am.embedding <=> query_embedding) AS v_score
    FROM agent_memories am
    WHERE am.status = 'active'
      AND am.embedding IS NOT NULL
      AND (filter_type IS NULL OR am.memory_type = filter_type)
  ),
  keyword_results AS (
    SELECT
      am.id,
      similarity(am.content, query_text) AS k_score
    FROM agent_memories am
    WHERE am.status = 'active'
      AND (filter_type IS NULL OR am.memory_type = filter_type)
      AND (
        am.content % query_text
        OR am.search_vector @@ websearch_to_tsquery('portuguese', query_text)
      )
  ),
  combined AS (
    SELECT
      v.id,
      v.content,
      v.memory_type,
      v.module,
      v.importance,
      v.access_count,
      COALESCE(v.v_score, 0)::FLOAT AS vector_score,
      COALESCE(k.k_score, 0)::FLOAT AS keyword_score,
      (
        COALESCE(v.v_score, 0) * vector_weight +
        COALESCE(k.k_score, 0) * keyword_weight
      )::FLOAT AS combined_score
    FROM vector_results v
    LEFT JOIN keyword_results k ON k.id = v.id
  )
  SELECT
    c.id, c.content, c.memory_type, c.module,
    c.importance, c.access_count,
    c.vector_score, c.keyword_score, c.combined_score
  FROM combined c
  WHERE c.combined_score >= min_score
  ORDER BY c.combined_score DESC
  LIMIT match_count;
END;
$$;

-- ── hybrid_search_memories_rrf (Wave 6) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION hybrid_search_memories_rrf(
  query_embedding VECTOR(1536),
  query_text TEXT,
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.6,
  keyword_weight FLOAT DEFAULT 0.4,
  rrf_k INT DEFAULT 60,
  min_score FLOAT DEFAULT 0.0,
  filter_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  module TEXT,
  importance INT,
  access_count INT,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT,
  vector_rank INT,
  keyword_rank INT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH
  vector_results AS (
    SELECT
      am.id,
      am.content,
      am.memory_type,
      am.module,
      am.importance,
      am.access_count,
      (1 - (am.embedding <=> query_embedding))::FLOAT AS v_score,
      ROW_NUMBER() OVER (ORDER BY am.embedding <=> query_embedding ASC)::INT AS v_rank
    FROM agent_memories am
    WHERE am.status = 'active'
      AND am.embedding IS NOT NULL
      AND (filter_type IS NULL OR am.memory_type = filter_type)
    ORDER BY am.embedding <=> query_embedding ASC
    LIMIT match_count * 3
  ),
  keyword_results AS (
    SELECT
      am.id,
      am.content,
      am.memory_type,
      am.module,
      am.importance,
      am.access_count,
      GREATEST(
        similarity(am.content, query_text),
        CASE WHEN am.content @@ websearch_to_tsquery('portuguese', query_text)
             THEN 0.3 ELSE 0.0 END
      )::FLOAT AS k_score,
      ROW_NUMBER() OVER (ORDER BY similarity(am.content, query_text) DESC)::INT AS k_rank
    FROM agent_memories am
    WHERE am.status = 'active'
      AND (filter_type IS NULL OR am.memory_type = filter_type)
      AND (
        am.content % query_text
        OR am.content @@ websearch_to_tsquery('portuguese', query_text)
      )
    ORDER BY similarity(am.content, query_text) DESC
    LIMIT match_count * 3
  ),
  rrf_combined AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.content, k.content) AS content,
      COALESCE(v.memory_type, k.memory_type) AS memory_type,
      COALESCE(v.module, k.module) AS module,
      COALESCE(v.importance, k.importance) AS importance,
      COALESCE(v.access_count, k.access_count) AS access_count,
      COALESCE(v.v_score, 0)::FLOAT AS vector_score,
      COALESCE(k.k_score, 0)::FLOAT AS keyword_score,
      (
        CASE WHEN v.v_rank IS NOT NULL
             THEN vector_weight / (rrf_k + v.v_rank)
             ELSE 0 END
        +
        CASE WHEN k.k_rank IS NOT NULL
             THEN keyword_weight / (rrf_k + k.k_rank)
             ELSE 0 END
      )::FLOAT AS combined_score,
      COALESCE(v.v_rank, match_count * 3 + 1)::INT AS vector_rank,
      COALESCE(k.k_rank, match_count * 3 + 1)::INT AS keyword_rank
    FROM vector_results v
    FULL OUTER JOIN keyword_results k ON v.id = k.id
  )
  SELECT
    r.id, r.content, r.memory_type, r.module,
    r.importance, r.access_count,
    r.vector_score, r.keyword_score, r.combined_score,
    r.vector_rank, r.keyword_rank
  FROM rrf_combined r
  WHERE r.combined_score >= min_score
  ORDER BY r.combined_score DESC
  LIMIT match_count;
END;
$$;

-- ── Re-grant permissions ────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION update_memory_embedding TO service_role;
GRANT EXECUTE ON FUNCTION match_memories TO service_role;
GRANT EXECUTE ON FUNCTION increment_memory_access TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_search_memories TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_search_memories_rrf TO service_role;

COMMIT;
