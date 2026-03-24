-- Activity Log: system-wide audit trail for Mission Control dashboard
BEGIN;

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'tool_call',
    'automation',
    'alert',
    'memory_created',
    'memory_merged',
    'session_committed',
    'command',
    'error'
  )),
  module TEXT,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log (module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log (event_type, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

COMMIT;
