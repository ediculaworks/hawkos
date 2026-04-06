/**
 * Activity logging — writes events to activity_log table.
 * Extracted from handler.ts for reuse across agent components.
 * Includes rate limiting to prevent DB spam on high-volume errors.
 */

import { db, getCurrentSchema } from '@hawk/db';

// Rate limiting: max 10 writes per event_type per 10 seconds (scoped per-tenant)
const _rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 10_000;

function isRateLimited(eventType: string): boolean {
  const schema = getCurrentSchema();
  const key = `${schema}:${eventType}`;
  const now = Date.now();
  const entry = _rateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    _rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export async function logActivity(
  eventType: string,
  summary: string,
  moduleName?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const logLine = `[activity] ${eventType} ${moduleName ?? '-'}: ${summary}`;
  if (eventType === 'error') {
    console.error(logLine);
  }

  if (isRateLimited(eventType)) return;

  // Resolve tenant slug at call time from schema context (not module-level env var)
  const schema = getCurrentSchema();
  const tenantSlug = schema.startsWith('tenant_')
    ? schema.replace('tenant_', '')
    : (process.env.AGENT_SLOT ?? 'local');

  try {
    await db.from('activity_log').insert({
      event_type: eventType,
      module: moduleName ?? undefined,
      summary,
      metadata: metadata ?? {},
      tenant_id: tenantSlug,
    });
  } catch (err) {
    console.error('[activity-logger] Failed to write:', err);
  }
}
