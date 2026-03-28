-- Memory knowledge graph: link related memories for multi-hop retrieval
BEGIN;

CREATE TABLE IF NOT EXISTS memory_links (
  id BIGSERIAL PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES agent_memories(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'related_to',     -- general semantic relation
    'caused_by',      -- causal link (event -> event)
    'part_of',        -- hierarchy (entity -> entity)
    'contradicts',    -- conflicting memories
    'supersedes',     -- newer version of same info
    'references'      -- one memory mentions the other
  )),
  strength REAL NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX idx_memory_links_source ON memory_links(source_id);
CREATE INDEX idx_memory_links_target ON memory_links(target_id);
CREATE INDEX idx_memory_links_relation ON memory_links(relation_type);

ALTER TABLE memory_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON memory_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON memory_links
  FOR SELECT TO authenticated USING (true);

COMMIT;
