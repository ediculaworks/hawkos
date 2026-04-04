-- Add owner_email to admin.tenants for automatic tenant resolution at login.
-- Each email maps to exactly one workspace — no workspace selector needed.

BEGIN;

SET LOCAL search_path TO admin, public;

-- Add owner_email column
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
CREATE INDEX IF NOT EXISTS tenants_owner_email_idx ON tenants (owner_email) WHERE owner_email IS NOT NULL;

-- Populate owner_email for existing tenants by reading from each tenant schema.
-- Uses dynamic SQL since schema names are runtime values.
DO $$
DECLARE
  t RECORD;
  v_email TEXT;
BEGIN
  FOR t IN SELECT slug, schema_name FROM tenants WHERE status = 'active' LOOP
    BEGIN
      EXECUTE format(
        'SELECT email FROM %I.auth_users ORDER BY created_at LIMIT 1',
        t.schema_name
      ) INTO v_email;

      IF v_email IS NOT NULL THEN
        UPDATE tenants SET owner_email = v_email WHERE slug = t.slug;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Tenant schema may not exist yet (pending tenants) — skip silently
      NULL;
    END;
  END LOOP;
END $$;

COMMIT;
