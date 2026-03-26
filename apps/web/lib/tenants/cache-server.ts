// Node.js runtime only — uses node:crypto. Do NOT import from middleware.
import { createDecipheriv, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { type CachedTenantPrivate, privateCache } from './cache';

const CACHE_TTL_MS = 5 * 60 * 1000;
const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const LEGACY_SALT = 'hawk-os-admin-salt-v1';

function deriveKey(masterKey: string, salt?: string | null): Buffer {
  return createHash('sha256')
    .update(masterKey + (salt || LEGACY_SALT))
    .digest();
}

function decryptServiceKey(
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

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Fetch tenant with decrypted secrets — for server components / actions only. */
export async function getTenantPrivateBySlug(slug: string): Promise<CachedTenantPrivate | null> {
  const now = Date.now();
  const cached = privateCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  const admin = getAdminClient();
  if (!admin) return null;

  const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY || '';

  const { data } = await admin
    .from('tenants')
    .select(
      'slug, label, supabase_url, supabase_anon_key, supabase_service_key_encrypted, supabase_service_key_iv, agent_port, agent_secret, key_salt',
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return null;

  const serviceKey = decryptServiceKey(
    data.supabase_service_key_encrypted,
    data.supabase_service_key_iv,
    masterKey,
    data.key_salt,
  );

  const tenant: CachedTenantPrivate = {
    slug: data.slug,
    label: data.label,
    supabaseUrl: data.supabase_url,
    supabaseAnonKey: data.supabase_anon_key,
    supabaseServiceRoleKey: serviceKey,
    agentApiPort: data.agent_port,
    agentApiSecret: data.agent_secret,
  };

  privateCache.set(slug, { tenant, expiresAt: now + CACHE_TTL_MS });
  return tenant;
}
