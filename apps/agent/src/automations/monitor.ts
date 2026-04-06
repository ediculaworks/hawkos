// Automation: Health monitoring
// Checks agent health, Supabase connectivity, and Discord status every 5 minutes.
// Sends alerts to Discord if any check fails.

import { db, getCurrentSchema } from '@hawk/db';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { resolveChannel } from './resolve-channel.js';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_ALERTS;

const startTime = Date.now();
let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min between alerts

interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string;
}

async function checkMemory(): Promise<HealthCheck> {
  const usage = process.memoryUsage();
  const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const limitMB = 450; // 512M container limit minus buffer

  if (rssMB > limitMB) {
    return { name: 'memory', status: 'error', detail: `RSS ${rssMB}MB exceeds ${limitMB}MB limit` };
  }
  if (rssMB > limitMB * 0.8) {
    return {
      name: 'memory',
      status: 'warn',
      detail: `RSS ${rssMB}MB (${Math.round((rssMB / limitMB) * 100)}% of limit)`,
    };
  }
  return { name: 'memory', status: 'ok', detail: `heap=${heapMB}MB rss=${rssMB}MB` };
}

async function checkSupabase(): Promise<HealthCheck> {
  try {
    const start = Date.now();
    const { error } = await db.from('profile').select('id').limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { name: 'supabase', status: 'error', detail: error.message };
    }
    if (latency > 5000) {
      return { name: 'supabase', status: 'warn', detail: `${latency}ms latency` };
    }
    return { name: 'supabase', status: 'ok', detail: `${latency}ms` };
  } catch (err) {
    return {
      name: 'supabase',
      status: 'error',
      detail: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

function checkUptime(): HealthCheck {
  const uptimeMs = Date.now() - startTime;
  const hours = Math.floor(uptimeMs / 3600000);
  const mins = Math.floor((uptimeMs % 3600000) / 60000);
  return { name: 'uptime', status: 'ok', detail: `${hours}h ${mins}m` };
}

async function sendWebhookAlert(message: string): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    // Webhook itself failed — nothing we can do
  }
}

export async function runHealthCheck(slug?: string): Promise<HealthCheck[]> {
  const checks = await Promise.all([checkMemory(), checkSupabase(), checkUptime()]);

  // Resolve tenant at runtime
  const schema = getCurrentSchema();
  const tenantSlug = schema.startsWith('tenant_')
    ? schema.replace('tenant_', '')
    : (process.env.AGENT_SLOT ?? 'local');

  // Update agent_status in database
  try {
    await db.from('agent_status').upsert(
      {
        id: '00000000-0000-0000-0000-000000000001',
        status: checks.some((c) => c.status === 'error') ? 'degraded' : 'online',
        last_heartbeat: new Date().toISOString(),
        metadata: {
          checks: Object.fromEntries(
            checks.map((c) => [c.name, { status: c.status, detail: c.detail }]),
          ),
          tenant: tenantSlug,
        },
      },
      { onConflict: 'id' },
    );
  } catch {
    // Don't fail the whole check if status update fails
  }

  // Alert on errors (with cooldown)
  const errors = checks.filter((c) => c.status === 'error');
  if (errors.length > 0 && Date.now() - lastAlertAt > ALERT_COOLDOWN_MS) {
    lastAlertAt = Date.now();
    const errorLines = errors.map((e) => `- ${e.name}: ${e.detail}`).join('\n');
    const alertMsg = `⚠️ [${tenantSlug}] Health check failed:\n${errorLines}`;

    const channelId = resolveChannel(slug);
    if (channelId) {
      await sendToChannel(channelId, alertMsg, slug).catch(() => {});
    }
    await sendWebhookAlert(alertMsg);
  }

  return checks;
}

export function startMonitorCron(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runHealthCheck();
    } catch (err) {
      console.error('[monitor] Health check error:', err);
    }
  });

  console.log('[monitor] Cron scheduled: */5 * * * *');
}
