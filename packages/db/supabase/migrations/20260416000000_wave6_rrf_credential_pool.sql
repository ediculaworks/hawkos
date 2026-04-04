-- Wave 6: Intelligence & Cost Patterns
-- 1. Weighted RRF for hybrid search
-- 2. Credential pool table for multi-key rotation
BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. Weighted RRF Hybrid Search
--    Replaces simple weighted sum with Reciprocal Rank Fusion.
--    RRF(d) = Σ (weight_i / (k + rank_i(d)))
--    where k is a smoothing constant (default 60).
-- ═══════════════════════════════════════════════════════════

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
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Vector search: rank by cosine similarity
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
  -- Keyword search: rank by trigram similarity
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
  -- RRF combination: reciprocal rank fusion
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
      -- RRF formula: weight / (k + rank)
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

-- ═══════════════════════════════════════════════════════════
-- 2. Credential Pool Table
--    Stores multiple API keys per provider for rotation.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credential_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,          -- 'openrouter', 'anthropic', 'groq', etc.
  label TEXT,                      -- human-readable label for this key
  api_key_encrypted BYTEA NOT NULL,
  api_key_iv BYTEA NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'round_robin'
    CHECK (strategy IN ('fill_first', 'round_robin', 'least_used')),
  priority INT NOT NULL DEFAULT 0, -- lower = higher priority (for fill_first)
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Usage tracking
  total_calls INT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,      -- temporary disable after rate limit
  -- Metadata
  rate_limit_rpm INT,              -- known rate limit (requests/min)
  daily_limit INT,                 -- known daily limit
  daily_calls INT NOT NULL DEFAULT 0,
  daily_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credential_pool_provider ON credential_pool (provider, enabled, priority);

ALTER TABLE credential_pool ENABLE ROW LEVEL SECURITY;

COMMIT;
