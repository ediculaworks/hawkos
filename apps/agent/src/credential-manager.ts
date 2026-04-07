import { createDecipheriv, createHash } from 'node:crypto';
import { getPool } from '@hawk/db';
import type { ChainEntry } from './providers.js';
import type { TenantCredentials } from './tenant-manager.js';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';

function deriveKey(masterKey: string, salt?: string | null): Buffer {
  return createHash('sha256')
    .update(masterKey + (salt || LEGACY_SALT))
    .digest();
}

function decrypt(
  encryptedData: string,
  iv: string,
  masterKey: string,
  salt?: string | null,
): string {
  const key = deriveKey(masterKey, salt);
  const ivBuffer = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');

  const encrypted = combined.slice(0, -TAG_LENGTH);
  const tag = combined.slice(-TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function decryptJson<T>(
  encryptedData: string,
  iv: string,
  masterKey: string,
  salt?: string | null,
): T {
  const json = decrypt(encryptedData, iv, masterKey, salt);
  return JSON.parse(json) as T;
}

function getMasterKey(): string {
  const key = process.env.ADMIN_MASTER_KEY || process.env.JWT_SECRET || '';
  if (!key) {
    throw new Error('ADMIN_MASTER_KEY or JWT_SECRET is required for multi-tenant mode');
  }
  return key;
}

// ── Single tenant loading ────────────────────────────────────────────────────

export async function loadTenantCredentials(slug: string): Promise<TenantCredentials> {
  const masterKey = getMasterKey();
  const sql = getPool();

  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [slug.toLowerCase()]);
  });

  const tenant = rows[0] as Record<string, unknown> | undefined;
  if (!tenant) {
    throw new Error(`Tenant '${slug}' not found in admin database`);
  }

  if (tenant.status !== 'active') {
    console.warn(
      `[credential-manager] Tenant '${slug}' status is '${tenant.status}', proceeding anyway...`,
    );
  }

  return parseTenantRow(tenant, masterKey);
}

// ── Bulk loading (all active tenants) ────────────────────────────────────────

export async function loadAllActiveTenants(): Promise<TenantCredentials[]> {
  const masterKey = getMasterKey();
  const sql = getPool();

  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe("SELECT * FROM tenants WHERE status IN ('active', 'pending') ORDER BY slug");
  });

  const results: TenantCredentials[] = [];
  const failed: string[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    try {
      results.push(parseTenantRow(row, masterKey));
    } catch {
      failed.push(row.slug as string);
    }
  }
  if (failed.length > 0) {
    console.warn(
      `[credential-manager] Could not decrypt credentials for ${failed.length} tenant(s): ${failed.join(', ')} — ADMIN_MASTER_KEY mismatch. Use /dashboard/admin → key icon to re-enter credentials.`,
    );
  }

  return results;
}

// ── Shared row parser ────────────────────────────────────────────────────────

function parseTenantRow(tenant: Record<string, unknown>, masterKey: string): TenantCredentials {
  const salt = (tenant.key_salt as string) ?? null;
  const slug = tenant.slug as string;
  const schemaName = (tenant.schema_name as string) || `tenant_${slug}`;

  // Decrypt Discord config — non-fatal, tenant works without it (API-only mode)
  let discordConfig: TenantCredentials['discordConfig'];
  if (tenant.discord_config_encrypted && tenant.discord_config_iv) {
    try {
      discordConfig = decryptJson(
        tenant.discord_config_encrypted as string,
        tenant.discord_config_iv as string,
        masterKey,
        salt,
      );
    } catch {
      console.warn(
        `[credential-manager] [${slug}] Discord config decrypt failed (key mismatch) — running without Discord`,
      );
    }
  }

  // Decrypt OpenRouter config — non-fatal, falls back to Ollama local or global env key
  let openrouterConfig: TenantCredentials['openrouterConfig'];
  if (tenant.openrouter_config_encrypted && tenant.openrouter_config_iv) {
    try {
      openrouterConfig = decryptJson(
        tenant.openrouter_config_encrypted as string,
        tenant.openrouter_config_iv as string,
        masterKey,
        salt,
      );
    } catch {
      console.warn(
        `[credential-manager] [${slug}] OpenRouter config decrypt failed (key mismatch) — using Ollama local / global fallback`,
      );
    }
  }

  return {
    slug,
    schemaName,
    keySalt: salt,
    discordConfig,
    openrouterConfig,
  };
}

// ── Integration loading from admin.tenant_integrations ───────────────────────

interface IntegrationRow {
  provider: string;
  config_encrypted: string;
  config_iv: string;
  enabled: boolean;
}

export async function loadTenantIntegrations(
  slug: string,
): Promise<Map<string, Record<string, string>>> {
  const masterKey = getMasterKey();
  const sql = getPool();
  const result = new Map<string, Record<string, string>>();

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');

      const tenants = await tx.unsafe('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [
        slug.toLowerCase(),
      ]);
      const tenant = tenants[0] as Record<string, unknown> | undefined;
      if (!tenant) return [];

      return tx.unsafe(
        `SELECT provider, config_encrypted, config_iv, enabled
         FROM tenant_integrations
         WHERE tenant_id = $1 AND enabled = true`,
        [tenant.id as string],
      );
    });

    for (const row of (rows as IntegrationRow[]) || []) {
      if (!row.config_encrypted || !row.config_iv) continue;
      try {
        const config = decryptJson<Record<string, string>>(
          row.config_encrypted,
          row.config_iv,
          masterKey,
          (await loadTenantCredentials(slug)).keySalt,
        );
        result.set(row.provider, config);
      } catch (err) {
        console.warn(`[credential-manager] Failed to decrypt ${row.provider} integration:`, err);
      }
    }
  } catch {
    // Non-fatal: integrations table may not exist yet
  }

  return result;
}

// ── LLM chain loading from admin.tenant_llm_chain ─────────────────────────────

export async function loadTenantLLMChain(slug: string): Promise<ChainEntry[]> {
  const sql = getPool();

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');

      const tenants = await tx.unsafe('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [
        slug.toLowerCase(),
      ]);
      const tenant = tenants[0] as Record<string, unknown> | undefined;
      if (!tenant) return [];

      return tx.unsafe(
        `SELECT priority, provider_id, model_id, tier, enabled
         FROM tenant_llm_chain
         WHERE tenant_id = $1 AND enabled = true
         ORDER BY priority ASC`,
        [tenant.id as string],
      );
    });

    return (
      rows as {
        priority: number;
        provider_id: string;
        model_id: string;
        tier: string;
        enabled: boolean;
      }[]
    ).map((r) => ({
      priority: r.priority,
      providerId: r.provider_id,
      modelId: r.model_id,
      tier: r.tier as ChainEntry['tier'],
      enabled: r.enabled,
    }));
  } catch {
    // Non-fatal: table may not exist yet
    return [];
  }
}

/**
 * Extract per-provider API keys from tenant integrations.
 * Maps provider IDs (groq, xai, nvidia, etc.) to their api_key field.
 */
function extractProviderKeys(
  integrations: Map<string, Record<string, string>>,
  openrouterConfig?: { api_key?: string },
): Map<string, string> {
  const keys = new Map<string, string>();

  for (const [provider, config] of integrations) {
    const apiKey = config.api_key || config.token;
    if (apiKey) {
      keys.set(provider, apiKey);
    }
  }

  // Also include openrouter from the legacy config column
  if (openrouterConfig?.api_key && !keys.has('openrouter')) {
    keys.set('openrouter', openrouterConfig.api_key);
  }

  return keys;
}

// ── Refresh credentials for a single tenant ──────────────────────────────────

export async function refreshTenantCredentials(slug: string): Promise<TenantCredentials> {
  const cred = await loadTenantCredentials(slug);
  const integrations = await loadTenantIntegrations(slug);
  cred.integrations = integrations;
  cred.providerKeys = extractProviderKeys(integrations, cred.openrouterConfig);

  const chain = await loadTenantLLMChain(slug);
  if (chain.length > 0) {
    cred.llmChain = chain;
  }

  console.log(`[credential-manager] Credentials refreshed for tenant: ${slug}`);
  return cred;
}

// ── Legacy compatibility ─────────────────────────────────────────────────────
// These functions support the old single-tenant AGENT_SLOT mode.
// They are kept temporarily for backward compatibility during migration.

/** @deprecated Use tenantManager.loadAll() instead */
export async function initializeFromAdminDb(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) {
    console.log('[credential-manager] AGENT_SLOT not set — multi-tenant mode via TenantManager');
    return;
  }

  console.warn(
    `[credential-manager] AGENT_SLOT='${slot}' detected — using legacy single-tenant mode. Migrate to TenantManager.`,
  );

  const credentials = await loadTenantCredentials(slot);

  // Legacy: set process.env globals for backward compat
  process.env.TENANT_SCHEMA = credentials.schemaName;
  if (credentials.discordConfig) {
    if (credentials.discordConfig.bot_token)
      process.env.DISCORD_BOT_TOKEN = credentials.discordConfig.bot_token;
    if (credentials.discordConfig.client_id)
      process.env.DISCORD_CLIENT_ID = credentials.discordConfig.client_id;
    if (credentials.discordConfig.guild_id)
      process.env.DISCORD_GUILD_ID = credentials.discordConfig.guild_id;
    if (credentials.discordConfig.channel_id)
      process.env.DISCORD_CHANNEL_GERAL = credentials.discordConfig.channel_id;
    if (credentials.discordConfig.user_id)
      process.env.DISCORD_AUTHORIZED_USER_ID = credentials.discordConfig.user_id;
  }
  if (credentials.openrouterConfig) {
    if (credentials.openrouterConfig.api_key)
      process.env.OPENROUTER_API_KEY = credentials.openrouterConfig.api_key;
    if (credentials.openrouterConfig.model)
      process.env.OPENROUTER_MODEL = credentials.openrouterConfig.model;
  }

  console.log(`[credential-manager] Legacy: applied credentials for slot '${slot}'`);
}
