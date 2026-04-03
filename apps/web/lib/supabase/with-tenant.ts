import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { withTenantSchema } from '@hawk/db';
import { cookies } from 'next/headers';

/**
 * Returns the current tenant slug from cookies (or 'default' for single-tenant).
 */
export async function getTenantSlug(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get('hawk_tenant')?.value ?? 'default';
}

/**
 * Wraps a server action to run within the correct tenant's database schema.
 * All `db` queries inside `fn` will automatically route to the tenant's schema
 * via the AsyncLocalStorage proxy in @hawk/db.
 */
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;

  if (!slug) {
    // Single-tenant fallback — uses TENANT_SCHEMA env var or 'public'
    return fn();
  }

  const tenant = await getTenantPrivateBySlug(slug);
  if (!tenant) {
    // Tenant not found — fall back to default schema
    return fn();
  }

  return withTenantSchema(tenant.schemaName, fn);
}
