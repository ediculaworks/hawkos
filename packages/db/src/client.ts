import { AsyncLocalStorage } from 'node:async_hooks';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.ts';

// ── Tenant-scoped AsyncLocalStorage ─────────────────────────────────────────
// When a tenant client is set via tenantStore.run(), all code that accesses
// `db` within that async context will transparently use the tenant's client.
// Outside of tenantStore.run(), falls back to the default singleton (agent).
export const tenantStore = new AsyncLocalStorage<SupabaseClient<Database>>();

// ── Default singleton (lazy) ────────────────────────────────────────────────
// Used by the agent process (single-tenant, reads from env vars).
// Lazy so it doesn't throw at import time in the web app where these env vars
// are not set globally.
let defaultDb: SupabaseClient<Database> | null = null;

function getDefaultDb(): SupabaseClient<Database> {
  if (defaultDb) return defaultDb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'No tenant context set and SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars are missing. ' +
        'In the web app, wrap your code with tenantStore.run(). In the agent, set the env vars.',
    );
  }
  defaultDb = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return defaultDb;
}

// ── Proxy: transparent delegation ───────────────────────────────────────────
// `import { db } from '@hawk/db'` works identically in both single-tenant
// (agent) and multi-tenant (web) contexts. Zero changes needed in module queries.
export const db = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const source = tenantStore.getStore() ?? getDefaultDb();
    const value = Reflect.get(source, prop, receiver);
    return typeof value === 'function' ? value.bind(source) : value;
  },
});

// ── Factory for tenant-specific service-role clients ────────────────────────
export function createTenantClient(url: string, serviceRoleKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
