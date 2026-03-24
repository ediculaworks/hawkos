-- Agent Status: real-time status for Mission Control dashboard
BEGIN;

CREATE TABLE IF NOT EXISTS agent_status (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'restarting')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT,
  environment TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON agent_status;
CREATE POLICY "Allow public read access"
  ON agent_status FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow service role write access" ON agent_status;
CREATE POLICY "Allow service role write access"
  ON agent_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial status if not exists
INSERT INTO agent_status (id, status, environment, version)
VALUES ('singleton', 'online', 'development', '0.1.0')
ON CONFLICT (id) DO NOTHING;

COMMIT;
