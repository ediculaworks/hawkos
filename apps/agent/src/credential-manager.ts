import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';

interface TenantCredentials {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
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
  const adminUrl = process.env.ADMIN_SUPABASE_URL;
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || process.env.ADMIN_SUPABASE_ANON_KEY;
  const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || '';

  if (!adminUrl || !adminKey) {
    throw new Error(
      'ADMIN_SUPABASE_URL and ADMIN_SUPABASE_SERVICE_KEY are required when AGENT_SLOT is set',
    );
  }

  // Use service key to bypass RLS on tenants table
  const supabase = createClient(adminUrl, adminKey, {
    auth: { persistSession: false },
  });

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slot.toLowerCase())
    .single();

  if (error || !tenant) {
    throw new Error(`Tenant '${slot}' not found in Admin Supabase`);
  }

  if (tenant.status !== 'active') {
    console.warn(
      `[credential-manager] Tenant '${slot}' status is '${tenant.status}', proceeding anyway...`,
    );
  }

  // Per-tenant salt (NULL = legacy static salt for backward compat)
  const salt = tenant.key_salt ?? null;

  const serviceKey = decrypt(
    tenant.supabase_service_key_encrypted,
    tenant.supabase_service_key_iv,
    masterKey,
    salt,
  );

  // Decrypt Discord config (new encrypted format or legacy plain JSONB)
  let discordConfig: TenantCredentials['discordConfig'];
  if (tenant.discord_config_encrypted && tenant.discord_config_iv) {
    discordConfig = decryptJson(
      tenant.discord_config_encrypted,
      tenant.discord_config_iv,
      masterKey,
      salt,
    );
  } else if (tenant.discord_config && !tenant.discord_config._encrypted) {
    // Legacy: plain JSONB (pre-encryption migration)
    discordConfig = tenant.discord_config;
  }

  // Decrypt OpenRouter config (new encrypted format or legacy plain JSONB)
  let openrouterConfig: TenantCredentials['openrouterConfig'];
  if (tenant.openrouter_config_encrypted && tenant.openrouter_config_iv) {
    openrouterConfig = decryptJson(
      tenant.openrouter_config_encrypted,
      tenant.openrouter_config_iv,
      masterKey,
      salt,
    );
  } else if (tenant.openrouter_config && !tenant.openrouter_config._encrypted) {
    // Legacy: plain JSONB (pre-encryption migration)
    openrouterConfig = tenant.openrouter_config;
  }

  return {
    supabaseUrl: tenant.supabase_url,
    supabaseAnonKey: tenant.supabase_anon_key,
    supabaseServiceKey: serviceKey,
    keySalt: salt,
    discordConfig,
    openrouterConfig,
  };
}

export function applyTenantCredentials(credentials: TenantCredentials): void {
  process.env.SUPABASE_URL = credentials.supabaseUrl;
  process.env.SUPABASE_ANON_KEY = credentials.supabaseAnonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = credentials.supabaseServiceKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL = credentials.supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = credentials.supabaseAnonKey;

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

  console.log('[credential-manager] Applied tenant credentials from Admin Supabase');
}

// ── Integration loading from tenant_integrations table ─────────────────────

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
  const adminUrl = process.env.ADMIN_SUPABASE_URL;
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!adminUrl || !adminKey) return [];

  const supabase = createClient(adminUrl, adminKey, {
    auth: { persistSession: false },
  });

  // Get tenant ID from slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slot.toLowerCase())
    .single();

  if (!tenant) return [];

  const { data: integrations } = await supabase
    .from('tenant_integrations')
    .select('provider, config_encrypted, config_iv, enabled')
    .eq('tenant_id', tenant.id)
    .eq('enabled', true);

  return (integrations as IntegrationRow[] | null) || [];
}

export function applyIntegrationCredentials(
  integrations: IntegrationRow[],
  salt?: string | null,
): void {
  const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || '';

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
      `[credential-manager] Applied ${integrations.length} integration(s) from tenant_integrations`,
    );
  }
}

/**
 * Reload all credentials from Admin Supabase (tenants + tenant_integrations).
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

const RETRY_INTERVAL_MS = 30 * 60_000; // 30 minutes between retries (idle agents sleep)

export async function initializeFromAdminSupabase(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) {
    console.log('[credential-manager] AGENT_SLOT not set, using local environment variables');
    return;
  }

  console.log(`[credential-manager] Loading credentials for slot: ${slot}`);

  let loggedWaiting = false;
  while (true) {
    try {
      const credentials = await loadTenantCredentials(slot);
      applyTenantCredentials(credentials);

      // Also load additional integrations from tenant_integrations
      const integrations = await loadTenantIntegrations(slot);
      applyIntegrationCredentials(integrations, credentials.keySalt);

      return; // success
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isMissing = msg.includes('not found');

      if (isMissing) {
        if (!loggedWaiting) {
          console.log(
            `[credential-manager] Tenant '${slot}' not registered — sleeping (check every 30min)`,
          );
          loggedWaiting = true;
        }
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
        continue;
      }

      // Non-recoverable error (bad credentials, network, etc.)
      console.error(`[credential-manager] Failed to load credentials: ${error}`);
      throw error;
    }
  }
}
