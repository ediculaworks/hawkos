// Edge-safe: no node:crypto imports. Used by middleware.
import { createClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Public tenant info — safe for browser / middleware. */
export interface CachedTenant {
  slug: string;
  label: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** Private tenant info — server-only, includes secrets. */
export interface CachedTenantPrivate extends CachedTenant {
  supabaseServiceRoleKey: string;
  agentApiPort: number;
  agentApiSecret: string;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const publicCache = new Map<string, { tenant: CachedTenant; expiresAt: number }>();
export const privateCache = new Map<string, { tenant: CachedTenantPrivate; expiresAt: number }>();
export let allTenantsCache: { tenants: CachedTenant[]; expiresAt: number } | null = null;

// ── Admin Client ──────────────────────────────────────────────────────────────

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Public Queries ────────────────────────────────────────────────────────────

/** Fetch a single tenant by slug — cached for 5 min, falls back to Admin Supabase. */
export async function getTenantBySlug(slug: string): Promise<CachedTenant | null> {
  const now = Date.now();
  const cached = publicCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  const admin = getAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from('tenants')
    .select('slug, label, supabase_url, supabase_anon_key')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return null;

  const tenant: CachedTenant = {
    slug: data.slug,
    label: data.label,
    supabaseUrl: data.supabase_url,
    supabaseAnonKey: data.supabase_anon_key,
  };

  publicCache.set(slug, { tenant, expiresAt: now + CACHE_TTL_MS });
  return tenant;
}

/** List all active tenants (for login page tenant picker). */
export async function getAllTenants(): Promise<CachedTenant[]> {
  const now = Date.now();
  if (allTenantsCache && allTenantsCache.expiresAt > now) return allTenantsCache.tenants;

  const admin = getAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from('tenants')
    .select('slug, label, supabase_url, supabase_anon_key')
    .eq('status', 'active');

  const tenants: CachedTenant[] = (data || []).map((row) => ({
    slug: row.slug,
    label: row.label,
    supabaseUrl: row.supabase_url,
    supabaseAnonKey: row.supabase_anon_key,
  }));

  allTenantsCache = { tenants, expiresAt: now + CACHE_TTL_MS };
  return tenants;
}

// ── Cache Invalidation ────────────────────────────────────────────────────────

/** Invalidate cache — call after onboarding creates/updates a tenant. */
export function invalidateTenantCache(slug?: string) {
  if (slug) {
    publicCache.delete(slug);
    privateCache.delete(slug);
  } else {
    publicCache.clear();
    privateCache.clear();
  }
  allTenantsCache = null;
}
