import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface MigrateRequest {
  projectRef: string;
  target: 'admin' | 'tenant';
}

function findMigrationsDir(): string {
  // Try from repo root (turborepo CWD) or from apps/web (direct next dev)
  const fromRoot = path.resolve(process.cwd(), 'packages/db/supabase/migrations');
  const fromWeb = path.resolve(process.cwd(), '../../packages/db/supabase/migrations');
  if (existsSync(fromRoot)) return fromRoot;
  if (existsSync(fromWeb)) return fromWeb;
  throw new Error('Cannot locate packages/db/supabase/migrations');
}

function loadAdminSchema(): string {
  const dir = findMigrationsDir();
  return readFileSync(path.join(dir, '20260410000000_admin_schema.sql'), 'utf-8');
}

function loadTenantMigrations(): string {
  const dir = findMigrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.includes('admin_schema') && !f.includes('pending'))
    .sort();
  return files.map((f) => readFileSync(path.join(dir, f), 'utf-8')).join('\n\n');
}

async function runSql(projectRef: string, sql: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Management API error ${response.status}: ${body}`);
  }
}

async function tableExists(
  projectRef: string,
  tableName: string,
  accessToken: string,
): Promise<boolean> {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `SELECT to_regclass('public.${tableName}') IS NOT NULL AS exists`,
      }),
    },
  );
  if (!response.ok) return false;
  // biome-ignore lint/suspicious/noExplicitAny: management API returns unknown shape
  const data = (await response.json()) as any;
  return data?.[0]?.exists === true || data?.rows?.[0]?.exists === true;
}

export async function POST(request: Request) {
  try {
    const body: MigrateRequest = await request.json();
    const { projectRef, target } = body;

    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { skipped: true, reason: 'SUPABASE_ACCESS_TOKEN not set — migrations skipped' },
        { status: 501 },
      );
    }

    if (target === 'admin') {
      const alreadyApplied = await tableExists(projectRef, 'tenants', accessToken);
      if (!alreadyApplied) {
        const sql = loadAdminSchema();
        await runSql(projectRef, sql, accessToken);
      }
      return NextResponse.json({ applied: !alreadyApplied, target: 'admin' });
    }

    if (target === 'tenant') {
      // Always drop all public tables/types/functions first for a clean slate, then re-apply
      const dropSql = `
        DO $$ DECLARE r RECORD; BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
          LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename); END LOOP;
          FOR r IN (SELECT typname FROM pg_type
                    WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')
          LOOP EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname); END LOOP;
          FOR r IN (
            SELECT p.oid::regprocedure::text AS sig
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND NOT EXISTS (
                SELECT 1 FROM pg_depend d
                WHERE d.objid = p.oid AND d.deptype = 'e'
              )
          )
          LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;
        END $$;
      `;
      await runSql(projectRef, dropSql, accessToken);
      const sql = loadTenantMigrations();
      await runSql(projectRef, sql, accessToken);
      // Notify PostgREST to reload its schema cache so new columns are visible immediately
      await runSql(projectRef, `NOTIFY pgrst, 'reload schema';`, accessToken);
      return NextResponse.json({ applied: true, reset: true, target: 'tenant' });
    }

    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  } catch (error) {
    console.error('[admin/apply-migrations] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 },
    );
  }
}
