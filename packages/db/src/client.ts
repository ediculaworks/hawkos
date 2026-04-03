import { type SupabaseCompatClient, createCompatClient } from './compat.ts';
import { schemaStore } from './sql.ts';

// ── Tenant-scoped AsyncLocalStorage ─────────────────────────────────────────
// When a tenant schema is set via tenantStore.run(), all code that accesses
// `db` within that async context will transparently use the tenant's schema.
// Outside of tenantStore.run(), falls back to TENANT_SCHEMA env var or 'public'.
export const tenantStore = schemaStore;

// ── Singleton compat client ─────────────────────────────────────────────────
// All queries go through this. The schema context is resolved per-request
// via AsyncLocalStorage inside the compat layer.
const compatClient = createCompatClient();

// ── Proxy: transparent delegation ───────────────────────────────────────────
// `import { db } from '@hawk/db'` works identically in both single-tenant
// (agent) and multi-tenant (web) contexts. Zero changes needed in module queries.
export const db = new Proxy({} as SupabaseCompatClient, {
  get(_target, prop, _receiver) {
    const value = Reflect.get(compatClient, prop);
    return typeof value === 'function' ? value.bind(compatClient) : value;
  },
});

// ── Factory for tenant-specific context ─────────────────────────────────────
// In the old Supabase world, this created a new SupabaseClient per tenant.
// Now it just returns the schema name — the actual isolation happens via
// SET search_path in the compat layer.
export function createTenantClient(schemaName: string): SupabaseCompatClient {
  // Return a wrapper that always uses this specific schema
  return new Proxy({} as SupabaseCompatClient, {
    get(_target, prop) {
      if (prop === '_schema') return schemaName;
      const value = Reflect.get(compatClient, prop);
      return typeof value === 'function' ? value.bind(compatClient) : value;
    },
  });
}

/**
 * Run a function within a specific tenant schema context.
 * Replaces the old `tenantStore.run(supabaseClient, fn)` pattern.
 */
export function withTenantSchema<T>(schemaName: string, fn: () => Promise<T>): Promise<T> {
  return tenantStore.run(schemaName, fn);
}
