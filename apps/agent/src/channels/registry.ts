import type { Channel } from './types.js';

class ChannelRegistry {
  private channels = new Map<string, Channel>();

  register(channel: Channel): void {
    this.channels.set(channel.name, channel);
  }

  get(name: string): Channel | undefined {
    return this.channels.get(name);
  }

  getAll(): Channel[] {
    return Array.from(this.channels.values());
  }

  /** Find which channel owns a JID (e.g., 'discord:123456') */
  resolveChannel(jid: string): Channel | undefined {
    for (const channel of this.channels.values()) {
      if (channel.ownsJid(jid)) return channel;
    }
    return undefined;
  }

  async connectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      await channel.connect();
    }
  }

  async disconnectAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      if (channel.isConnected()) {
        await channel.disconnect();
      }
    }
  }
}

export const channelRegistry = new ChannelRegistry();
