-- Agent-to-Agent Communication System
-- Enables agents to send messages and handoffs to each other
BEGIN;

-- Agent messages: async communication between agents
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID REFERENCES agent_templates(id) ON DELETE CASCADE,
  to_agent_id UUID REFERENCES agent_templates(id) ON DELETE CASCADE,
  session_id TEXT,
  message_type TEXT DEFAULT 'message' CHECK (message_type IN ('message', 'handoff', 'query', 'response')),
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
  related_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_status ON agent_messages(status);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_messages;
CREATE POLICY "Allow public read access"
  ON agent_messages FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_messages;
CREATE POLICY "Allow service role write access"
  ON agent_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Agent capabilities: what each agent can do
CREATE TABLE IF NOT EXISTS agent_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_templates(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent ON agent_capabilities(agent_id);

ALTER TABLE agent_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_capabilities;
CREATE POLICY "Allow public read access"
  ON agent_capabilities FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_capabilities;
CREATE POLICY "Allow service role write access"
  ON agent_capabilities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Default capabilities for Hawk
INSERT INTO agent_capabilities (agent_id, capability, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'coordination', 'Coordenar outros agentes'),
  ('00000000-0000-0000-0000-000000000001', 'handoff', 'Transferir contexto para outro agente'),
  ('00000000-0000-0000-0000-000000000001', 'query_agent', 'Perguntar a outro agente')
ON CONFLICT DO NOTHING;

COMMIT;
