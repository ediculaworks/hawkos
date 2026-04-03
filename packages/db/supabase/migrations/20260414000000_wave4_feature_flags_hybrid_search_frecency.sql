-- Wave 4: Feature Flags + Hybrid Search + Frecency Scoring
-- ────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- 1. PER-TENANT FEATURE FLAGS
-- ═══════════════════════════════════════════════════════════

-- Add feature_flags column to tenants table (admin schema)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tenants.feature_flags IS
  'Per-tenant feature toggles. Keys are flag names, values are booleans. Checked via getFeatureFlag() utility.';

-- ═══════════════════════════════════════════════════════════
-- 2. HYBRID SEARCH (pg_trgm + pgvector)
-- ═══════════════════════════════════════════════════════════

-- Enable pg_trgm extension for fuzzy keyword matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on memory content for fast keyword matching
CREATE INDEX IF NOT EXISTS idx_memories_content_trgm
  ON agent_memories USING gin (content gin_trgm_ops);

-- Hybrid search function: combines vector similarity + keyword relevance
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
        am.content % query_text  -- trigram similarity threshold
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

    UNION

    -- Include keyword-only matches (no embedding match)
    SELECT
      am.id,
      am.content,
      am.memory_type,
      am.module,
      am.importance,
      am.access_count,
      0::FLOAT AS vector_score,
      k.k_score::FLOAT AS keyword_score,
      (k.k_score * keyword_weight)::FLOAT AS combined_score
    FROM keyword_results k
    JOIN agent_memories am ON am.id = k.id
    WHERE k.id NOT IN (SELECT vr.id FROM vector_results vr)
  )
  SELECT
    c.id,
    c.content,
    c.memory_type,
    c.module,
    c.importance,
    c.access_count,
    c.vector_score,
    c.keyword_score,
    c.combined_score
  FROM combined c
  WHERE c.combined_score >= min_score
  ORDER BY c.combined_score DESC
  LIMIT match_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 3. FRECENCY TRACKING
-- ═══════════════════════════════════════════════════════════

-- Track module/page access for frecency scoring
CREATE TABLE IF NOT EXISTS module_access_log (
  id BIGSERIAL PRIMARY KEY,
  module_id TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'page_view'
    CHECK (access_type IN ('page_view', 'widget_interact', 'tool_call', 'search')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_access_module
  ON module_access_log (module_id);
CREATE INDEX IF NOT EXISTS idx_module_access_created
  ON module_access_log (created_at DESC);

-- Materialized view for fast frecency scores
CREATE MATERIALIZED VIEW IF NOT EXISTS module_frecency AS
SELECT
  module_id,
  COUNT(*) AS total_access,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS access_7d,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '1 day') AS access_1d,
  MAX(created_at) AS last_accessed,
  -- Frecency score: recent accesses weighted more heavily
  (
    COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '1 day') * 10.0 +
    COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') * 3.0 +
    COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') * 1.0
  ) AS frecency_score
FROM module_access_log
GROUP BY module_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_module_frecency_id
  ON module_frecency (module_id);

-- Function to refresh frecency (call periodically or on-demand)
CREATE OR REPLACE FUNCTION refresh_module_frecency()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY module_frecency;
END;
$$;

-- Prune old access logs (keep 90 days)
CREATE OR REPLACE FUNCTION prune_module_access_log()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM module_access_log
  WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 4. ACTIVITY LOG ENHANCEMENT (add 'user_confirmation' type)
-- ═══════════════════════════════════════════════════════════

-- Expand event_type to include tool approval events
ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_event_type_check;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_event_type_check
  CHECK (event_type IN (
    'tool_call',
    'automation',
    'alert',
    'memory_created',
    'memory_merged',
    'session_committed',
    'command',
    'error',
    'tool_approved',
    'tool_denied'
  ));

COMMIT;
