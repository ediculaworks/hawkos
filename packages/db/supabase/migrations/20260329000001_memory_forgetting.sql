BEGIN;

-- Add archive status for old memories
-- Memories not accessed in 6+ months with low importance get archived

-- View to find archivable memories
CREATE OR REPLACE VIEW archivable_memories AS
SELECT id, content, memory_type, module, importance, access_count, updated_at,
  EXTRACT(EPOCH FROM (now() - updated_at)) / 86400 AS days_since_update
FROM agent_memories
WHERE status = 'active'
  AND importance <= 3
  AND access_count <= 2
  AND updated_at < now() - INTERVAL '180 days';

-- Function to archive old memories (called by automation)
CREATE OR REPLACE FUNCTION archive_stale_memories()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE agent_memories
  SET status = 'archived'
  WHERE id IN (SELECT id FROM archivable_memories)
  RETURNING count(*) INTO archived_count;

  RETURN COALESCE(archived_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMIT;
