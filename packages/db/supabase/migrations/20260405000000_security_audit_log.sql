BEGIN;

-- Security audit log table
CREATE TABLE IF NOT EXISTS security_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES security_items(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  old_status  TEXT,
  new_status  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient per-item queries
CREATE INDEX IF NOT EXISTS idx_security_audit_log_item_id ON security_audit_log(item_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at DESC);

-- RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rls_security_audit_log" ON security_audit_log USING (true);

-- Add missing columns to security_items if not present
ALTER TABLE security_items
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMIT;
