import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { decrypt, encrypt, generateAgentSecret } from './crypto';
import type {
  AdminUser,
  CreateTenantResult,
  DiscordConfig,
  IntegrationConfigMap,
  IntegrationProvider,
  OpenRouterConfig,
  Tenant,
  TenantAudit,
  TenantAvailability,
  TenantInsert,
  TenantIntegration,
  TenantMetrics,
  TenantModule,
  TenantUpdate,
  ValidateCredentialsResult,
} from './types.js';

export interface AdminClientConfig {
  adminUrl: string;
  adminServiceKey: string;
}

export class AdminClient {
  private supabase: SupabaseClient;
  private masterKey: string;

  constructor(config: AdminClientConfig) {
    this.supabase = createClient(config.adminUrl, config.adminServiceKey, {
      auth: { persistSession: false },
    });
    this.masterKey = config.adminServiceKey;
  }

  async getAvailableSlots(): Promise<TenantAvailability[]> {
    const { data, error } = await this.supabase
      .from('tenant_availability')
      .select('*')
      .order('slot_number');
    if (error) throw error;
    return data || [];
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) return null;
    return data;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase.from('tenants').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }

  async listTenants(): Promise<Tenant[]> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async validateCredentials(
    supabaseUrl: string,
    anonKey: string,
    _serviceKey: string,
  ): Promise<ValidateCredentialsResult> {
    try {
      const testClient = createClient(supabaseUrl, anonKey);

      const { error } = await testClient.from('profile').select('count').limit(0);
      if (error) {
        return { valid: false, error: error.message };
      }

      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  }

  async createTenant(
    data: {
      label: string;
      supabaseUrl: string;
      supabaseAnonKey: string;
      supabaseServiceKey: string;
      discordConfig?: DiscordConfig;
      openrouterConfig?: OpenRouterConfig;
    },
    userId?: string,
  ): Promise<CreateTenantResult> {
    const slots = await this.getAvailableSlots();
    const availableSlot = slots.find((s) => s.status === 'available');

    if (!availableSlot) {
      return { success: false, error: 'No available slots' };
    }

    const { encrypted, iv } = encrypt(data.supabaseServiceKey, this.masterKey);
    const agentSecret = generateAgentSecret();
    const slug = availableSlot.slot_name;

    const tenantData: TenantInsert = {
      slug,
      label: data.label,
      supabase_url: data.supabaseUrl,
      supabase_anon_key: data.supabaseAnonKey,
      supabase_service_key_encrypted: encrypted,
      supabase_service_key_iv: iv,
      discord_config: data.discordConfig || {},
      openrouter_config: data.openrouterConfig || {},
      agent_port: 3000 + availableSlot.slot_number,
      agent_secret: agentSecret,
      created_by: userId,
    };

    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .insert(tenantData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, tenant: tenant as Tenant };
  }

  async updateTenant(id: string, data: Partial<TenantUpdate>): Promise<Tenant> {
    if (data.supabase_service_key_encrypted && data.supabase_service_key_iv) {
      // Already encrypted, don't re-encrypt
    } else if (data.supabase_service_key_encrypted === '' && data.supabase_service_key_iv === '') {
      // Clearing
    }

    const { data: tenant, error } = await this.supabase
      .from('tenants')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    const { error } = await this.supabase.from('tenants').delete().eq('id', id);
    if (error) throw error;
  }

  async getDecryptedServiceKey(tenantId: string): Promise<string> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    return decrypt(
      tenant.supabase_service_key_encrypted,
      tenant.supabase_service_key_iv,
      this.masterKey,
    );
  }

  async getTenantCredentials(tenantId: string): Promise<{
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceKey: string;
  }> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const serviceKey = await this.getDecryptedServiceKey(tenantId);

    return {
      supabaseUrl: tenant.supabase_url,
      supabaseAnonKey: tenant.supabase_anon_key,
      supabaseServiceKey: serviceKey,
    };
  }

  async listTenantModules(tenantId: string): Promise<TenantModule[]> {
    const { data, error } = await this.supabase
      .from('tenant_modules')
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return data || [];
  }

  async setTenantModules(
    tenantId: string,
    modules: Array<{ module_id: string; enabled: boolean; config?: Record<string, unknown> }>,
  ): Promise<void> {
    await this.supabase.from('tenant_modules').delete().eq('tenant_id', tenantId);

    if (modules.length > 0) {
      const insertData = modules.map((m) => ({
        tenant_id: tenantId,
        module_id: m.module_id,
        enabled: m.enabled,
        config: m.config || {},
      }));

      const { error } = await this.supabase.from('tenant_modules').insert(insertData);
      if (error) throw error;
    }
  }

  // ── Integration CRUD ─────────────────────────────────────────────────

  async listTenantIntegrations(tenantId: string): Promise<TenantIntegration[]> {
    const { data, error } = await this.supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('provider');
    if (error) throw error;
    return data || [];
  }

  async getTenantIntegration(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<TenantIntegration | null> {
    const { data, error } = await this.supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertTenantIntegration(
    tenantId: string,
    provider: IntegrationProvider,
    config: Record<string, unknown>,
    enabled: boolean,
  ): Promise<TenantIntegration> {
    const { encrypted, iv } = encrypt(JSON.stringify(config), this.masterKey);

    const { data, error } = await this.supabase
      .from('tenant_integrations')
      .upsert(
        {
          tenant_id: tenantId,
          provider,
          config_encrypted: encrypted,
          config_iv: iv,
          enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider' },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTenantIntegration(tenantId: string, provider: IntegrationProvider): Promise<void> {
    const { error } = await this.supabase
      .from('tenant_integrations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', provider);
    if (error) throw error;
  }

  getDecryptedIntegrationConfig<P extends IntegrationProvider>(
    integration: TenantIntegration,
  ): IntegrationConfigMap[P] {
    if (!integration.config_encrypted || !integration.config_iv) {
      return {} as IntegrationConfigMap[P];
    }
    const json = decrypt(integration.config_encrypted, integration.config_iv, this.masterKey);
    return JSON.parse(json) as IntegrationConfigMap[P];
  }

  async getDecryptedIntegrations(
    tenantId: string,
  ): Promise<Map<IntegrationProvider, { config: Record<string, unknown>; enabled: boolean }>> {
    const integrations = await this.listTenantIntegrations(tenantId);
    const result = new Map<
      IntegrationProvider,
      { config: Record<string, unknown>; enabled: boolean }
    >();

    for (const integration of integrations) {
      const config = this.getDecryptedIntegrationConfig(integration) as Record<string, unknown>;
      result.set(integration.provider, { config, enabled: integration.enabled });
    }

    return result;
  }

  async updateTenantDiscordConfig(tenantId: string, config: DiscordConfig): Promise<void> {
    const { encrypted, iv } = encrypt(JSON.stringify(config), this.masterKey);
    const { error } = await this.supabase
      .from('tenants')
      .update({
        discord_config_encrypted: encrypted,
        discord_config_iv: iv,
        discord_config: { _encrypted: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
    if (error) throw error;
  }

  async updateTenantOpenRouterConfig(tenantId: string, config: OpenRouterConfig): Promise<void> {
    const { encrypted, iv } = encrypt(JSON.stringify(config), this.masterKey);
    const { error } = await this.supabase
      .from('tenants')
      .update({
        openrouter_config_encrypted: encrypted,
        openrouter_config_iv: iv,
        openrouter_config: { _encrypted: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);
    if (error) throw error;
  }

  // ── Audit & Metrics ────────────────────────────────────────────────

  async logAudit(
    tenantId: string,
    eventType: TenantAudit['event_type'],
    severity: TenantAudit['severity'] = 'info',
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.supabase.from('tenant_audit').insert({
      tenant_id: tenantId,
      event_type: eventType,
      severity,
      metadata,
    });
    if (error) console.error('Failed to log audit:', error);
  }

  async getTenantAudit(tenantId: string, limit = 100): Promise<TenantAudit[]> {
    const { data, error } = await this.supabase
      .from('tenant_audit')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  async getTenantMetrics(tenantId: string, days = 30): Promise<TenantMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('tenant_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async addAdminUser(
    userId: string,
    email: string,
    role: 'admin' | 'viewer' = 'viewer',
  ): Promise<void> {
    const { error } = await this.supabase.from('admin_users').insert({
      user_id: userId,
      email,
      role,
    });
    if (error) throw error;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    return !error && !!data;
  }
}

export function createAdminClient(config: AdminClientConfig): AdminClient {
  return new AdminClient(config);
}

export function createAdminClientFromEnv(): AdminClient {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('ADMIN_SUPABASE_URL and ADMIN_SUPABASE_SERVICE_KEY are required');
  }

  return createAdminClient({ adminUrl: url, adminServiceKey: key });
}
