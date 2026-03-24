import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const SALT = 'hawk-os-admin-salt-v1';

interface TenantCredentials {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
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

function deriveKey(masterKey: string): Buffer {
  return createHash('sha256')
    .update(masterKey + SALT)
    .digest();
}

function decrypt(encryptedData: string, iv: string, masterKey: string): string {
  const key = deriveKey(masterKey);
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

function decryptJson<T>(encryptedData: string, iv: string, masterKey: string): T {
  const json = decrypt(encryptedData, iv, masterKey);
  return JSON.parse(json) as T;
}

export async function loadTenantCredentials(slot: string): Promise<TenantCredentials> {
  const adminUrl = process.env.ADMIN_SUPABASE_URL;
  const adminAnonKey = process.env.ADMIN_SUPABASE_ANON_KEY;
  const masterKey =
    process.env.ADMIN_SUPABASE_SERVICE_KEY || process.env.ADMIN_SUPABASE_ANON_KEY || '';

  if (!adminUrl || !adminAnonKey) {
    throw new Error(
      'ADMIN_SUPABASE_URL and ADMIN_SUPABASE_ANON_KEY are required when AGENT_SLOT is set',
    );
  }

  const supabase = createClient(adminUrl, adminAnonKey, {
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

  const serviceKey = decrypt(
    tenant.supabase_service_key_encrypted,
    tenant.supabase_service_key_iv,
    masterKey,
  );

  // Decrypt Discord config (new encrypted format or legacy plain JSONB)
  let discordConfig: TenantCredentials['discordConfig'];
  if (tenant.discord_config_encrypted && tenant.discord_config_iv) {
    discordConfig = decryptJson(
      tenant.discord_config_encrypted,
      tenant.discord_config_iv,
      masterKey,
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
    );
  } else if (tenant.openrouter_config && !tenant.openrouter_config._encrypted) {
    // Legacy: plain JSONB (pre-encryption migration)
    openrouterConfig = tenant.openrouter_config;
  }

  return {
    supabaseUrl: tenant.supabase_url,
    supabaseAnonKey: tenant.supabase_anon_key,
    supabaseServiceKey: serviceKey,
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

export async function initializeFromAdminSupabase(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) {
    console.log('[credential-manager] AGENT_SLOT not set, using local environment variables');
    return;
  }

  console.log(`[credential-manager] Loading credentials for slot: ${slot}`);

  try {
    const credentials = await loadTenantCredentials(slot);
    applyTenantCredentials(credentials);
  } catch (error) {
    console.error(`[credential-manager] Failed to load credentials: ${error}`);
    throw error;
  }
}
