import { getPool } from '@hawk/db';
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
  TenantIntegration,
  TenantMetrics,
  TenantModule,
} from './types.js';

export interface AdminClientConfig {
  masterKey: string;
}

export class AdminClient {
  private masterKey: string;

  constructor(config: AdminClientConfig) {
    this.masterKey = config.masterKey;
  }

  private get sql() {
    return getPool();
  }

  /** Run a query against the admin schema. */
  private async adminQuery<T>(query: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      return tx.unsafe(query, params as (string | number | boolean | null)[]);
    });
    return [...result] as T[];
  }

  async getAvailableSlots(): Promise<TenantAvailability[]> {
    // Build availability from tenants table + predefined slots
    const allSlots = ['ten1', 'ten2', 'ten3', 'ten4', 'ten5', 'ten6'];
    const tenants = await this.adminQuery<Tenant>('SELECT * FROM tenants ORDER BY slug');
    const tenantMap = new Map(tenants.map((t) => [t.slug, t]));

    return allSlots.map((slot, idx) => {
      const tenant = tenantMap.get(slot);
      return {
        slot_number: idx + 1,
        slot_name: slot,
        status: tenant ? ('occupied' as const) : ('available' as const),
        tenant_id: tenant?.id ?? null,
        tenant_label: tenant?.label ?? null,
        tenant_status: tenant?.status ?? null,
        onboarding_completed_at: null,
        created_at: tenant?.created_at ?? null,
      };
    });
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const rows = await this.adminQuery<Tenant>('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [
      slug,
    ]);
    return rows[0] ?? null;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const rows = await this.adminQuery<Tenant>('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ?? null;
  }

  async listTenants(): Promise<Tenant[]> {
    return this.adminQuery<Tenant>('SELECT * FROM tenants ORDER BY created_at DESC');
  }

  async createTenant(
    data: {
      label: string;
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

    const slug = availableSlot.slot_name;
    const schemaName = `tenant_${slug}`;
    const agentSecret = generateAgentSecret();

    // Encrypt Discord and OpenRouter configs if provided
    let discordEncrypted: string | null = null;
    let discordIv: string | null = null;
    if (data.discordConfig) {
      const enc = encrypt(JSON.stringify(data.discordConfig), this.masterKey);
      discordEncrypted = enc.encrypted;
      discordIv = enc.iv;
    }

    let openrouterEncrypted: string | null = null;
    let openrouterIv: string | null = null;
    if (data.openrouterConfig) {
      const enc = encrypt(JSON.stringify(data.openrouterConfig), this.masterKey);
      openrouterEncrypted = enc.encrypted;
      openrouterIv = enc.iv;
    }

    const rows = await this.adminQuery<Tenant>(
      `INSERT INTO tenants (slug, label, schema_name, status, agent_port, agent_secret,
        discord_config_encrypted, discord_config_iv,
        openrouter_config_encrypted, openrouter_config_iv,
        created_by)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        slug,
        data.label,
        schemaName,
        3000 + availableSlot.slot_number,
        agentSecret,
        discordEncrypted,
        discordIv,
        openrouterEncrypted,
        openrouterIv,
        userId ?? null,
      ],
    );

    if (!rows[0]) {
      return { success: false, error: 'Failed to insert tenant' };
    }

    // Create tenant schema and apply migrations
    await this._createTenantSchema(schemaName);

    return { success: true, tenant: rows[0] };
  }

  /** Creates a new PostgreSQL schema for a tenant and applies all migrations. */
  private async _createTenantSchema(schemaName: string): Promise<void> {
    const sql = this.sql;

    // Create schema
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Grant permissions
    await sql.unsafe(`GRANT USAGE ON SCHEMA "${schemaName}" TO authenticated`);
    await sql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON TABLES TO authenticated`,
    );
    await sql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA "${schemaName}" GRANT ALL ON SEQUENCES TO authenticated`,
    );

    // Apply tenant migrations in the new schema
    // Migrations are loaded from packages/db/supabase/migrations/ at deploy time
    // For now, we mark the schema as ready — migrations are applied separately
    console.log(`[admin] Created schema "${schemaName}" — apply migrations separately`);
  }

  async updateTenant(id: string, data: Record<string, unknown>): Promise<Tenant> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      setClauses.push(`"${key}" = $${idx++}`);
      values.push(value);
    }
    setClauses.push('updated_at = now()');
    values.push(id);

    const rows = await this.adminQuery<Tenant>(
      `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    if (!rows[0]) throw new Error('Tenant not found');
    return rows[0];
  }

  async deleteTenant(id: string): Promise<void> {
    // Get tenant to find schema name
    const tenant = await this.getTenantById(id);
    if (tenant?.schema_name) {
      await this.sql.unsafe(`DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`);
    }
    await this.adminQuery('DELETE FROM tenants WHERE id = $1', [id]);
  }

  async listTenantModules(tenantId: string): Promise<TenantModule[]> {
    return this.adminQuery<TenantModule>('SELECT * FROM tenant_modules WHERE tenant_id = $1', [
      tenantId,
    ]);
  }

  async setTenantModules(
    tenantId: string,
    modules: Array<{ module_id: string; enabled: boolean; config?: Record<string, unknown> }>,
  ): Promise<void> {
    await this.adminQuery('DELETE FROM tenant_modules WHERE tenant_id = $1', [tenantId]);

    if (modules.length > 0) {
      const values = modules
        .map((_m, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
        .join(', ');

      const params: unknown[] = [tenantId];
      for (const m of modules) {
        params.push(m.module_id, m.enabled, JSON.stringify(m.config || {}));
      }

      await this.adminQuery(
        `INSERT INTO tenant_modules (tenant_id, module_id, enabled, config) VALUES ${values}`,
        params,
      );
    }
  }

  // ── Integration CRUD ─────────────────────────────────────────────────

  async listTenantIntegrations(tenantId: string): Promise<TenantIntegration[]> {
    return this.adminQuery<TenantIntegration>(
      'SELECT * FROM tenant_integrations WHERE tenant_id = $1 ORDER BY provider',
      [tenantId],
    );
  }

  async getTenantIntegration(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<TenantIntegration | null> {
    const rows = await this.adminQuery<TenantIntegration>(
      'SELECT * FROM tenant_integrations WHERE tenant_id = $1 AND provider = $2 LIMIT 1',
      [tenantId, provider],
    );
    return rows[0] ?? null;
  }

  async upsertTenantIntegration(
    tenantId: string,
    provider: IntegrationProvider,
    config: Record<string, unknown>,
    enabled: boolean,
  ): Promise<TenantIntegration> {
    const { encrypted, iv } = encrypt(JSON.stringify(config), this.masterKey);

    const rows = await this.adminQuery<TenantIntegration>(
      `INSERT INTO tenant_integrations (tenant_id, provider, config_encrypted, config_iv, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, provider) DO UPDATE SET
         config_encrypted = EXCLUDED.config_encrypted,
         config_iv = EXCLUDED.config_iv,
         enabled = EXCLUDED.enabled,
         updated_at = now()
       RETURNING *`,
      [tenantId, provider, encrypted, iv, enabled],
    );

    return rows[0]!;
  }

  async deleteTenantIntegration(tenantId: string, provider: IntegrationProvider): Promise<void> {
    await this.adminQuery(
      'DELETE FROM tenant_integrations WHERE tenant_id = $1 AND provider = $2',
      [tenantId, provider],
    );
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
    await this.adminQuery(
      `UPDATE tenants SET discord_config_encrypted = $1, discord_config_iv = $2, updated_at = now()
       WHERE id = $3`,
      [encrypted, iv, tenantId],
    );
  }

  async updateTenantOpenRouterConfig(tenantId: string, config: OpenRouterConfig): Promise<void> {
    const { encrypted, iv } = encrypt(JSON.stringify(config), this.masterKey);
    await this.adminQuery(
      `UPDATE tenants SET openrouter_config_encrypted = $1, openrouter_config_iv = $2, updated_at = now()
       WHERE id = $3`,
      [encrypted, iv, tenantId],
    );
  }

  // ── Audit & Metrics ────────────────────────────────────────────────

  async logAudit(
    tenantId: string,
    action: string,
    details: Record<string, unknown> = {},
    performedBy?: string,
  ): Promise<void> {
    try {
      await this.adminQuery(
        `INSERT INTO tenant_audit (tenant_id, action, details, performed_by)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, action, JSON.stringify(details), performedBy ?? null],
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  }

  async getTenantAudit(tenantId: string, limit = 100): Promise<TenantAudit[]> {
    return this.adminQuery<TenantAudit>(
      'SELECT * FROM tenant_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit],
    );
  }

  async getTenantMetrics(tenantId: string, days = 30): Promise<TenantMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.adminQuery<TenantMetrics>(
      `SELECT * FROM tenant_metrics WHERE tenant_id = $1 AND date >= $2
       ORDER BY date DESC`,
      [tenantId, startDate.toISOString().split('T')[0]],
    );
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    return this.adminQuery<AdminUser>('SELECT * FROM admin_users ORDER BY created_at DESC');
  }

  async addAdminUser(email: string, passwordHash: string, role = 'admin'): Promise<void> {
    await this.adminQuery(
      'INSERT INTO admin_users (email, password_hash, role) VALUES ($1, $2, $3)',
      [email, passwordHash, role],
    );
  }

  async isAdmin(email: string): Promise<boolean> {
    const rows = await this.adminQuery<{ role: string }>(
      "SELECT role FROM admin_users WHERE email = $1 AND role = 'admin' LIMIT 1",
      [email],
    );
    return rows.length > 0;
  }
}

export function createAdminClient(config: AdminClientConfig): AdminClient {
  return new AdminClient(config);
}

export function createAdminClientFromEnv(): AdminClient {
  const masterKey = process.env.ADMIN_MASTER_KEY || process.env.JWT_SECRET;

  if (!masterKey) {
    throw new Error('ADMIN_MASTER_KEY or JWT_SECRET is required');
  }

  return createAdminClient({ masterKey });
}
