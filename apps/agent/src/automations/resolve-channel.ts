/**
 * Shared utilities for per-tenant automation crons.
 */

import { withSchema } from '@hawk/db';
import { getMainChannelId } from '../channels/discord.js';

/** Lightweight tenant context for cron registration. */
export interface CronTenantCtx {
  slug: string;
  schemaName: string;
}

/**
 * Resolve the main Discord channel for an automation.
 * In multi-tenant mode, uses getMainChannelId(slug).
 * In legacy single-tenant mode, falls back to DISCORD_CHANNEL_GERAL env var.
 */
export function resolveChannel(slug?: string): string | undefined {
  if (slug) {
    return getMainChannelId(slug) ?? undefined;
  }
  return process.env.DISCORD_CHANNEL_GERAL || undefined;
}

/**
 * Wrap a cron callback in withSchema for DB isolation when running per-tenant.
 * In legacy mode (no ctx), runs directly.
 */
export function scopedCron(
  ctx: CronTenantCtx | undefined,
  fn: () => Promise<void>,
): () => Promise<void> {
  if (ctx) {
    return () =>
      withSchema(ctx.schemaName, fn).catch((err) =>
        console.error(`[cron] Error for tenant '${ctx.slug}':`, err),
      );
  }
  return fn;
}
