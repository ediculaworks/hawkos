/**
 * compat/index.ts — barrel re-export for the compat layer
 *
 * Re-exports everything from the three sub-modules so that the top-level
 * compat.ts can stay as a thin forwarding barrel without breaking any
 * existing import paths.
 */

// Core query builder + all types/helpers
export * from './query-builder.ts';

// Mutation surface (re-exports QueryBuilder — included here for discoverability)
// Note: query-builder.ts already exports everything needed; mutations.ts is a
// documentation/grouping module. We do NOT re-export it here to avoid
// duplicate export errors (QueryBuilder and SupabaseResult are already above).

// RPC executor + public client factory + SupabaseCompatClient interface
// SupabaseCompatClient is defined in rpc.ts; SupabaseResult comes from query-builder.ts.
export { executeRpc, createCompatClient } from './rpc.ts';
export type { SupabaseCompatClient } from './rpc.ts';
