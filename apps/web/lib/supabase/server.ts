// Server-side client — no longer uses Supabase.
// Server components and actions should use `withTenant()` from with-tenant.ts
// which sets up the correct schema context via AsyncLocalStorage.
// This file is kept as a compatibility shim.

export async function createClient() {
  console.warn(
    '[supabase/server] createClient() is deprecated. Use withTenant() from with-tenant.ts instead.',
  );
  // Return the db proxy — it reads schema from AsyncLocalStorage
  const { db } = await import('@hawk/db');
  return db;
}
