#!/usr/bin/env bun
/**
 * Applies admin schema to the Admin Supabase project.
 * Usage: bun --env-file=.env scripts/setup-admin.ts
 *
 * Reads ADMIN_SUPABASE_URL, ADMIN_SUPABASE_SERVICE_KEY, and optionally
 * ADMIN_SUPABASE_DB_PASSWORD for direct postgres connection.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adminUrl = process.env.ADMIN_SUPABASE_URL;
const adminServiceKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;
const dbPassword = process.env.ADMIN_SUPABASE_DB_PASSWORD;

if (!adminUrl || !adminServiceKey) {
  console.error('❌ ADMIN_SUPABASE_URL and ADMIN_SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}

const projectRef = adminUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from ADMIN_SUPABASE_URL');
  process.exit(1);
}

const schemaPath = join(import.meta.dir, '../packages/db/supabase/migrations/20260410000000_admin_schema.sql');
const sql = readFileSync(schemaPath, 'utf-8');

if (dbPassword) {
  // Direct postgres connection
  const { default: postgres } = await import('postgres');
  const db = postgres(
    `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    { ssl: 'require', max: 1 },
  );

  console.log(`[setup-admin] Connecting to ${projectRef}...`);
  try {
    await db.unsafe(sql);
    console.log('✅ Admin schema applied successfully!');
  } catch (err) {
    console.error('❌ Failed to apply schema:', err);
    printManualInstructions(projectRef);
    process.exit(1);
  } finally {
    await db.end();
  }
} else {
  console.log('ℹ️  ADMIN_SUPABASE_DB_PASSWORD not set — cannot connect directly.\n');
  printManualInstructions(projectRef);
}

function printManualInstructions(ref: string) {
  console.log('='.repeat(60));
  console.log('MANUAL STEP: Apply admin schema via Supabase SQL Editor');
  console.log('='.repeat(60));
  console.log(`\n1. Open: https://supabase.com/dashboard/project/${ref}/sql/new`);
  console.log('\n2. Paste the contents of:');
  console.log('   packages/db/supabase/migrations/20260410000000_admin_schema.sql');
  console.log('\n3. Click "Run"');
  console.log('\nOr add ADMIN_SUPABASE_DB_PASSWORD to .env to apply automatically.');
  console.log('   (Settings → Database → Connection info → Database password)');
}
