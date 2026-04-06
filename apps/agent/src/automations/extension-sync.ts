// Automation: Extension sync
// Periodically syncs all connected extensions based on their sync_interval_minutes.
// Runs every 15 minutes, checks which extensions are due for sync.

import cron, { type ScheduledTask } from 'node-cron';
import { type CronTenantCtx, scopedCron } from './resolve-channel.js';

export function startExtensionSyncCron(ctx?: CronTenantCtx): ScheduledTask {
  const task = cron.schedule(
    '*/15 * * * *',
    scopedCron(ctx, async () => {
      try {
        await runExtensionSync();
      } catch (e) {
        console.error('[extension-sync] Cron error:', e);
      }
    }),
  );
  console.log('[extension-sync] Cron registered: every 15 min');
  return task;
}

export async function runExtensionSync(): Promise<void> {
  // Lazy import to avoid loading extension code at startup if unused
  const { getAllConnections } = await import('@hawk/extensions/core/credentials');
  const { extensionRegistry } = await import('@hawk/extensions/core/registry');
  const { upsertConnection } = await import('@hawk/extensions/core/credentials');
  await import('@hawk/extensions/setup');

  const connections = await getAllConnections();

  for (const conn of connections) {
    // Skip disconnected or sync-disabled
    if (conn.status !== 'connected' || !conn.sync_enabled) continue;

    // Check if sync is due
    const interval = conn.sync_interval_minutes * 60 * 1000;
    const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0;
    const now = Date.now();

    if (now - lastSync < interval) continue;

    const ext = extensionRegistry.get(conn.extension_id);
    if (!ext?.sync) continue;

    try {
      console.log(`[extension-sync] Syncing ${ext.name}...`);
      const result = await ext.sync(conn);

      await upsertConnection(ext.id, {
        last_sync_at: new Date().toISOString(),
        last_error: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      console.log(`[extension-sync] ${ext.name}: ${result.synced} items synced`);
      if (result.errors.length > 0) {
        console.warn(`[extension-sync] ${ext.name} errors:`, result.errors);
      }
    } catch (e) {
      console.error(`[extension-sync] ${ext.name} failed:`, e);
      await upsertConnection(ext.id, {
        last_error: e instanceof Error ? e.message : String(e),
        status: 'error',
      });
    }
  }
}
