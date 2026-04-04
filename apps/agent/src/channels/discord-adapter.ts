import type { TenantContext } from '../tenant-manager.js';
import {
  disconnectDiscord,
  disconnectDiscordForTenant,
  sendToChannel,
  startDiscordBot,
  startDiscordBotForTenant,
} from './discord.js';
import { type Channel, DISCORD_CAPABILITIES } from './types.js';

let connected = false;

/**
 * Thin Channel adapter wrapping the existing Discord module.
 * Used by the channelRegistry for legacy single-tenant mode.
 */
export const discordChannel: Channel = {
  name: 'discord',
  capabilities: DISCORD_CAPABILITIES,

  async connect(): Promise<void> {
    await startDiscordBot();
    connected = true;
  },

  async send(channelId: string, content: string): Promise<void> {
    await sendToChannel(channelId, content);
  },

  ownsJid(jid: string): boolean {
    return jid.startsWith('discord:');
  },

  isConnected(): boolean {
    return connected;
  },

  async disconnect(): Promise<void> {
    disconnectDiscord();
    connected = false;
  },
};

// ── Multi-tenant adapter ─────────────────────────────────────────────────────

/**
 * Connect Discord for a specific tenant.
 * Returns a Channel-like object scoped to that tenant.
 */
export async function connectDiscordForTenant(ctx: TenantContext): Promise<void> {
  await startDiscordBotForTenant(ctx);
}

/**
 * Disconnect Discord for a specific tenant.
 */
export function disconnectTenantDiscord(slug: string): void {
  disconnectDiscordForTenant(slug);
}
