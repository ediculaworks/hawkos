BEGIN;

-- Add L0/L1 layers and hierarchical path to agent_memories (OpenViking integration)
ALTER TABLE agent_memories
  ADD COLUMN IF NOT EXISTS path TEXT,
  ADD COLUMN IF NOT EXISTS l0_abstract TEXT,
  ADD COLUMN IF NOT EXISTS l1_overview TEXT;

-- Index for hierarchical path lookups
CREATE INDEX IF NOT EXISTS idx_agent_memories_path
  ON agent_memories (path);

COMMENT ON COLUMN agent_memories.path IS 'Hierarchical path (e.g. user/preferences/health)';
COMMENT ON COLUMN agent_memories.l0_abstract IS 'L0: ~15 words, optimized for vector search (~100 tokens)';
COMMENT ON COLUMN agent_memories.l1_overview IS 'L1: 2 paragraphs with key facts and usage hints (~500 tokens)';

COMMIT;
