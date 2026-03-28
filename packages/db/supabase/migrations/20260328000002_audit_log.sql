-- Audit logging for critical data mutations
BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,        -- 'transaction', 'person', 'habit', etc.
  entity_id TEXT NOT NULL,          -- UUID of the entity
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changes JSONB DEFAULT '{}',       -- { field: { old: X, new: Y } }
  performed_by TEXT DEFAULT 'agent', -- 'agent', 'web', 'automation'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON audit_log
  FOR SELECT TO authenticated USING (true);

-- Auto-audit trigger for finance_transactions
CREATE OR REPLACE FUNCTION audit_finance_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES ('transaction', NEW.id::text, 'create', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES ('transaction', NEW.id::text, 'update', jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES ('transaction', OLD.id::text, 'delete', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_finance_transaction ON finance_transactions;
CREATE TRIGGER trg_audit_finance_transaction
  AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_finance_transaction();

-- Auto-audit trigger for health_observations
CREATE OR REPLACE FUNCTION audit_health_observation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES ('health_observation', NEW.id::text, 'create', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (entity_type, entity_id, action, changes)
    VALUES ('health_observation', OLD.id::text, 'delete', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_health_observation ON health_observations;
CREATE TRIGGER trg_audit_health_observation
  AFTER INSERT OR DELETE ON health_observations
  FOR EACH ROW EXECUTE FUNCTION audit_health_observation();

COMMIT;
