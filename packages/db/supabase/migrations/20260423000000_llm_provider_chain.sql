-- Per-tenant LLM provider chain configuration
-- Stored in admin schema (shared across all tenants)
-- Each row = one entry in the fallback chain for a specific tenant

BEGIN;

CREATE TABLE IF NOT EXISTS admin.tenant_llm_chain (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES admin.tenants(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'all'
    CHECK (tier IN ('simple', 'moderate', 'complex', 'all')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, priority)
);

CREATE INDEX idx_tenant_llm_chain_tenant
  ON admin.tenant_llm_chain(tenant_id)
  WHERE enabled = true;

-- RLS: only service_role can access (agent + admin actions run as service_role)
ALTER TABLE admin.tenant_llm_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON admin.tenant_llm_chain
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
