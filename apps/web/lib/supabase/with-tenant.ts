import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { createTenantClient, tenantStore } from '@hawk/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Cache service-role clients per tenant slug (stateless, safe to reuse)
const clientCache = new Map<string, SupabaseClient>();

async function getServiceClient(slug: string): Promise<SupabaseClient> {
  const cached = clientCache.get(slug);
  if (cached) return cached;

  const tenant = await getTenantPrivateBySlug(slug);
  if (!tenant) throw new Error(`Unknown tenant: ${slug}`);

  const client = createTenantClient(tenant.supabaseUrl, tenant.supabaseServiceRoleKey);
  clientCache.set(slug, client);
  return client;
}

/**
 * Returns the current tenant slug from cookies (or 'default' for single-tenant).
 */
export async function getTenantSlug(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get('hawk_tenant')?.value ?? 'default';
}

/**
 * Wraps a server action to run within the correct tenant's Supabase context.
 * All `db` queries inside `fn` will automatically route to the tenant's database
 * via the AsyncLocalStorage proxy in @hawk/db.
 */
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;

  if (!slug) {
    // Single-tenant fallback — run without tenant context (uses env vars via default db)
    return fn();
  }

  const client = await getServiceClient(slug);
  return tenantStore.run(client, fn);
}
