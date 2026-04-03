#!/usr/bin/env bun
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const MIGRATIONS_DIR = join(import.meta.dir, '../packages/db/supabase/migrations');

async function applyMigrations(schemaName?: string) {
  const targetSchema = schemaName || process.env.TENANT_SCHEMA || 'public';

  console.log(`Applying migrations to schema: ${targetSchema}`);

  // Create schema if it doesn't exist
  if (targetSchema !== 'public') {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
  }

  // Get migration files sorted
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    let migrationSql = readFileSync(filePath, 'utf-8');

    // Skip empty files
    if (!migrationSql.trim()) continue;

    try {
      await sql.begin(async (tx) => {
        // Set schema for this migration
        await tx.unsafe(`SET LOCAL search_path TO "${targetSchema}", public`);

        // Remove BEGIN/COMMIT since we're already in a transaction
        migrationSql = migrationSql
          .replace(/^BEGIN;\s*/im, '')
          .replace(/\s*COMMIT;\s*$/im, '');

        // Skip RLS policies that reference 'authenticated' role if role doesn't exist
        // (the init.sql creates the role, but just in case)
        await tx.unsafe(migrationSql);
      });
      console.log(`  ✅ ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Skip "already exists" errors
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  ⏭️  ${file} (already applied)`);
      } else {
        console.error(`  ❌ ${file}: ${msg}`);
      }
    }
  }

  console.log('✅ Migration complete');
}

// Usage: bun scripts/apply-migrations.ts [schema_name]
const schemaArg = process.argv[2];
applyMigrations(schemaArg)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sql.end());
