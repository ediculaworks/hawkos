/**
 * Hawk OS — Backup Script
 *
 * Exports critical tables from each tenant's Supabase as JSON,
 * compresses with gzip, and uploads to Cloudflare R2.
 *
 * Usage:
 *   bun run scripts/backup.ts              # backup all active tenants
 *   bun run scripts/backup.ts --tenant ten1 # backup single tenant
 *   bun run scripts/backup.ts --cleanup     # only run retention cleanup
 */

import { createDecipheriv, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { deleteFromR2, listR2Objects, uploadToR2 } from '@hawk/shared/r2';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const SALT = 'hawk-os-admin-salt-v1';

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

// Retention: 7 daily + 4 weekly
const DAILY_RETENTION = 7;
const WEEKLY_RETENTION = 4;

function deriveKey(masterKey: string): Buffer {
  return createHash('sha256').update(masterKey + SALT).digest();
}

function decrypt(encryptedData: string, iv: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const ivBuffer = Buffer.from(iv, 'base64');
  const combined = Buffer.from(encryptedData, 'base64');
  const encrypted = combined.slice(0, -TAG_LENGTH);
  const tag = combined.slice(-TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

interface TenantRow {
  slug: string;
  label: string;
  supabase_url: string;
  supabase_anon_key: string;
  supabase_service_key_encrypted: string;
  supabase_service_key_iv: string;
  status: string;
}

async function getActiveTenants(): Promise<TenantRow[]> {
  const adminUrl = process.env.ADMIN_SUPABASE_URL;
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!adminUrl || !adminKey) throw new Error('ADMIN_SUPABASE_URL and ADMIN_SUPABASE_SERVICE_KEY required');

  const admin = createClient(adminUrl, adminKey, { auth: { persistSession: false } });
  const { data, error } = await admin.from('tenants').select('*').eq('status', 'active');
  if (error) throw error;
  return (data || []) as TenantRow[];
}

async function backupTenant(tenant: TenantRow, masterKey: string): Promise<{ tables: number; sizeBytes: number }> {
  const serviceKey = decrypt(tenant.supabase_service_key_encrypted, tenant.supabase_service_key_iv, masterKey);
  const supabase = createClient(tenant.supabase_url, serviceKey, { auth: { persistSession: false } });

  const backup: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(50000);
      if (error) {
        // Table might not exist in this tenant — skip silently
        if (error.code === '42P01' || error.message.includes('does not exist')) continue;
        console.warn(`  [${tenant.slug}] Warning: ${table} — ${error.message}`);
        continue;
      }
      if (data && data.length > 0) {
        backup[table] = data;
        totalRows += data.length;
      }
    } catch {
      // Skip tables that don't exist
    }
  }

  const json = JSON.stringify(backup);
  const compressed = gzipSync(Buffer.from(json));

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const isWeekly = now.getDay() === 0; // Sunday
  const key = isWeekly
    ? `backups/${tenant.slug}/weekly/${dateStr}.json.gz`
    : `backups/${tenant.slug}/daily/${dateStr}.json.gz`;

  await uploadToR2(key, compressed, 'application/gzip');

  const tablesBackedUp = Object.keys(backup).length;
  console.log(`  [${tenant.slug}] ${tablesBackedUp} tables, ${totalRows} rows, ${(compressed.length / 1024).toFixed(1)}KB compressed → ${key}`);

  return { tables: tablesBackedUp, sizeBytes: compressed.length };
}

async function cleanupRetention(tenantSlug: string): Promise<number> {
  let deleted = 0;

  // Cleanup daily backups
  const dailyKeys = await listR2Objects(`backups/${tenantSlug}/daily/`);
  const sortedDaily = dailyKeys.sort().reverse();
  for (const key of sortedDaily.slice(DAILY_RETENTION)) {
    await deleteFromR2(key);
    deleted++;
  }

  // Cleanup weekly backups
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

  const masterKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!masterKey) {
    console.error('ADMIN_SUPABASE_SERVICE_KEY is required');
    process.exit(1);
  }

  console.log(`[backup] Starting at ${new Date().toISOString()}`);

  let tenants = await getActiveTenants();
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
        await backupTenant(tenant, masterKey);
      } catch (err) {
        console.error(`  [${tenant.slug}] FAILED:`, err);
      }
    }
  }

  // Cleanup old backups
  console.log('[backup] Running retention cleanup...');
  for (const tenant of tenants) {
    const deleted = await cleanupRetention(tenant.slug);
    if (deleted > 0) {
      console.log(`  [${tenant.slug}] Deleted ${deleted} old backup(s)`);
    }
  }

  console.log(`[backup] Done at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('[backup] Fatal error:', err);
  process.exit(1);
});
