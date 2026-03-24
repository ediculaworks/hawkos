-- Tool Configs: enable/disable de tools
BEGIN;

CREATE TABLE IF NOT EXISTS tool_configs (
  tool_name TEXT PRIMARY KEY,
  module_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  parameters JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tool_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON tool_configs;
CREATE POLICY "Allow public read access"
  ON tool_configs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON tool_configs;
CREATE POLICY "Allow service role write access"
  ON tool_configs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
