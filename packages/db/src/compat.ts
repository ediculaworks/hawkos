/**
 * Supabase-compatible Query Builder for PostgreSQL
 *
 * Provides the same `.from().select().eq().order()` API that Supabase PostgREST
 * uses, but generates SQL and executes it via postgres.js directly.
 *
 * This allows all 18 module query files to work WITHOUT syntax changes.
 *
 * Implementation is split across:
 *   compat/query-builder.ts — QueryBuilder class, types, SQL helpers
 *   compat/mutations.ts     — documentation of insert/update/delete/upsert surface
 *   compat/rpc.ts           — executeRpc(), SupabaseCompatClient, createCompatClient()
 *   compat/index.ts         — barrel that re-exports all of the above
 */

export * from './compat/index.ts';
