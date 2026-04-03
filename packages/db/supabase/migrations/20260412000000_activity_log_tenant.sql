-- Add tenant_id to activity_log for multi-tenant observability
BEGIN;

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant
  ON activity_log (tenant_id, created_at DESC);

COMMIT;
