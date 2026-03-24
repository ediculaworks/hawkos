import { getTenantBySlug } from '@/lib/tenants/cache';
import type { Database } from '@hawk/db/types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('hawk_tenant')?.value;

  let url: string | undefined;
  let key: string | undefined;

  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) throw new Error(`Unknown tenant: ${tenantSlug}`);
    url = tenant.supabaseUrl;
    key = tenant.supabaseAnonKey;
  } else {
    // Single-tenant fallback
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  if (!url || !key) {
    throw new Error(
      'Missing Supabase config — either set hawk_tenant cookie (multi-tenant) or NEXT_PUBLIC_SUPABASE_URL env var (single-tenant)',
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
      ) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
