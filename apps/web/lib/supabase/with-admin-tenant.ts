import { type AdminClient, createAdminClientFromEnv } from '@hawk/admin';
import { cookies } from 'next/headers';

let _adminClient: AdminClient | null = null;

function getAdminClient(): AdminClient {
  if (!_adminClient) {
    _adminClient = createAdminClientFromEnv();
  }
  return _adminClient;
}

// Cache tenant slug → id mapping (rarely changes)
const slugToIdCache = new Map<string, { tenantId: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves the current tenant from the hawk_tenant cookie and provides
 * an AdminClient scoped to that tenant for managing integrations and
 * other admin-level resources.
 */
export async function withAdminTenant<T>(
  fn: (ctx: { admin: AdminClient; tenantId: string; slug: string }) => Promise<T>,
): Promise<T> {
  const cookieStore = await cookies();
  const slug = cookieStore.get('hawk_tenant')?.value;

  if (!slug) {
    throw new Error('No tenant context — hawk_tenant cookie is missing');
  }

  const admin = getAdminClient();

  // Resolve slug → tenant ID (cached)
  const now = Date.now();
  const cached = slugToIdCache.get(slug);
  let tenantId: string;

  if (cached && cached.expiresAt > now) {
    tenantId = cached.tenantId;
  } else {
    const tenant = await admin.getTenantBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant '${slug}' not found in Admin Supabase`);
    }
    tenantId = tenant.id;
    slugToIdCache.set(slug, { tenantId, expiresAt: now + CACHE_TTL_MS });
  }

  return fn({ admin, tenantId, slug });
}
