import { AsyncLocalStorage } from 'node:async_hooks';
import postgres from 'postgres';

// ── Connection Pool ─────────────────────────────────────────────────────────
// Single postgres.js instance shared across the entire application.
// Uses DATABASE_URL (direct) or DATABASE_POOL_URL (via PgBouncer).

let pool: postgres.Sql | null = null;

export function getPool(): postgres.Sql {
  if (pool) return pool;

  const url = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL or DATABASE_POOL_URL must be set. ' +
        'Example: postgres://hawkos:password@localhost:5432/hawkos',
    );
  }

  pool = postgres(url, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
    // Transform column names: snake_case from DB → snake_case in JS (no transform)
    transform: { undefined: null },
  });

  return pool;
}

/** Gracefully close the connection pool (for shutdown hooks). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ── Tenant Schema Context ───────────────────────────────────────────────────
// AsyncLocalStorage stores the current tenant's schema name.
// When set, all queries via the compat layer will SET search_path accordingly.

export const schemaStore = new AsyncLocalStorage<string>();

/** Returns the current tenant schema or 'public' as fallback. */
export function getCurrentSchema(): string {
  return schemaStore.getStore() ?? process.env.TENANT_SCHEMA ?? 'public';
}

/**
 * Run a function within a specific tenant schema context.
 * All db queries inside `fn` will use SET search_path TO <schema>, public.
 */
export function withSchema<T>(schema: string, fn: () => Promise<T>): Promise<T> {
  return schemaStore.run(schema, fn);
}

const VALID_SCHEMA_PATTERN = /^[a-z0-9_]+$/;

/** Validates schema name to prevent SQL injection via search_path. */
export function validateSchemaName(schema: string): void {
  if (!VALID_SCHEMA_PATTERN.test(schema)) {
    throw new Error(`Invalid schema name: ${schema}`);
  }
}

/**
 * Execute raw SQL string within the current tenant's schema context.
 * Automatically prepends SET search_path.
 */
export async function rawQuery(
  query: string,
  params?: readonly (string | number | boolean | null)[],
): Promise<Record<string, unknown>[]> {
  const sql = getPool();
  const schema = getCurrentSchema();
  validateSchemaName(schema);

  const result = await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
    return tx.unsafe(query, params as (string | number | boolean | null)[]);
  });
  return [...result] as Record<string, unknown>[];
}

/**
 * Execute a transaction scoped to a specific tenant schema.
 * Validates the schema name before use to prevent SQL injection.
 * Use this instead of manual `tx.unsafe('SET LOCAL search_path ...')`.
 */
export async function scopedTransaction<T>(
  schema: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  validateSchemaName(schema);
  const sql = getPool();
  return sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
    return fn(tx);
  }) as Promise<T>;
}

// Re-export postgres for raw SQL usage in modules
export { postgres };
export type { Sql } from 'postgres';
