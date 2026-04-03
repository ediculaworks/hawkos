-- =============================================================================
-- Hawk OS — PostgreSQL Initialization
-- Runs once on first container start.
-- Creates extensions, roles, and the admin schema.
-- =============================================================================

-- Extensions (pgvector comes with the image, others are contrib)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Roles ───────────────────────────────────────────────────────────────────
-- "authenticated" role referenced by RLS policies (mirrors Supabase convention)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;

-- Grant default privileges so authenticated role can access tenant schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- ── Admin Schema ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS admin;

-- Tenant registry
CREATE TABLE IF NOT EXISTS admin.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,           -- ten1, ten2, ...
  label TEXT NOT NULL DEFAULT '',
  schema_name TEXT UNIQUE NOT NULL,    -- tenant_ten1, tenant_ten2, ...
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, suspended
  agent_port INTEGER,
  agent_secret TEXT,
  -- Encrypted configs for external services (Discord, OpenRouter)
  discord_config_encrypted TEXT,
  discord_config_iv TEXT,
  openrouter_config_encrypted TEXT,
  openrouter_config_iv TEXT,
  key_salt TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Modules enabled per tenant
CREATE TABLE IF NOT EXISTS admin.tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES admin.tenants(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, module_id)
);

-- External integration configs (encrypted)
CREATE TABLE IF NOT EXISTS admin.tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES admin.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config_encrypted TEXT NOT NULL,
  config_iv TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- Audit log
CREATE TABLE IF NOT EXISTS admin.tenant_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES admin.tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tenant metrics
CREATE TABLE IF NOT EXISTS admin.tenant_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES admin.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON admin.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON admin.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON admin.tenant_modules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON admin.tenant_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant ON admin.tenant_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_created ON admin.tenant_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_metrics_tenant_date ON admin.tenant_metrics(tenant_id, date);

-- updated_at trigger for admin tables
CREATE OR REPLACE FUNCTION admin.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON admin.tenants
  FOR EACH ROW EXECUTE FUNCTION admin.update_updated_at();

CREATE TRIGGER tenant_integrations_updated_at
  BEFORE UPDATE ON admin.tenant_integrations
  FOR EACH ROW EXECUTE FUNCTION admin.update_updated_at();
