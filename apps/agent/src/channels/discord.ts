import { db, withSchema } from '@hawk/db';
import { createTransaction, getAccounts, getCategories } from '@hawk/module-finances/queries';
import { AuthorizationError } from '@hawk/shared';
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type Message,
  ModalBuilder,
  type ModalSubmitInteraction,
  Partials,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { handleStreamingMessage } from '../handler.js';
import type { TenantContext } from '../tenant-manager.js';
import { UNDO_TTL_MS, getUndoAction, parseUndoTag, removeUndoAction } from '../undo-store.js';
import { ALL_COMMANDS, handleSlashCommand } from './module-commands.js';

// ── Per-tenant Discord clients ───────────────────────────────────────────────

/** Map of slug → Discord Client. One client per tenant. */
const tenantClients = new Map<string, Client>();

// ── S2.3 — Feedback tracking ─────────────────────────────────────────────────
/** Map of bot messageId → { schemaName, sessionId } for reaction correlation. */
const botMessageMeta = new Map<string, { schemaName: string; sessionId: string }>();

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

// ── S1.3 — Undo Button helpers ───────────────────────────────────────────────

function buildUndoActionRow(actionId: string, _label: string): ActionRowBuilder<ButtonBuilder> {
  const ttlSecs = Math.round(UNDO_TTL_MS / 1000);
  const button = new ButtonBuilder()
    .setCustomId(`undo:${actionId}`)
    .setLabel(`↩ Desfazer (${ttlSecs}s)`)
    .setStyle(ButtonStyle.Secondary);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

async function handleUndoButton(interaction: ButtonInteraction, meta: ClientMeta): Promise<void> {
  const actionId = interaction.customId.slice(5); // strip "undo:"
  const action = getUndoAction(actionId);

  if (!action) {
    await interaction.reply({
      content: '⏱️ O tempo limite expirou. Não foi possível desfazer.',
      ephemeral: true,
    });
    return;
  }

  try {
    await withSchema(meta.ctx.schemaName, () => action.perform());
    removeUndoAction(actionId);
    await interaction.update({
      content: `↩ **Desfeito:** ${action.description}`,
      components: [],
    });
  } catch (err) {
    console.error('[discord] Undo failed:', err);
    await interaction.reply({
      content: `❌ Não foi possível desfazer: ${err instanceof Error ? err.message : err}`,
      ephemeral: true,
    });
  }
}

// ── S2.2 — Quick Actions helpers ─────────────────────────────────────────────

/** Send a Select Menu with the top 5 expense categories for quick re-entry. */
async function showTopExpenseCategories(channel: {
  send: (opts: unknown) => Promise<unknown>;
}): Promise<void> {
  const { data } = await db
    .from('finance_categories')
    .select('id, name')
    .eq('type', 'expense')
    .order('name')
    .limit(5);

  if (!data || data.length === 0) return;

  const cats = data as { id: string; name: string }[];
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('quick-expense:select')
    .setPlaceholder('Registar outro gasto…')
    .addOptions(
      cats.map((c) => new StringSelectMenuOptionBuilder().setLabel(c.name).setValue(c.id)),
    );

  await channel.send({
    content: '',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
  });
}

/** Show a modal to enter the amount for the selected expense category. */
async function handleCategorySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const categoryId = interaction.values[0];
  if (!categoryId) {
    await interaction.deferUpdate();
    return;
  }

  const { data } = await db.from('finance_categories').select('name').eq('id', categoryId).single();
  const categoryName = (data as { name?: string } | null)?.name ?? 'categoria';

  const modal = new ModalBuilder()
    .setCustomId(`quick-expense:amount:${categoryId}`)
    .setTitle(`Gasto em ${categoryName}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Valor (R$)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('50,00')
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

/** Show the /log modal for structured expense/income entry. */
async function showLogModal(cmd: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('log:submit').setTitle('Registar Gasto / Receita');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('tipo')
        .setLabel('Tipo: gasto ou receita')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('gasto')
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('descricao')
        .setLabel('Descrição / Categoria')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('alimentação')
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('valor')
        .setLabel('Valor (R$)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('50,00')
        .setRequired(true),
    ),
  );

  await cmd.showModal(modal);
}

/** Handle the /log modal submit — create a transaction from structured input. */
async function handleLogModal(
  interaction: ModalSubmitInteraction,
  meta: ClientMeta,
): Promise<void> {
  const tipo = interaction.fields.getTextInputValue('tipo').trim().toLowerCase();
  const descricao = interaction.fields.getTextInputValue('descricao').trim();
  const valorRaw = interaction.fields.getTextInputValue('valor').trim();
  const amount = Number.parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));

  if (!Number.isFinite(amount) || amount <= 0) {
    await interaction.reply({ content: '❌ Valor inválido.', ephemeral: true });
    return;
  }

  const txType: 'income' | 'expense' = tipo.startsWith('r') ? 'income' : 'expense';

  try {
    await withSchema(meta.ctx.schemaName, async () => {
      const accounts = await getAccounts();
      const account = accounts[0];
      if (!account) throw new Error('Nenhuma conta encontrada');

      const categories = await getCategories(txType);
      const category =
        categories.find(
          (c) =>
            c.name.toLowerCase().includes(descricao.toLowerCase()) ||
            descricao.toLowerCase().includes(c.name.toLowerCase()),
        ) ?? categories[0];
      if (!category) throw new Error('Nenhuma categoria encontrada');

      await createTransaction({
        account_id: account.id,
        category_id: category.id,
        amount,
        type: txType,
        description: descricao,
      });
    });

    const label =
      txType === 'expense'
        ? `Gasto de R$ ${amount.toFixed(2)} em ${descricao}`
        : `Receita de R$ ${amount.toFixed(2)} — ${descricao}`;
    await interaction.reply({ content: `✅ ${label}`, ephemeral: true });
  } catch (err) {
    await interaction.reply({
      content: `❌ ${err instanceof Error ? err.message : 'Tente novamente.'}`,
      ephemeral: true,
    });
  }
}

/** Handle the quick-expense amount modal submit — create transaction for selected category. */
async function handleExpenseAmountModal(
  interaction: ModalSubmitInteraction,
  meta: ClientMeta,
): Promise<void> {
  const categoryId = interaction.customId.slice('quick-expense:amount:'.length);
  const valorRaw = interaction.fields.getTextInputValue('amount').trim();
  const amount = Number.parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));

  if (!Number.isFinite(amount) || amount <= 0) {
    await interaction.reply({ content: '❌ Valor inválido.', ephemeral: true });
    return;
  }

  try {
    let categoryName = categoryId;

    await withSchema(meta.ctx.schemaName, async () => {
      const { data: catRow } = await db
        .from('finance_categories')
        .select('name')
        .eq('id', categoryId)
        .single();
      categoryName = (catRow as { name?: string } | null)?.name ?? categoryId;

      const { data: acctData } = await db.from('finance_accounts').select('id').limit(1);
      const accountId = (acctData as { id: string }[] | null)?.[0]?.id;
      if (!accountId) throw new Error('Nenhuma conta encontrada');

      await createTransaction({
        account_id: accountId,
        category_id: categoryId,
        amount,
        type: 'expense',
        description: categoryName,
      });
    });

    await interaction.reply({
      content: `✅ Gasto registado: R$ ${amount.toFixed(2)} em ${categoryName}.`,
      ephemeral: true,
    });
  } catch (err) {
    await interaction.reply({
      content: `❌ ${err instanceof Error ? err.message : 'Tente novamente.'}`,
      ephemeral: true,
    });
  }
}

// ── S5.3 — Weekly Review interactive button handler ─────────────────────────

async function handleReviewButton(
  interaction: ButtonInteraction,
  _meta: ClientMeta,
): Promise<void> {
  const parts = interaction.customId.split(':');
  // customId format: review:next:{reviewId} | review:rating:{reviewId}:{value} | review:focus:{reviewId}
  const phase = parts[1];
  const reviewId = parts[2];

  const { getReviewState, updateReviewState, deleteReviewState } = await import(
    '../automations/weekly-review.js'
  );
  const state = getReviewState(reviewId ?? '');

  if (!state) {
    await interaction.update({ content: '⏱️ Sessão de revisão expirada.', components: [] });
    return;
  }

  if (phase === 'next') {
    // Phase 2: reflection questions
    await interaction.update({
      content: '**Como foi a semana em geral?**',
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`review:rating:${reviewId}:excelente`)
            .setLabel('🌟 Excelente')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`review:rating:${reviewId}:boa`)
            .setLabel('👍 Boa')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`review:rating:${reviewId}:normal`)
            .setLabel('😐 Normal')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`review:rating:${reviewId}:dificil`)
            .setLabel('👎 Difícil')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
    return;
  }

  if (phase === 'rating') {
    const rating = parts[3] ?? 'normal';
    updateReviewState(reviewId ?? '', { weekRating: rating });

    // Phase 3: ask for next week focus via modal
    const modal = new ModalBuilder()
      .setCustomId(`review:focus:${reviewId}`)
      .setTitle('Revisão Semanal — Próxima semana');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('focus')
          .setLabel('Qual o teu principal foco para a próxima semana?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Manter os hábitos de sono, avançar no projecto X…')
          .setRequired(false),
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // Fallback
  await interaction.update({ content: '✅ Revisão concluída.', components: [] });
  deleteReviewState(reviewId ?? '');
}

/** Handle the weekly review focus modal submit — save as memory. */
async function handleReviewFocusModal(
  interaction: ModalSubmitInteraction,
  meta: ClientMeta,
): Promise<void> {
  const reviewId = interaction.customId.slice('review:focus:'.length);

  const { getReviewState, deleteReviewState } = await import('../automations/weekly-review.js');
  const state = getReviewState(reviewId);

  const focus = interaction.fields.getTextInputValue('focus').trim();

  if (state) {
    const ratingLabel: Record<string, string> = {
      excelente: 'Excelente 🌟',
      boa: 'Boa 👍',
      normal: 'Normal 😐',
      dificil: 'Difícil 👎',
    };
    const rating = ratingLabel[state.weekRating ?? ''] ?? state.weekRating ?? 'não avaliada';

    // Save as memory via agent pipeline (within schema context)
    if (focus || state.weekRating) {
      await withSchema(meta.ctx.schemaName, async () => {
        const { createMemory } = await import('@hawk/module-memory/queries');
        const content = [
          `Revisão semanal ${state.weekLabel}`,
          `Semana: ${rating}`,
          focus ? `Foco próxima semana: ${focus}` : null,
        ]
          .filter(Boolean)
          .join(' | ');

        await createMemory({
          content,
          category: 'insight',
          module: 'routine',
          importance: 6,
          confidence: 1.0,
        });
      });
    }

    deleteReviewState(reviewId);
  }

  const focusLine = focus ? `\n\n🎯 **Foco para a próxima semana:** ${focus}` : '';
  await interaction.reply({
    content: `✅ Revisão guardada!${focusLine}`,
    ephemeral: true,
  });
}

// ── S5.1 — Pending Intents helpers ───────────────────────────────────────────

/** Show pending intents list with "Executar" buttons for each. */
async function handlePendentesCommand(
  cmd: ChatInputCommandInteraction,
  meta: ClientMeta,
): Promise<void> {
  await cmd.deferReply({ ephemeral: false });

  await withSchema(meta.ctx.schemaName, async () => {
    const { data } = await db
      .from('pending_intents')
      .select('id, description, prerequisite_message, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) {
      await cmd.editReply('✅ Nenhuma ação pendente.');
      return;
    }

    const rows = data as {
      id: string;
      description: string;
      prerequisite_message: string;
      created_at: string;
    }[];

    const contentLines = rows.map((r, i) => {
      const date = new Date(r.created_at).toLocaleDateString('pt-BR');
      return `**${i + 1}.** ${r.description} *(${date})*\n└ ⚠️ ${r.prerequisite_message}`;
    });

    const components = rows.map((r, i) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`exec_intent:${r.id}`)
          .setLabel(`▶ Executar #${i + 1}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    await cmd.editReply({
      content: `**📋 Ações Pendentes (${rows.length}):**\n\n${contentLines.join('\n\n')}`,
      components,
    });
  });
}

/** Execute a pending intent when the user clicks the "Executar" button. */
async function handleExecIntentButton(
  interaction: ButtonInteraction,
  meta: ClientMeta,
): Promise<void> {
  const intentId = interaction.customId.slice('exec_intent:'.length);
  await interaction.deferReply({ ephemeral: true });

  try {
    await withSchema(meta.ctx.schemaName, async () => {
      const { data } = await db
        .from('pending_intents')
        .select('id, intent_json, description, prerequisite')
        .eq('id', intentId)
        .eq('status', 'pending')
        .single();

      if (!data) {
        await interaction.editReply('❌ Ação não encontrada ou já executada.');
        return;
      }

      const intent = data as {
        id: string;
        intent_json: { tool: string; args: Record<string, unknown> };
        description: string;
        prerequisite: string;
      };

      const { checkPrerequisite } = await import('../prerequisite-registry.js');
      const satisfied = await checkPrerequisite(intent.prerequisite);
      if (!satisfied) {
        await interaction.editReply(
          '⚠️ Pré-requisito ainda não satisfeito. Completa a configuração primeiro.',
        );
        return;
      }

      const { TOOLS } = await import('../tools/index.js');
      const toolDef = TOOLS[intent.intent_json.tool as keyof typeof TOOLS];
      if (!toolDef) {
        await interaction.editReply(`❌ Ferramenta desconhecida: ${intent.intent_json.tool}`);
        return;
      }

      const result = await toolDef.handler(intent.intent_json.args as never);

      await db
        .from('pending_intents')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', intentId);

      await interaction.editReply(`✅ **${intent.description}**\n${result}`);
      await interaction.message.edit({ components: [] }).catch(() => {});
    });
  } catch (err) {
    await interaction.editReply(`❌ ${err instanceof Error ? err.message : 'Tente novamente.'}`);
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
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Reaction, Partials.User],
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

        // ── S3.4 — Pending message tracking (offline resilience) ─────────
        await db
          .from('pending_messages')
          .upsert({
            channel_message_id: message.id,
            session_id: message.channelId,
            content: textContent || 'image',
            status: 'pending',
          })
          .then(
            () => {},
            () => {},
          ); // non-blocking — best-effort upsert

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

        // ── S1.3 — Parse undo tag from response ──────────────────────────
        const { clean: displayResponse, actionId } = parseUndoTag(response);
        const prefix = wasTranscribed ? `*"${textContent}"*\n\n` : '';
        const finalResponse = prefix + displayResponse;

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

        // ── S2.3 — Track bot message for feedback reactions ──────────────
        botMessageMeta.set(streamMsg.id, {
          schemaName: ctx.schemaName,
          sessionId: message.channelId,
        });
        streamMsg.react('👍').catch(() => {});
        streamMsg.react('👎').catch(() => {});

        // Send undo button as a follow-up message (expires in 60s)
        if (actionId) {
          const undoAction = getUndoAction(actionId);
          if (undoAction) {
            const channel = message.channel;
            if (channel && 'send' in channel && typeof channel.send === 'function') {
              const row = buildUndoActionRow(actionId, undoAction.description);
              const btnMsg = await channel.send({ content: '', components: [row] });
              // Auto-disable the button after TTL
              setTimeout(async () => {
                try {
                  await btnMsg.edit({ content: '', components: [] });
                } catch {
                  // Message may have been deleted — ignore
                }
              }, UNDO_TTL_MS + 500);
            }
          }

          // ── S2.2 — Quick expense categories after gasto ──────────────
          if (/gasto|transaç[aã]o/i.test(displayResponse) && displayResponse.includes('R$')) {
            const chan = message.channel;
            if (chan && 'send' in chan && typeof chan.send === 'function') {
              showTopExpenseCategories(chan as { send: (opts: unknown) => Promise<unknown> }).catch(
                () => {},
              );
            }
          }
        }
        // ── S3.4 — Mark message as processed ─────────────────────────────
        await db
          .from('pending_messages')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('channel_message_id', message.id)
          .then(
            () => {},
            () => {},
          );
      } catch (err) {
        if (err instanceof AuthorizationError) return;
        await message.reply('Erro interno. Tente novamente.');
      }
    });
  });

  // ── Interactions (slash commands + buttons + select menus + modals) ─────
  client.on(Events.InteractionCreate, async (interaction) => {
    // ── S1.3 + S5.1 + S5.3 — Button interactions ────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('undo:')) {
        await handleUndoButton(interaction as ButtonInteraction, meta);
      } else if (interaction.customId.startsWith('exec_intent:')) {
        await handleExecIntentButton(interaction as ButtonInteraction, meta);
      } else if (interaction.customId.startsWith('review:')) {
        await handleReviewButton(interaction as ButtonInteraction, meta);
      }
      return;
    }

    // ── S2.2 — Select menu (quick expense category) ─────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.user.id !== meta.authorizedUserId) return;
      if (interaction.customId === 'quick-expense:select') {
        await withSchema(ctx.schemaName, () =>
          handleCategorySelect(interaction as StringSelectMenuInteraction),
        );
      }
      return;
    }

    // ── S2.2 + S5.3 — Modal submit ──────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (interaction.user.id !== meta.authorizedUserId) return;
      if (interaction.customId === 'log:submit') {
        await handleLogModal(interaction as ModalSubmitInteraction, meta);
      } else if (interaction.customId.startsWith('quick-expense:amount:')) {
        await handleExpenseAmountModal(interaction as ModalSubmitInteraction, meta);
      } else if (interaction.customId.startsWith('review:focus:')) {
        await handleReviewFocusModal(interaction as ModalSubmitInteraction, meta);
      }
      return;
    }

    if (!interaction.isCommand()) return;
    if (interaction.user.id !== meta.authorizedUserId) {
      await interaction.reply({ content: 'Não autorizado.', ephemeral: true });
      return;
    }

    const cmd = interaction as ChatInputCommandInteraction;

    // ── S2.2 — /log command: show modal directly ─────────────────────────
    if (cmd.commandName === 'log') {
      await showLogModal(cmd);
      return;
    }

    // ── S5.1 — /pendentes command: show pending intents ──────────────────
    if (cmd.commandName === 'pendentes') {
      await handlePendentesCommand(cmd, meta);
      return;
    }

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

  // ── S2.3 — Reaction feedback ─────────────────────────────────────────────
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    const messageId = reaction.message.id;
    const msgMeta = botMessageMeta.get(messageId);
    if (!msgMeta) return; // Not a tracked bot message

    const emoji = reaction.emoji.name;
    if (emoji !== '👍' && emoji !== '👎') return;
    const rating = emoji === '👍' ? 1 : -1;

    botMessageMeta.delete(messageId); // Record only the first reaction

    await withSchema(msgMeta.schemaName, async () => {
      await db.from('response_feedback').insert({
        message_id: messageId,
        rating,
        session_id: msgMeta.sessionId,
      });
    }).catch((err) => {
      console.error('[discord] Failed to save feedback:', err);
    });
  });

  await client.login(discord.bot_token);

  // Store references
  tenantClients.set(ctx.slug, client);
  ctx.discordClient = client;

  return client;
}

// ── Send to channel with interactive components (tenant-aware) ───────────────

interface ButtonSpec {
  type: 'button';
  customId: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
}

export async function sendToChannelWithComponents(
  channelId: string,
  content: string,
  buttons: ButtonSpec[],
  slug?: string,
): Promise<void> {
  let client: Client | undefined;
  if (slug) {
    client = tenantClients.get(slug);
  } else {
    for (const [, c] of tenantClients) {
      const m = clientMeta.get(c);
      if (m?.allowedChannels.has(channelId)) {
        client = c;
        break;
      }
    }
  }
  if (!client) return;

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !('send' in channel)) return;

  const styleMap = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
  };

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    buttons.map((b) =>
      new ButtonBuilder()
        .setCustomId(b.customId)
        .setLabel(b.label)
        .setStyle(styleMap[b.style] ?? ButtonStyle.Primary),
    ),
  );

  const chunks = content.match(/.{1,2000}/gs) ?? [content];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as string;
    const isLast = i === chunks.length - 1;
    // biome-ignore lint/suspicious/noExplicitAny: discord.js channel type
    await (channel as any).send({ content: chunk, components: isLast ? [row] : [] });
  }
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
