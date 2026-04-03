/**
 * Hawk OS — Backup Script
 *
 * Exports critical tables from each tenant's PostgreSQL schema as JSON,
 * compresses with gzip, and uploads to Cloudflare R2.
 *
 * Usage:
 *   bun run scripts/backup.ts              # backup all active tenants
 *   bun run scripts/backup.ts --tenant ten1 # backup single tenant
 *   bun run scripts/backup.ts --cleanup     # only run retention cleanup
 */

import { gunzipSync, gzipSync } from 'node:zlib';
import postgres from 'postgres';
import { deleteFromR2, downloadFromR2, listR2Objects, uploadToR2 } from '@hawk/shared/r2';

// Tables to backup per tenant (order matters for FK dependencies on restore)
const BACKUP_TABLES = [
  'profile',
  'modules',
  'agent_settings',
  'agent_templates',
  'finance_accounts',
  'finance_categories',
  'finance_transactions',
  'finance_recurring_transactions',
  'events',
  'people',
  'interactions',
  'objectives',
  'tasks',
  'health_observations',
  'sleep_sessions',
  'workout_sessions',
  'body_measurements',
  'habits',
  'habit_logs',
  'workspaces',
  'projects',
  'work_logs',
  'assets',
  'legal_contracts',
  'legal_obligations',
  'housing_units',
  'entertainment_items',
  'agent_memories',
  'conversation_messages',
  'session_archives',
  'activity_log',
  'automation_configs',
  'integration_configs',
];

const DAILY_RETENTION = 7;
const WEEKLY_RETENTION = 4;

interface TenantRow {
  slug: string;
  label: string;
  schema_name: string;
  status: string;
}

async function getActiveTenants(sql: postgres.Sql): Promise<TenantRow[]> {
  const rows = await sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL search_path TO admin, public');
    return tx.unsafe("SELECT slug, label, schema_name, status FROM tenants WHERE status = 'active'");
  });
  return rows as TenantRow[];
}

async function backupTenant(
  sql: postgres.Sql,
  tenant: TenantRow,
): Promise<{ tables: number; sizeBytes: number }> {
  const backup: Record<string, unknown[]> = {};
  let totalRows = 0;

  const ROW_LIMIT = 200_000;
  const truncatedTables: string[] = [];

  for (const table of BACKUP_TABLES) {
    try {
      const data = await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${tenant.schema_name}", public`);
        return tx.unsafe(`SELECT * FROM "${table}" LIMIT ${ROW_LIMIT}`);
      });
      if (data && data.length > 0) {
        backup[table] = [...data];
        totalRows += data.length;
        if (data.length >= ROW_LIMIT) {
          truncatedTables.push(table);
          console.warn(`  [${tenant.slug}] WARNING: ${table} hit ${ROW_LIMIT} row limit — data truncated`);
        }
      }
    } catch {
      // Table might not exist in this tenant — skip silently
    }
  }

  const json = JSON.stringify(backup);
  const compressed = gzipSync(Buffer.from(json));

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const isWeekly = now.getDay() === 0;
  const key = isWeekly
    ? `backups/${tenant.slug}/weekly/${dateStr}.json.gz`
    : `backups/${tenant.slug}/daily/${dateStr}.json.gz`;

  const tablesBackedUp = Object.keys(backup).length;

  await uploadToR2(key, compressed, 'application/gzip');

  // Verify backup integrity: download and parse
  try {
    const downloaded = await downloadFromR2(key);
    if (downloaded) {
      const decompressed = gunzipSync(Buffer.from(downloaded));
      const parsed = JSON.parse(decompressed.toString());
      const verifiedTables = Object.keys(parsed).length;
      if (verifiedTables < tablesBackedUp) {
        console.error(`  [${tenant.slug}] INTEGRITY CHECK FAILED: uploaded ${tablesBackedUp} tables, verified ${verifiedTables}`);
      }
    }
  } catch (verifyErr) {
    console.error(`  [${tenant.slug}] INTEGRITY CHECK FAILED:`, verifyErr);
  }

  console.log(
    `  [${tenant.slug}] ${tablesBackedUp} tables, ${totalRows} rows, ${(compressed.length / 1024).toFixed(1)}KB compressed → ${key}`,
  );

  if (truncatedTables.length > 0) {
    console.warn(`  [${tenant.slug}] Truncated tables: ${truncatedTables.join(', ')}`);
  }

  return { tables: tablesBackedUp, sizeBytes: compressed.length };
}

async function cleanupRetention(tenantSlug: string): Promise<number> {
  let deleted = 0;

  const dailyKeys = await listR2Objects(`backups/${tenantSlug}/daily/`);
  const sortedDaily = dailyKeys.sort().reverse();
  for (const key of sortedDaily.slice(DAILY_RETENTION)) {
    await deleteFromR2(key);
    deleted++;
  }

  const weeklyKeys = await listR2Objects(`backups/${tenantSlug}/weekly/`);
  const sortedWeekly = weeklyKeys.sort().reverse();
  for (const key of sortedWeekly.slice(WEEKLY_RETENTION)) {
    await deleteFromR2(key);
    deleted++;
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const singleTenant = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null;
  const cleanupOnly = args.includes('--cleanup');

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  console.log(`[backup] Starting at ${new Date().toISOString()}`);

  let tenants = await getActiveTenants(sql);
  if (singleTenant) {
    tenants = tenants.filter((t) => t.slug === singleTenant);
    if (tenants.length === 0) {
      console.error(`Tenant '${singleTenant}' not found or not active`);
      process.exit(1);
    }
  }

  console.log(`[backup] Found ${tenants.length} active tenant(s)`);

  if (!cleanupOnly) {
    for (const tenant of tenants) {
      try {
        await backupTenant(sql, tenant);
      } catch (err) {
        console.error(`  [${tenant.slug}] FAILED:`, err);
      }
    }
  }

  console.log('[backup] Running retention cleanup...');
  for (const tenant of tenants) {
    const deleted = await cleanupRetention(tenant.slug);
    if (deleted > 0) {
      console.log(`  [${tenant.slug}] Deleted ${deleted} old backup(s)`);
    }
  }

  console.log(`[backup] Done at ${new Date().toISOString()}`);
  await sql.end();
}

main().catch((err) => {
  console.error('[backup] Fatal error:', err);
  process.exit(1);
});
