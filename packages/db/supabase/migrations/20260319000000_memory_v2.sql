-- Memory V2: OpenViking-inspired memory system
-- Adds: memory types with merge semantics, vector embeddings, hotness scoring, session archives
BEGIN;

-- ── Enable pgvector extension ──────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Expand agent_memories with new capabilities ────────────

-- Add memory_type (OpenViking 6-category system)
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS
  memory_type TEXT NOT NULL DEFAULT 'profile'
  CHECK (memory_type IN (
    'profile',      -- user identity/attributes (append-only merge)
    'preference',   -- user preferences by topic (mergeable)
    'entity',       -- people, projects, places (mergeable)
    'event',        -- decisions, milestones, happenings (non-mergeable)
    'case',         -- problem + solution learned (non-mergeable)
    'pattern'       -- reusable process/method (mergeable)
  ));

-- Vector embedding for semantic search
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS
  embedding VECTOR(1536);

-- Session that originated this memory
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS
  origin_session_id UUID;

-- Whether this memory type supports merging
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS
  mergeable BOOLEAN NOT NULL DEFAULT true;

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON agent_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for hotness-based retrieval (access_count + updated_at already exist)
CREATE INDEX IF NOT EXISTS idx_memories_hotness
  ON agent_memories (access_count DESC, updated_at DESC)
  WHERE status = 'active';

-- Index for memory_type filtering
CREATE INDEX IF NOT EXISTS idx_memories_type
  ON agent_memories (memory_type, status);

-- ── Session archives (compressed session history) ──────────

CREATE TABLE IF NOT EXISTS session_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'discord',
  message_count INTEGER NOT NULL,
  abstract TEXT NOT NULL,         -- L0: ~100 tokens summary
  overview TEXT NOT NULL,          -- L1: ~2k tokens detailed summary
  messages JSONB NOT NULL,         -- original messages (compressed)
  memories_extracted INTEGER DEFAULT 0,
  token_count INTEGER,             -- estimated tokens in original session
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_archives_session ON session_archives (session_id);
CREATE INDEX IF NOT EXISTS idx_session_archives_channel ON session_archives (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_archives_created ON session_archives (created_at DESC);

ALTER TABLE session_archives ENABLE ROW LEVEL SECURITY;

-- ── Add archived flag to conversation_messages ─────────────

ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS
  archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conv_messages_archived
  ON conversation_messages (archived, session_id)
  WHERE archived = false;

-- ── Backfill memory_type from existing category ────────────

UPDATE agent_memories SET memory_type = CASE
  WHEN category = 'preference' THEN 'preference'
  WHEN category = 'fact' THEN 'profile'
  WHEN category = 'pattern' THEN 'pattern'
  WHEN category = 'insight' THEN 'case'
  WHEN category = 'correction' THEN 'case'
  WHEN category = 'goal' THEN 'event'
  WHEN category = 'relationship' THEN 'entity'
  ELSE 'profile'
END;

-- Backfill mergeable based on memory_type
UPDATE agent_memories SET mergeable = CASE
  WHEN memory_type IN ('profile', 'preference', 'entity', 'pattern') THEN true
  ELSE false
END;

COMMIT;
