import { withSchema } from '@hawk/db';
import { AuthorizationError } from '@hawk/shared';
import {
  ChannelType,
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type Message,
  Partials,
} from 'discord.js';
import { handleStreamingMessage } from '../handler.js';
import type { TenantContext } from '../tenant-manager.js';
import { ALL_COMMANDS, handleSlashCommand } from './module-commands.js';

// ── Per-tenant Discord clients ───────────────────────────────────────────────

/** Map of slug → Discord Client. One client per tenant. */
const tenantClients = new Map<string, Client>();

// ── Channel → Agent Mapping ──────────────────────────────────
// Format: DISCORD_CHANNEL_MAP=channelId1:agentTemplateId1,channelId2:agentTemplateId2

function parseChannelMap(raw?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (raw) {
    for (const pair of raw.split(',')) {
      const [channelId, agentId] = pair.trim().split(':');
      if (channelId && agentId) {
        map.set(channelId.trim(), agentId.trim());
      }
    }
  }
  return map;
}

/**
 * Get the agent template ID for a Discord channel.
 * Returns undefined for channels using the default Hawk agent.
 */
export function getAgentForChannel(channelId: string): string | undefined {
  // Check all tenant channel maps
  for (const [, client] of tenantClients) {
    const meta = clientMeta.get(client);
    if (meta?.channelAgentMap.has(channelId)) {
      return meta.channelAgentMap.get(channelId);
    }
  }
  return undefined;
}

// ── Per-client metadata ──────────────────────────────────────────────────────

interface ClientMeta {
  ctx: TenantContext;
  authorizedUserId: string;
  allowedChannels: Set<string>;
  channelAgentMap: Map<string, string>;
  mainChannelId?: string;
}

const clientMeta = new Map<Client, ClientMeta>();

// ── Voice/Audio Transcription ────────────────────────────────

async function transcribeAudio(url: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[discord] No GROQ_API_KEY or OPENAI_API_KEY set, cannot transcribe audio');
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const audioBuffer = await response.arrayBuffer();

    const baseUrl = process.env.GROQ_API_KEY
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1';
    const model = process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1';

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
    formData.append('model', model);
    formData.append('language', 'pt');

    const result = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!result.ok) {
      console.error('[discord] Transcription failed:', result.status, await result.text());
      return null;
    }

    const data = (await result.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch (err) {
    console.error('[discord] Transcription error:', err);
    return null;
  }
}

// ALL_COMMANDS and handleSlashCommand are imported from ./module-commands.js

// ── Create & connect a Discord client for a tenant ───────────────────────────

export async function startDiscordBotForTenant(ctx: TenantContext): Promise<Client> {
  const discord = ctx.credentials.discordConfig;
  if (!discord?.bot_token) {
    throw new Error(`[discord] Tenant '${ctx.slug}' has no Discord bot token`);
  }
  if (!discord.user_id) {
    throw new Error(`[discord] Tenant '${ctx.slug}' has no authorized user ID`);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  const channelAgentMap = parseChannelMap(discord.channel_map);
  const allowedChannels = new Set<string>();
  if (discord.channel_id) allowedChannels.add(discord.channel_id);
  for (const channelId of channelAgentMap.keys()) {
    allowedChannels.add(channelId);
  }

  const meta: ClientMeta = {
    ctx,
    authorizedUserId: discord.user_id,
    allowedChannels,
    channelAgentMap,
    mainChannelId: discord.channel_id,
  };
  clientMeta.set(client, meta);

  // ── Ready: register slash commands ──
  client.once(Events.ClientReady, async (c) => {
    const guildId = discord.guild_id;
    if (guildId) {
      const guild = await c.guilds.fetch(guildId);
      await guild.commands.set(ALL_COMMANDS);
    }
    console.log(`[discord] Tenant '${ctx.slug}' bot ready as ${c.user.tag}`);
  });

  // ── Messages ──
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.author.id !== meta.authorizedUserId) return;
    const isDM = message.channel.type === ChannelType.DM;
    if (!isDM && !meta.allowedChannels.has(message.channelId)) return;

    // Run within tenant schema context
    await withSchema(ctx.schemaName, async () => {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      try {
        let textContent = message.content;
        const imageUrls: string[] = [];
        let wasTranscribed = false;

        // Process attachments (voice messages, images)
        if (message.attachments.size > 0) {
          for (const attachment of message.attachments.values()) {
            const ct = attachment.contentType ?? '';

            if (
              ct.startsWith('audio/') ||
              ct === 'video/ogg' ||
              attachment.name?.endsWith('.ogg')
            ) {
              const transcription = await transcribeAudio(attachment.url);
              if (transcription) {
                textContent = transcription;
                wasTranscribed = true;
              } else {
                await message.reply(
                  'Não consegui transcrever o áudio. Verifique se GROQ_API_KEY ou OPENAI_API_KEY está configurado.',
                );
                return;
              }
            }

            if (ct.startsWith('image/')) {
              imageUrls.push(attachment.url);
            }
          }
        }

        if (!textContent && imageUrls.length === 0) return;

        const attachments =
          imageUrls.length > 0
            ? imageUrls.map((url) => ({ type: 'image' as const, url }))
            : undefined;

        // Stream response
        const streamMsg = await message.reply('...');
        let accumulated = wasTranscribed ? `*"${textContent}"*\n\n` : '';
        let lastEdit = Date.now();
        const EDIT_INTERVAL = 800;

        const response = await handleStreamingMessage(
          textContent || 'Descreva esta imagem',
          message.channelId,
          (chunk: string) => {
            accumulated += chunk;
            const now = Date.now();
            if (now - lastEdit > EDIT_INTERVAL && accumulated.length <= 2000) {
              lastEdit = now;
              streamMsg.edit(accumulated).catch(() => {});
            }
          },
          attachments,
        );

        const finalResponse = wasTranscribed ? `*"${textContent}"*\n\n${response}` : response;

        if (finalResponse.length <= 2000) {
          await streamMsg.edit(finalResponse);
        } else {
          await streamMsg.edit(finalResponse.slice(0, 2000));
          const remaining = finalResponse.slice(2000);
          const chunks = remaining.match(/.{1,2000}/gs) ?? [];
          const channel = message.channel;
          if (channel && 'send' in channel && typeof channel.send === 'function') {
            for (const chunk of chunks) {
              await channel.send(chunk);
            }
          }
        }
      } catch (err) {
        if (err instanceof AuthorizationError) return;
        await message.reply('Erro interno. Tente novamente.');
      }
    });
  });

  // ── Slash command interactions ──
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.user.id !== meta.authorizedUserId) {
      await interaction.reply({ content: 'Não autorizado.', ephemeral: true });
      return;
    }

    const cmd = interaction as ChatInputCommandInteraction;
    await withSchema(ctx.schemaName, async () => {
      try {
        await handleSlashCommand(cmd);
      } catch (_err) {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: 'Erro ao processar comando. Tente novamente.',
            ephemeral: true,
          });
        }
      }
    });
  });

  await client.login(discord.bot_token);

  // Store references
  tenantClients.set(ctx.slug, client);
  ctx.discordClient = client;

  return client;
}

// ── Send to channel (tenant-aware) ───────────────────────────────────────────

export async function sendToChannel(
  channelId: string,
  content: string,
  slug?: string,
): Promise<void> {
  // Find the client that owns this channel
  let client: Client | undefined;

  if (slug) {
    client = tenantClients.get(slug);
  } else {
    // Search all clients for one that has this channel allowed
    for (const [, c] of tenantClients) {
      const meta = clientMeta.get(c);
      if (meta?.allowedChannels.has(channelId)) {
        client = c;
        break;
      }
    }
    // No fallback in multi-tenant — never send to a random tenant's client
    if (!client && tenantClients.size > 1) {
      console.warn(
        `[discord] sendToChannel without slug in multi-tenant mode (channelId=${channelId})`,
      );
    }
  }

  if (!client) return;

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) return;

  if ('send' in channel && typeof channel.send === 'function') {
    if (content.length <= 2000) {
      await channel.send(content);
    } else {
      const chunks = content.match(/.{1,2000}/gs) ?? [content];
      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    }
  }
}

// ── Disconnect a tenant's Discord client ─────────────────────────────────────

export function disconnectDiscordForTenant(slug: string): void {
  const client = tenantClients.get(slug);
  if (client) {
    clientMeta.delete(client);
    if (client.isReady()) {
      client.destroy();
    }
    tenantClients.delete(slug);
  }
}

// ── Get main channel ID for a tenant ─────────────────────────────────────────

export function getMainChannelId(slug: string): string | undefined {
  const client = tenantClients.get(slug);
  if (!client) return undefined;
  return clientMeta.get(client)?.mainChannelId;
}

// ── Legacy compatibility (single-tenant, reads from process.env) ─────────────

export async function startDiscordBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Missing DISCORD_BOT_TOKEN');
  if (!process.env.DISCORD_AUTHORIZED_USER_ID)
    throw new Error('Missing DISCORD_AUTHORIZED_USER_ID');

  // Create a fake TenantContext from env vars for legacy mode
  const legacyCtx: TenantContext = {
    slug: process.env.AGENT_SLOT || 'local',
    schemaName: process.env.TENANT_SCHEMA || 'public',
    credentials: {
      slug: process.env.AGENT_SLOT || 'local',
      schemaName: process.env.TENANT_SCHEMA || 'public',
      keySalt: null,
      discordConfig: {
        bot_token: token,
        client_id: process.env.DISCORD_CLIENT_ID,
        guild_id: process.env.DISCORD_GUILD_ID,
        channel_id: process.env.DISCORD_CHANNEL_GERAL,
        user_id: process.env.DISCORD_AUTHORIZED_USER_ID,
        channel_map: process.env.DISCORD_CHANNEL_MAP,
      },
      openrouterConfig: {
        api_key: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL,
      },
    },
    cronTasks: [],
    status: 'booting',
  };

  await startDiscordBotForTenant(legacyCtx);
}

export function disconnectDiscord(): void {
  // Disconnect all clients (legacy compat)
  for (const slug of tenantClients.keys()) {
    disconnectDiscordForTenant(slug);
  }
}
