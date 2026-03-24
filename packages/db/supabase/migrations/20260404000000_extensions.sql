-- Extension connections: stores OAuth tokens and config for external integrations
BEGIN;

CREATE TABLE IF NOT EXISTS extension_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INT DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ext_conn_extension_id ON extension_connections(extension_id);
CREATE INDEX idx_ext_conn_status ON extension_connections(status);

ALTER TABLE extension_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY extension_connections_all ON extension_connections FOR ALL USING (true);

CREATE TRIGGER extension_connections_updated_at
  BEFORE UPDATE ON extension_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- GitHub synced data
CREATE TABLE IF NOT EXISTS github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  language TEXT,
  stars INT DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  is_fork BOOLEAN DEFAULT false,
  last_pushed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  repo_full_name TEXT NOT NULL,
  number INT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  created_at_gh TIMESTAMPTZ,
  merged_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE github_repos ENABLE ROW LEVEL SECURITY;
CREATE POLICY github_repos_all ON github_repos FOR ALL USING (true);

ALTER TABLE github_pull_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY github_pull_requests_all ON github_pull_requests FOR ALL USING (true);

-- ClickUp synced data
CREATE TABLE IF NOT EXISTS clickup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clickup_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT,
  priority INT,
  list_name TEXT,
  space_name TEXT,
  url TEXT,
  due_date TIMESTAMPTZ,
  assignees JSONB DEFAULT '[]',
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clickup_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY clickup_tasks_all ON clickup_tasks FOR ALL USING (true);

CREATE TRIGGER clickup_tasks_updated_at
  BEFORE UPDATE ON clickup_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
