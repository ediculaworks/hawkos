/**
 * Mutations — insert, update, delete, upsert surface
 *
 * The actual SQL execution for mutations lives in QueryBuilder's private
 * methods (_executeInsert, _executeUpdate, _executeDelete, _executeUpsert).
 * This file re-exports the QueryBuilder so callers can use it for mutations,
 * and documents which QueryBuilder methods constitute the mutation surface.
 *
 * Mutation methods on QueryBuilder:
 *   .insert(data)                  — INSERT INTO ... VALUES ...
 *   .update(data)                  — UPDATE ... SET ...
 *   .delete()                      — DELETE FROM ...
 *   .upsert(data, { onConflict })  — INSERT ... ON CONFLICT DO UPDATE
 *
 * All of the above support chaining .select() to return the affected rows
 * (equivalent to Supabase's RETURNING * behaviour).
 */

export { QueryBuilder } from './query-builder.ts';
export type { SupabaseResult, PostgrestError } from './query-builder.ts';
