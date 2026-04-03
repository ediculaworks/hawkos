import { createDecipheriv, createHash } from 'node:crypto';
import { getPool } from '@hawk/db';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';

interface TenantCredentials {
  schemaName: string;
  keySalt: string | null;
  discordConfig?: {
    bot_token?: string;
    client_id?: string;
    guild_id?: string;
    channel_id?: string;
    user_id?: string;
  };
  openrouterConfig?: {
    api_key?: string;
    model?: string;
  };
}

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

export async function loadTenantCredentials(slot: string): Promise<TenantCredentials> {
  const masterKey = process.env.ADMIN_MASTER_KEY || process.env.JWT_SECRET || '';

  if (!masterKey) {
    throw new Error('ADMIN_MASTER_KEY or JWT_SECRET is required when AGENT_SLOT is set');
  }

  const sql = getPool();

  // Query admin schema for tenant by slug
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [slot.toLowerCase()]);
  });

  const tenant = rows[0] as Record<string, unknown> | undefined;
  if (!tenant) {
    throw new Error(`Tenant '${slot}' not found in admin database`);
  }

  if (tenant.status !== 'active') {
    console.warn(
      `[credential-manager] Tenant '${slot}' status is '${tenant.status}', proceeding anyway...`,
    );
  }

  const salt = (tenant.key_salt as string) ?? null;

  // Decrypt Discord config
  let discordConfig: TenantCredentials['discordConfig'];
  if (tenant.discord_config_encrypted && tenant.discord_config_iv) {
    discordConfig = decryptJson(
      tenant.discord_config_encrypted as string,
      tenant.discord_config_iv as string,
      masterKey,
      salt,
    );
  }

  // Decrypt OpenRouter config
  let openrouterConfig: TenantCredentials['openrouterConfig'];
  if (tenant.openrouter_config_encrypted && tenant.openrouter_config_iv) {
    openrouterConfig = decryptJson(
      tenant.openrouter_config_encrypted as string,
      tenant.openrouter_config_iv as string,
      masterKey,
      salt,
    );
  }

  return {
    schemaName: tenant.schema_name as string,
    keySalt: salt,
    discordConfig,
    openrouterConfig,
  };
}

export function applyTenantCredentials(credentials: TenantCredentials): void {
  // Set schema for the db compat layer
  process.env.TENANT_SCHEMA = credentials.schemaName;

  if (credentials.discordConfig) {
    if (credentials.discordConfig.bot_token) {
      process.env.DISCORD_BOT_TOKEN = credentials.discordConfig.bot_token;
    }
    if (credentials.discordConfig.client_id) {
      process.env.DISCORD_CLIENT_ID = credentials.discordConfig.client_id;
    }
    if (credentials.discordConfig.guild_id) {
      process.env.DISCORD_GUILD_ID = credentials.discordConfig.guild_id;
    }
    if (credentials.discordConfig.channel_id) {
      process.env.DISCORD_CHANNEL_GERAL = credentials.discordConfig.channel_id;
    }
    if (credentials.discordConfig.user_id) {
      process.env.DISCORD_AUTHORIZED_USER_ID = credentials.discordConfig.user_id;
    }
  }

  if (credentials.openrouterConfig) {
    if (credentials.openrouterConfig.api_key) {
      process.env.OPENROUTER_API_KEY = credentials.openrouterConfig.api_key;
    }
    if (credentials.openrouterConfig.model) {
      process.env.OPENROUTER_MODEL = credentials.openrouterConfig.model;
    }
  }

  console.log(
    `[credential-manager] Applied tenant credentials — schema: ${credentials.schemaName}`,
  );
}

// ── Integration loading from admin.tenant_integrations ───────────────────

interface IntegrationRow {
  provider: string;
  config_encrypted: string;
  config_iv: string;
  enabled: boolean;
}

const ENV_MAP: Record<string, Record<string, string>> = {
  anthropic: { api_key: 'ANTHROPIC_API_KEY' },
  groq: { api_key: 'GROQ_API_KEY' },
  github: { token: 'GITHUB_TOKEN' },
  clickup: { api_token: 'CLICKUP_API_TOKEN' },
};

export async function loadTenantIntegrations(slot: string): Promise<IntegrationRow[]> {
  const sql = getPool();

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');

      // Get tenant ID from slug
      const tenants = await tx.unsafe('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [
        slot.toLowerCase(),
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

    return (rows as IntegrationRow[]) || [];
  } catch {
    return [];
  }
}

export function applyIntegrationCredentials(
  integrations: IntegrationRow[],
  salt?: string | null,
): void {
  const masterKey = process.env.ADMIN_MASTER_KEY || process.env.JWT_SECRET || '';

  for (const row of integrations) {
    if (!row.config_encrypted || !row.config_iv) continue;

    try {
      const config = decryptJson<Record<string, string>>(
        row.config_encrypted,
        row.config_iv,
        masterKey,
        salt,
      );

      const mapping = ENV_MAP[row.provider];
      if (mapping) {
        for (const [configKey, envKey] of Object.entries(mapping)) {
          if (config[configKey]) {
            process.env[envKey] = config[configKey];
          }
        }
      }
    } catch (err) {
      console.warn(`[credential-manager] Failed to decrypt ${row.provider} integration:`, err);
    }
  }

  if (integrations.length > 0) {
    console.log(
      `[credential-manager] Applied ${integrations.length} integration(s) from admin.tenant_integrations`,
    );
  }
}

/**
 * Reload all credentials from admin schema.
 * Called by the /reload-credentials endpoint after dashboard changes.
 */
export async function refreshCredentials(): Promise<boolean> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) return false;

  try {
    const credentials = await loadTenantCredentials(slot);
    applyTenantCredentials(credentials);

    const integrations = await loadTenantIntegrations(slot);
    applyIntegrationCredentials(integrations, credentials.keySalt);

    console.log('[credential-manager] Credentials refreshed successfully');
    return true;
  } catch (err) {
    console.error('[credential-manager] Credential refresh failed:', err);
    return false;
  }
}

// ── Initialization ────────────────────────────────────────────────────────────

const RETRY_INTERVAL_MS = 30 * 60_000; // 30 minutes between retries
const MAX_RETRIES = 5;

export async function initializeFromAdminDb(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) {
    console.log('[credential-manager] AGENT_SLOT not set, using local environment variables');
    return;
  }

  console.log(`[credential-manager] Loading credentials for slot: ${slot}`);

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const credentials = await loadTenantCredentials(slot);
      applyTenantCredentials(credentials);

      const integrations = await loadTenantIntegrations(slot);
      applyIntegrationCredentials(integrations, credentials.keySalt);

      return; // success
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isMissing = msg.includes('not found');

      if (isMissing) {
        retries++;
        console.warn(
          `[credential-manager] Tenant '${slot}' not registered — retry ${retries}/${MAX_RETRIES} (next in 30min)`,
        );
        if (retries >= MAX_RETRIES) {
          throw new Error(
            `Tenant '${slot}' not found after ${MAX_RETRIES} retries. Check AGENT_SLOT value.`,
          );
        }
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
        continue;
      }

      console.error(`[credential-manager] Failed to load credentials: ${error}`);
      throw error;
    }
  }
}
