import type { Database } from '@hawk/db/types';
import { createBrowserClient } from '@supabase/ssr';

// Cache browser clients per Supabase URL to avoid recreating
const clientCache = new Map<string, ReturnType<typeof createBrowserClient<Database>>>();

export function createClient(): ReturnType<typeof createBrowserClient<Database>> {
  // Multi-tenant: read from window globals injected by layout.tsx
  const tenant = typeof window !== 'undefined' ? window.__HAWK_TENANT__ : undefined;
  const url = tenant?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = tenant?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase config — ensure hawk_tenant cookie is set (multi-tenant) or NEXT_PUBLIC_SUPABASE_URL env var exists (single-tenant)',
    );
  }

  const cached = clientCache.get(url);
  if (cached) return cached;

  const client = createBrowserClient<Database>(url, key);
  clientCache.set(url, client);
  return client;
}
