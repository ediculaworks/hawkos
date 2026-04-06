// Automation: Backup diário
// Exporta tabelas críticas do tenant como JSON comprimido.
// Salva localmente em /data/backups/ (volume Docker) ou em R2 se configurado.
// Cron: 03:00 diário

import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { db, getCurrentSchema } from '@hawk/db';
import cron, { type ScheduledTask } from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { type CronTenantCtx, resolveChannel, scopedCron } from './resolve-channel.js';

const BACKUP_DIR = process.env.BACKUP_DIR || '/data/backups';

// Retention
const DAILY_RETENTION = 7;
const WEEKLY_RETENTION = 4;

const BACKUP_TABLES = [
  'profile',
  'modules',
  'agent_settings',
  'finance_accounts',
  'finance_categories',
  'finance_transactions',
  'events',
  'people',
  'interactions',
  'objectives',
  'tasks',
  'health_observations',
  'sleep_sessions',
  'workout_sessions',
  'habits',
  'habit_logs',
  'agent_memories',
  'conversation_messages',
  'session_archives',
  'activity_log',
];

async function saveLocal(filePath: string, data: Buffer): Promise<void> {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, data);
}

async function saveToR2(key: string, data: Buffer): Promise<void> {
  // Dynamic import — only loads if R2 env vars are configured
  const { uploadToR2 } = await import('@hawk/shared/r2');
  await uploadToR2(key, data, 'application/gzip');
}

function cleanupLocal(dir: string, maxFiles: number): number {
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).sort().reverse();
  let deleted = 0;
  for (const file of files.slice(maxFiles)) {
    unlinkSync(join(dir, file));
    deleted++;
  }
  return deleted;
}

export async function runBackup(_slug?: string): Promise<string> {
  // Resolve tenant slug at runtime
  const schema = getCurrentSchema();
  const tenantSlug = schema.startsWith('tenant_')
    ? schema.replace('tenant_', '')
    : (process.env.AGENT_SLOT ?? 'local');

  const backup: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    try {
      const { data } = await db
        // biome-ignore lint/suspicious/noExplicitAny: dynamic table names from BACKUP_TABLES
        .from(table as any)
        .select('*')
        .limit(50000);
      if (data && data.length > 0) {
        backup[table] = data;
        totalRows += data.length;
      }
    } catch {
      // Table might not exist — skip
    }
  }

  const json = JSON.stringify(backup);
  const compressed = gzipSync(Buffer.from(json));
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const isWeekly = now.getDay() === 0;
  const prefix = isWeekly ? 'weekly' : 'daily';
  const fileName = `${dateStr}.json.gz`;

  // Always save locally
  const localPath = join(BACKUP_DIR, tenantSlug, prefix, fileName);
  await saveLocal(localPath, compressed);

  // Optionally upload to R2 if configured
  const hasR2 =
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
  if (hasR2) {
    try {
      await saveToR2(`backups/${tenantSlug}/${prefix}/${fileName}`, compressed);
    } catch (err) {
      console.warn(`[backup] R2 upload failed (local backup saved): ${err}`);
    }
  }

  // Cleanup old local backups
  cleanupLocal(join(BACKUP_DIR, tenantSlug, 'daily'), DAILY_RETENTION);
  cleanupLocal(join(BACKUP_DIR, tenantSlug, 'weekly'), WEEKLY_RETENTION);

  const tables = Object.keys(backup).length;
  const sizeKB = (compressed.length / 1024).toFixed(1);
  const dest = hasR2 ? 'local + R2' : 'local';
  return `${tables} tables, ${totalRows} rows, ${sizeKB}KB (${dest})`;
}

export function startBackupCron(ctx?: CronTenantCtx): ScheduledTask {
  const slug = ctx?.slug;
  return cron.schedule(
    '0 3 * * *',
    scopedCron(ctx, async () => {
      try {
        const result = await runBackup(slug);
        console.log(`[backup] Success: ${result}`);

        await db.from('activity_log').insert({
          event_type: 'automation',
          summary: `Backup completed: ${result}`,
          module: null,
          metadata: { automation: 'backup' },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backup] Failed: ${msg}`);

        const channelId = resolveChannel(slug);
        if (channelId) {
          await sendToChannel(channelId, `⚠️ Backup falhou: ${msg}`, slug).catch(() => {});
        }
      }
    }),
  );
}
