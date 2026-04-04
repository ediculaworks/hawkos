// Edge-safe tenant cache — used by middleware and server components.
// Queries the admin schema in PostgreSQL instead of Admin Supabase.

import { getPool } from '@hawk/db';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Public tenant info — safe for browser / middleware. */
export interface CachedTenant {
  slug: string;
  label: string;
  schemaName: string;
}

/** Private tenant info — server-only, includes secrets. */
export interface CachedTenantPrivate extends CachedTenant {
  agentApiPort: number;
  agentApiSecret: string;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const publicCache = new Map<string, { tenant: CachedTenant; expiresAt: number }>();
export const privateCache = new Map<string, { tenant: CachedTenantPrivate; expiresAt: number }>();
export let allTenantsCache: { tenants: CachedTenant[]; expiresAt: number } | null = null;

// ── Admin Queries ────────────────────────────────────────────────────────────

async function adminQuery<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const sql = getPool();
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe(query, params as never[]);
  });
  return rows as unknown as T[];
}

// ── Public Queries ────────────────────────────────────────────────────────────

/** Fetch a single tenant by slug — cached for 30 min. */
export async function getTenantBySlug(slug: string): Promise<CachedTenant | null> {
  const now = Date.now();
  const cached = publicCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  const rows = await adminQuery<Record<string, unknown>>(
    "SELECT slug, label, schema_name FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1",
    [slug],
  );

  const data = rows[0];
  if (!data) return null;

  const tenant: CachedTenant = {
    slug: data.slug as string,
    label: data.label as string,
    schemaName: data.schema_name as string,
  };

  publicCache.set(slug, { tenant, expiresAt: now + CACHE_TTL_MS });
  return tenant;
}

/** Resolve tenant by owner email — used at login to avoid workspace selection. */
export async function getTenantByEmail(email: string): Promise<CachedTenant | null> {
  const rows = await adminQuery<Record<string, unknown>>(
    "SELECT slug, label, schema_name FROM tenants WHERE owner_email = $1 AND status = 'active' LIMIT 1",
    [email],
  );

  const data = rows[0];
  if (!data) return null;

  return {
    slug: data.slug as string,
    label: data.label as string,
    schemaName: data.schema_name as string,
  };
}

/** List all active tenants (for login page tenant picker). */
export async function getAllTenants(): Promise<CachedTenant[]> {
  const now = Date.now();
  if (allTenantsCache && allTenantsCache.expiresAt > now) return allTenantsCache.tenants;

  const rows = await adminQuery<Record<string, unknown>>(
    "SELECT slug, label, schema_name FROM tenants WHERE status = 'active' ORDER BY slug",
  );

  const tenants: CachedTenant[] = rows.map((row) => ({
    slug: row.slug as string,
    label: row.label as string,
    schemaName: row.schema_name as string,
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
