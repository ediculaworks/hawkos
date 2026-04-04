-- =============================================================================
-- Migration: auth_users table
-- Creates the auth_users table referenced by packages/auth/src/index.ts.
-- Works in per-tenant schemas (each tenant gets its own auth_users table).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER auth_users_updated_at
  BEFORE UPDATE ON auth_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON auth_users FOR ALL TO authenticated USING (true);
ALTER TABLE auth_users FORCE ROW LEVEL SECURITY;

COMMIT;
