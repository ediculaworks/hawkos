-- Memory System: conversation history + long-term memories + archival summaries
BEGIN;

-- Conversation messages (full chat history)
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'discord',
  tokens_used INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conv_messages_session ON conversation_messages(session_id, created_at);
CREATE INDEX idx_conv_messages_created ON conversation_messages(created_at DESC);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Agent memories (extracted long-term facts)
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'preference', 'fact', 'pattern', 'insight', 'correction', 'goal', 'relationship'
  )),
  content TEXT NOT NULL,
  module TEXT,
  related_modules TEXT[] DEFAULT '{}',
  source_message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  confidence REAL DEFAULT 1.0 CHECK (confidence BETWEEN 0.0 AND 1.0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected', 'archived')),
  last_accessed TIMESTAMPTZ DEFAULT now(),
  access_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_category ON agent_memories(category, status);
CREATE INDEX idx_memories_module ON agent_memories(module) WHERE module IS NOT NULL;
CREATE INDEX idx_memories_importance ON agent_memories(importance DESC) WHERE status = 'active';
CREATE INDEX idx_memories_status ON agent_memories(status, created_at DESC);

-- Full-text search on memory content (Portuguese)
ALTER TABLE agent_memories ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
CREATE INDEX IF NOT EXISTS idx_memories_fts ON agent_memories USING GIN(search_vector);

CREATE OR REPLACE FUNCTION agent_memories_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_memories_search_vector_trigger ON agent_memories;
CREATE TRIGGER agent_memories_search_vector_trigger
  BEFORE INSERT OR UPDATE ON agent_memories
  FOR EACH ROW EXECUTE FUNCTION agent_memories_search_vector_update();

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Trigger: update updated_at on agent_memories
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memory_updated
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW EXECUTE FUNCTION update_memory_timestamp();

-- Conversation summaries (archival compaction)
CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  summary TEXT NOT NULL,
  key_memories_extracted UUID[] DEFAULT '{}',
  message_count INTEGER NOT NULL,
  first_message_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conv_summaries_session ON conversation_summaries(session_id);

ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

COMMIT;
