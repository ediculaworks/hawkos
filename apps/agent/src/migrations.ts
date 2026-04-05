import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPool } from '@hawk/db';

// Resolve migration files relative to this module (works in dev and Docker)
const MIGRATIONS_DIR = join(import.meta.dir, '../../../packages/db/supabase/migrations');

// Files that belong to the admin schema — skip when applying to tenant schemas
const ADMIN_MIGRATION_PREFIXES = [
  '20260410', // admin schema
  '20260411', // admin schema encrypt
  '20260419', // dynamic tenants
  '20260420130000', // owner_email (admin column)
];

function isAdminMigration(filename: string): boolean {
  return ADMIN_MIGRATION_PREFIXES.some((prefix) => filename.startsWith(prefix));
}

export async function applyMigrationsForSchema(schemaName: string): Promise<void> {
  const sql = getPool();

  let files: string[];
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !isAdminMigration(f))
      .sort();
  } catch {
    console.warn(`[migrations] Could not read migrations dir: ${MIGRATIONS_DIR}`);
    return;
  }

  console.log(`[migrations] Applying ${files.length} migrations to schema "${schemaName}"`);

  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    let migrationSql = readFileSync(filePath, 'utf-8').trim();
    if (!migrationSql) continue;

    // Strip outer BEGIN/COMMIT — we wrap in our own transaction
    migrationSql = migrationSql.replace(/^BEGIN;\s*/im, '').replace(/\s*COMMIT;\s*$/im, '');

    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
        await tx.unsafe(migrationSql);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        // idempotent — skip
      } else {
        console.warn(`[migrations] ${file}: ${msg}`);
      }
    }
  }

  console.log(`[migrations] Done for schema "${schemaName}"`);
}
