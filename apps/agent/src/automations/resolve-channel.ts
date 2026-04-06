/**
 * Resolve the main Discord channel for an automation.
 * In multi-tenant mode, uses getMainChannelId(slug).
 * In legacy single-tenant mode, falls back to DISCORD_CHANNEL_GERAL env var.
 */

import { getMainChannelId } from '../channels/discord.js';

export function resolveChannel(slug?: string): string | undefined {
  if (slug) {
    return getMainChannelId(slug) ?? undefined;
  }
  return process.env.DISCORD_CHANNEL_GERAL || undefined;
}
