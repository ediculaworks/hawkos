import { disconnectDiscord, sendToChannel, startDiscordBot } from './discord.js';
import { type Channel, DISCORD_CAPABILITIES } from './types.js';

let connected = false;

/**
 * Thin Channel adapter wrapping the existing Discord module.
 * Does not rewrite discord.ts — delegates to existing exports.
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
