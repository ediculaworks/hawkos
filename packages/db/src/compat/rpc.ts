/**
 * RPC & Public API — executeRpc, rawQuery, SupabaseCompatClient, createCompatClient
 *
 * Provides:
 *   - executeRpc()         — calls a PostgreSQL function via SELECT * FROM fn(params)
 *   - SupabaseCompatClient — interface matching the Supabase client surface used in modules
 *   - createCompatClient() — factory that returns a SupabaseCompatClient backed by postgres.js
 */

import { getCurrentSchema, getPool } from '../sql.ts';
import { QueryBuilder } from './query-builder.ts';
import type { SupabaseResult } from './query-builder.ts';

// ── Helper: escape identifier ───────────────────────────────────────────────
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ── RPC Executor ────────────────────────────────────────────────────────────

export async function executeRpc<T = unknown>(
  functionName: string,
  params?: Record<string, unknown>,
): Promise<SupabaseResult<T>> {
  const sql = getPool();
  const schema = getCurrentSchema();

  try {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);

      if (!params || Object.keys(params).length === 0) {
        return tx.unsafe(`SELECT * FROM ${ident(functionName)}()`);
      }

      const paramEntries = Object.entries(params);
      const paramStr = paramEntries
        .map(([key, val]) => {
          if (val === null || val === undefined) return `${key} := NULL`;
          if (typeof val === 'number') return `${key} := ${val}`;
          if (typeof val === 'boolean') return `${key} := ${val}`;
          if (typeof val === 'string') {
            // Check if it looks like a vector array
            if (val.startsWith('[') && val.includes(',')) {
              return `${key} := '${val}'::vector`;
            }
            return `${key} := '${val.replace(/'/g, "''")}'`;
          }
          if (Array.isArray(val)) {
            // Vector embedding array
            return `${key} := '[${val.join(',')}]'::vector`;
          }
          return `${key} := '${JSON.stringify(val).replace(/'/g, "''")}'`;
        })
        .join(', ');

      return tx.unsafe(`SELECT * FROM ${ident(functionName)}(${paramStr})`);
    });

    const data = result.length === 1 ? result[0] : [...result];
    return { data: data as T, error: null, count: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: { message, details: '', hint: '', code: 'PGRST000' },
      count: null,
    };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface SupabaseCompatClient {
  // biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's dynamic typing
  from: <T = any>(table: string) => QueryBuilder<T>;
  // biome-ignore lint/suspicious/noExplicitAny: Matches Supabase's dynamic typing
  rpc: <T = any>(fn: string, params?: Record<string, unknown>) => Promise<SupabaseResult<T>>;
}

export function createCompatClient(): SupabaseCompatClient {
  return {
    from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
      return new QueryBuilder<T>(table);
    },
    rpc<T = unknown>(fn: string, params?: Record<string, unknown>): Promise<SupabaseResult<T>> {
      return executeRpc<T>(fn, params);
    },
  };
}
