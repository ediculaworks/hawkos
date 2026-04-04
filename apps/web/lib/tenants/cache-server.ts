// Node.js runtime only — for server components/actions that need full tenant details.
// Simplified: no more encrypted service keys since we use schema-per-tenant.

import { getPool } from '@hawk/db';
import { type CachedTenantPrivate, privateCache } from './cache';

const CACHE_TTL_MS = 5 * 60 * 1000;

async function adminQuery<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const sql = getPool();
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe(query, params as never[]);
  });
  return rows as unknown as T[];
}

/** Fetch tenant with all details — for server components / actions only. */
export async function getTenantPrivateBySlug(slug: string): Promise<CachedTenantPrivate | null> {
  const now = Date.now();
  const cached = privateCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  const rows = await adminQuery<Record<string, unknown>>(
    "SELECT slug, label, schema_name, agent_port, agent_secret FROM tenants WHERE slug = $1 AND status = 'active' LIMIT 1",
    [slug],
  );

  const data = rows[0];
  if (!data) return null;

  const tenant: CachedTenantPrivate = {
    slug: data.slug as string,
    label: data.label as string,
    schemaName: data.schema_name as string,
    agentApiPort: data.agent_port as number,
    agentApiSecret: data.agent_secret as string,
  };

  privateCache.set(slug, { tenant, expiresAt: now + CACHE_TTL_MS });
  return tenant;
}
