import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getPool } from '@hawk/db';
import { NextResponse } from 'next/server';

interface MigrateRequest {
  tenantSlug: string;
  schemaName: string;
}

function findMigrationsDir(): string {
  const fromRoot = path.resolve(process.cwd(), 'packages/db/supabase/migrations');
  const fromWeb = path.resolve(process.cwd(), '../../packages/db/supabase/migrations');
  if (existsSync(fromRoot)) return fromRoot;
  if (existsSync(fromWeb)) return fromWeb;
  throw new Error('Cannot locate packages/db/supabase/migrations');
}

function loadTenantMigrationFiles(): { name: string; sql: string }[] {
  const dir = findMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.includes('admin_schema') && !f.includes('pending'))
    .sort();
  return files.map((f) => ({ name: f, sql: readFileSync(path.join(dir, f), 'utf-8') }));
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const body: MigrateRequest = await request.json();
  const { schemaName } = body;

  if (!schemaName || !/^[a-z_][a-z0-9_]*$/.test(schemaName)) {
    return NextResponse.json({ error: 'Invalid schema name' }, { status: 400 });
  }

  const sql = getPool();

  try {
    // Ensure schema exists
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    const files = loadTenantMigrationFiles();
    const results: { file: string; status: 'ok' | 'skipped'; error?: string }[] = [];

    for (const file of files) {
      const { name } = file;
      let migrationSql = file.sql;

      if (!migrationSql.trim()) continue;

      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);

          // Remove BEGIN/COMMIT since we're already in a transaction
          migrationSql = migrationSql.replace(/^BEGIN;\s*/im, '').replace(/\s*COMMIT;\s*$/im, '');

          await tx.unsafe(migrationSql);
        });
        results.push({ file: name, status: 'ok' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          results.push({ file: name, status: 'skipped' });
        } else {
          results.push({ file: name, status: 'skipped', error: msg });
          console.warn(`[apply-migrations] Skipped ${name}: ${msg}`);
        }
      }
    }

    const applied = results.filter((r) => r.status === 'ok').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;

    return NextResponse.json({
      success: true,
      schema: schemaName,
      applied,
      skipped,
      total: files.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[apply-migrations] Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
