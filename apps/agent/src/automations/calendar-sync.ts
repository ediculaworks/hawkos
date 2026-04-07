// Automation: Google Calendar Sync
// Polls Google Calendar API every 5 minutes for tenants with a connected account.
// Uses incremental sync (syncToken) after the first full import.

import { getGoogleSyncConfig, importGoogleEvents } from '@hawk/module-calendar/google-sync';
import cron, { type ScheduledTask } from 'node-cron';
import { type CronTenantCtx, scopedCron } from './resolve-channel.js';

export async function runCalendarSync(): Promise<void> {
  // Only run if Google OAuth credentials are configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;

  const config = await getGoogleSyncConfig();
  if (!config) return; // No Google Calendar connected for this tenant

  try {
    const result = await importGoogleEvents(config);
    if (result.imported > 0 || result.updated > 0) {
      console.log(
        `[calendar-sync] Synced: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`,
      );
    }
  } catch (err) {
    console.error('[calendar-sync] Sync failed:', err);
  }
}

export function startCalendarSyncCron(ctx?: CronTenantCtx): ScheduledTask {
  return cron.schedule(
    '*/5 * * * *',
    scopedCron(ctx, () => runCalendarSync()),
  );
}
