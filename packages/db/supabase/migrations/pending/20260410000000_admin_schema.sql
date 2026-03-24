-- Admin Supabase Schema - Hawk OS Multi-Tenant Platform
-- Project: hawkos (https://mglzbxtiyzgqeszscppy.supabase.co)
BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANTS TABLE - Registry de todos os tenants
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    supabase_url TEXT NOT NULL,
    supabase_anon_key TEXT NOT NULL,
    supabase_service_key_encrypted TEXT NOT NULL,
    supabase_service_key_iv TEXT NOT NULL,
    discord_config JSONB DEFAULT '{}',
    openrouter_config JSONB DEFAULT '{}',
    agent_port INTEGER NOT NULL,
    agent_secret TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
    onboarding_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_created_by ON tenants(created_by);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANT_INTEGRATIONS TABLE - Conexões externas por tenant
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('discord', 'openrouter', 'google', 'anthropic', 'github', 'clickup', 'groq')),
    config_encrypted JSONB NOT NULL DEFAULT '{}',
    config_iv TEXT,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_tenant_integrations_tenant ON tenant_integrations(tenant_id);
CREATE INDEX idx_tenant_integrations_provider ON tenant_integrations(provider);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANT_MODULES TABLE - Módulos ativos por tenant
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, module_id)
);

CREATE INDEX idx_tenant_modules_tenant ON tenant_modules(tenant_id);
CREATE INDEX idx_tenant_modules_module ON tenant_modules(module_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANT_AUDIT TABLE - Logs de eventos para monitoramento (sem dados sensíveis)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_audit (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('login', 'token_usage', 'api_call', 'automation_run', 'module_enabled', 'module_disabled', 'migration_applied', 'error')),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error')),
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenant_audit_tenant ON tenant_audit(tenant_id);
CREATE INDEX idx_tenant_audit_type ON tenant_audit(event_type);
CREATE INDEX idx_tenant_audit_created ON tenant_audit(created_at);
CREATE INDEX idx_tenant_audit_tenant_created ON tenant_audit(tenant_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANT_METRICS TABLE - Métricas acumuladas para dashboard (dados agregados)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_metrics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_used INTEGER DEFAULT 0,
    tokens_cost_usd DECIMAL(10,4) DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    automation_runs INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    login_count INTEGER DEFAULT 0,
    modules_enabled INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_tenant_metrics_tenant ON tenant_metrics(tenant_id);
CREATE INDEX idx_tenant_metrics_date ON tenant_metrics(date DESC);
CREATE INDEX idx_tenant_metrics_tenant_date ON tenant_metrics(tenant_id, date DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- ADMIN_USERS TABLE - Quem pode acessar o painel admin
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    invited_by UUID REFERENCES auth.users(id)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- TENANT_AVAILABILITY VIEW - Slots disponíveis para onboarding
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW tenant_availability AS
SELECT 
    slot.slot_number,
    slot.slot_name,
    CASE 
        WHEN t.id IS NOT NULL THEN 'occupied'
        WHEN t.status = 'pending' THEN 'pending'
        ELSE 'available'
    END AS status,
    t.id AS tenant_id,
    t.label AS tenant_label,
    t.status AS tenant_status,
    t.onboarding_completed_at,
    t.created_at
FROM 
    (VALUES 
        (1, 'ten1'), (2, 'ten2'), (3, 'ten3'),
        (4, 'ten4'), (5, 'ten5'), (6, 'ten6')
    ) AS slot(slot_number, slot_name)
LEFT JOIN tenants t ON t.slug = slot.slot_name;

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policies para tenants
DROP POLICY IF EXISTS "service_role_all_tenants" ON tenants;
CREATE POLICY "service_role_all_tenants" ON tenants FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "auth_read_own_tenant" ON tenants;
CREATE POLICY "auth_read_own_tenant" ON tenants FOR SELECT TO authenticated USING (
    id IN (SELECT id FROM tenants WHERE created_by = auth.uid())
);

-- Policies para tenant_integrations
DROP POLICY IF EXISTS "service_role_all_integrations" ON tenant_integrations;
CREATE POLICY "service_role_all_integrations" ON tenant_integrations FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "auth_manage_own_integrations" ON tenant_integrations;
CREATE POLICY "auth_manage_own_integrations" ON tenant_integrations FOR ALL TO authenticated USING (
    tenant_id IN (SELECT id FROM tenants WHERE created_by = auth.uid())
);

-- Policies para tenant_modules
DROP POLICY IF EXISTS "service_role_all_modules" ON tenant_modules;
CREATE POLICY "service_role_all_modules" ON tenant_modules FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "auth_manage_own_modules" ON tenant_modules;
CREATE POLICY "auth_manage_own_modules" ON tenant_modules FOR ALL TO authenticated USING (
    tenant_id IN (SELECT id FROM tenants WHERE created_by = auth.uid())
);

-- Policies para tenant_audit (insert only para auth)
DROP POLICY IF EXISTS "service_role_all_audit" ON tenant_audit;
CREATE POLICY "service_role_all_audit" ON tenant_audit FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "auth_insert_own_audit" ON tenant_audit;
CREATE POLICY "auth_insert_own_audit" ON tenant_audit FOR INSERT TO authenticated WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE created_by = auth.uid())
);

-- Policies para tenant_metrics (service_role only)
DROP POLICY IF EXISTS "service_role_all_metrics" ON tenant_metrics;
CREATE POLICY "service_role_all_metrics" ON tenant_metrics FOR ALL TO service_role USING (true);

-- Policies para admin_users
DROP POLICY IF EXISTS "service_role_all_admin_users" ON admin_users;
CREATE POLICY "service_role_all_admin_users" ON admin_users FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "admins_manage" ON admin_users;
CREATE POLICY "admins_manage" ON admin_users FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'admin')
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED: Lucas como primeiro admin (será adicionado após Lucas criar conta)
-- ══════════════════════════════════════════════════════════════════════════════
-- INSERT INTO admin_users (user_id, email, role) 
-- VALUES ('[LUCAS_USER_ID]', 'lucas@email.com', 'admin')
-- ON CONFLICT (user_id) DO NOTHING;

COMMIT;