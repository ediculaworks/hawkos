/**
 * Safe tenant schema resolution from cookies.
 * ALWAYS resolves schema via DB lookup (parameterized query) — never constructs from cookie.
 * Validates schema name before returning to prevent SQL injection.
 */

import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { validateSchemaName } from '@hawk/db';
import { cookies } from 'next/headers';

/**
 * Read the tenant cookie and resolve to a validated schema name.
 * Returns null if no tenant cookie or tenant not found.
 */
export async function getSafeSchemaFromCookie(): Promise<{
  schemaName: string;
  slug: string;
} | null> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;
  if (!slug) return null;

  const tenant = await getTenantPrivateBySlug(slug);
  if (!tenant) return null;

  // Defense-in-depth: validate even DB-sourced schema names
  validateSchemaName(tenant.schemaName);
  return { schemaName: tenant.schemaName, slug };
}
