-- Onboarding: Campos necessários para setup completo de novo tenant
BEGIN;

-- Campos adicionais na profile
ALTER TABLE profile ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS tenant_slot TEXT;

-- Tabela de configurações de integração
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profile(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, provider)
);

ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_only" ON integration_configs;
CREATE POLICY "auth_only" ON integration_configs FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_integration_configs_profile ON integration_configs(profile_id);

-- Tabela de slots de tenant
CREATE TABLE IF NOT EXISTS tenant_slots (
  slot TEXT PRIMARY KEY,
  supabase_url TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  occupied BOOLEAN DEFAULT false,
  occupied_by UUID REFERENCES profile(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tenant_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_only" ON tenant_slots;
CREATE POLICY "auth_only" ON tenant_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_only_write" ON tenant_slots FOR ALL TO service_role USING (true);

COMMIT;
