-- Agent Settings: configurações globais do agente
BEGIN;

CREATE TABLE IF NOT EXISTS agent_settings (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  agent_name TEXT NOT NULL DEFAULT 'Hawk',
  system_prompt_path TEXT NOT NULL DEFAULT 'apps/agent/groups/main/CLAUDE.md',
  llm_model TEXT NOT NULL DEFAULT 'openrouter/auto',
  temperature DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  heartbeat_interval INTEGER NOT NULL DEFAULT 30,
  offline_threshold INTEGER NOT NULL DEFAULT 60,
  auto_restart BOOLEAN NOT NULL DEFAULT true,
  enabled_channels TEXT[] NOT NULL DEFAULT ARRAY['discord', 'web'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_settings;
CREATE POLICY "Allow public read access"
  ON agent_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_settings;
CREATE POLICY "Allow service role write access"
  ON agent_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO agent_settings (id, agent_name)
VALUES ('singleton', 'Hawk')
ON CONFLICT (id) DO NOTHING;

COMMIT;
