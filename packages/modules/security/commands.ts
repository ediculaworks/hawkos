import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  getDueForReview,
  getPendingItems,
  getSecuritySummary,
  listSecurityItems,
  updateSecurityItem,
} from './queries';
import type { SecurityCategory, SecurityStatus } from './types';

export const segurancaCommand = new SlashCommandBuilder()
  .setName('seguranca')
  .setDescription('Checklist de segurança digital e física')
  .addSubcommand((sub) => sub.setName('status').setDescription('Resumo geral da segurança'))
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Listar itens por categoria')
      .addStringOption((opt) =>
        opt
          .setName('categoria')
          .setDescription('Filtrar por categoria')
          .setRequired(false)
          .addChoices(
            { name: 'Digital', value: 'digital' },
            { name: 'Física', value: 'fisica' },
            { name: 'Financeira', value: 'financeira' },
            { name: 'Documentos', value: 'documentos' },
            { name: 'Emergência', value: 'emergencia' },
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('ok')
      .setDescription('Marcar item como verificado/ok')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID do item (primeiros 8 chars)').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('proxima').setDescription('Próxima revisão (YYYY-MM-DD)').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('alerta')
      .setDescription('Marcar item como crítico')
      .addStringOption((opt) =>
        opt.setName('id').setDescription('ID do item (primeiros 8 chars)').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação sobre o problema').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('pendentes').setDescription('Ver itens pendentes e críticos'),
  );

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSeguranca(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'status') return handleStatus(interaction);
  if (sub === 'list') return handleList(interaction);
  if (sub === 'ok') return handleOk(interaction);
  if (sub === 'alerta') return handleAlerta(interaction);
  if (sub === 'pendentes') return handlePendentes(interaction);
}

async function handleStatus(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const [summary, dueReview] = await Promise.all([getSecuritySummary(), getDueForReview()]);
  const total = summary.ok + summary.pendente + summary.critico;

  const statusLine =
    summary.critico > 0
      ? `🔴 **${summary.critico} crítico(s)** · 🟠 ${summary.pendente} pendente(s) · ✅ ${summary.ok}/${total}`
      : summary.pendente > 0
        ? `🟠 **${summary.pendente} pendente(s)** · ✅ ${summary.ok}/${total}`
        : `✅ **Tudo ok!** (${total} itens verificados)`;

  const reviewStr =
    dueReview.length > 0
      ? `\n\n📅 **${dueReview.length} item(s) para revisar:**\n${dueReview.map((i) => `• ${i.name}`).join('\n')}`
      : '';

  await interaction.editReply(`🔐 **Segurança:**\n${statusLine}${reviewStr}`);
}

async function handleList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const categoria = interaction.options.getString('categoria') as SecurityCategory | null;
  const items = await listSecurityItems(categoria ?? undefined);

  if (items.length === 0) {
    await interaction.editReply('🔐 Nenhum item de segurança encontrado.');
    return;
  }

  const statusEmoji: Record<SecurityStatus, string> = {
    ok: '✅',
    needs_attention: '🟠',
    critical: '🔴',
  };
  const catEmoji: Record<SecurityCategory, string> = {
    account: '💻',
    backup: '🔒',
    '2fa': '🔑',
    recovery: '📄',
    password_manager: '🔐',
    other: '🚨',
  };

  const lines = items.map((i) => {
    const s = statusEmoji[i.status] ?? '⬜';
    const c = catEmoji[i.type] ?? '🔐';
    return `${s} ${c} \`${i.id.slice(0, 8)}\` **${i.name}**`;
  });

  const titulo = categoria ? `Segurança — ${categoria}` : 'Todos os itens';
  await interaction.editReply(`🔐 **${titulo} (${items.length}):**\n\n${lines.join('\n')}`);
}

async function handleOk(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);
  const proxima = interaction.options.getString('proxima') ?? undefined;

  const all = await listSecurityItems();
  const found = all.find((i) => i.id.startsWith(id));
  if (!found) {
    await interaction.editReply(`❌ Item \`${id}\` não encontrado.`);
    return;
  }

  const updated = await updateSecurityItem(found.id, { status: 'ok', next_review: proxima });
  const proximaStr = updated.next_review
    ? ` · próxima revisão: ${new Date(updated.next_review).toLocaleDateString('pt-BR')}`
    : '';

  await interaction.editReply(`✅ **${updated.name}** marcado como ok!${proximaStr}`);
}

async function handleAlerta(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const id = interaction.options.getString('id', true);
  const nota = interaction.options.getString('nota') ?? undefined;

  const all = await listSecurityItems();
  const found = all.find((i) => i.id.startsWith(id));
  if (!found) {
    await interaction.editReply(`❌ Item \`${id}\` não encontrado.`);
    return;
  }

  const updated = await updateSecurityItem(found.id, { status: 'critical', notes: nota });
  const notaStr = nota ? `\n📝 ${nota}` : '';

  await interaction.editReply(`🔴 **${updated.name}** marcado como crítico!${notaStr}`);
}

async function handlePendentes(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const pending = await getPendingItems();
  if (pending.length === 0) {
    await interaction.editReply('✅ Nenhum item pendente ou crítico!');
    return;
  }

  const statusEmoji: Record<SecurityStatus, string> = {
    ok: '✅',
    needs_attention: '🟠',
    critical: '🔴',
  };
  const lines = pending.map((i) => {
    const s = statusEmoji[i.status] ?? '⬜';
    const nota = i.notes ? ` — ${i.notes}` : '';
    return `${s} \`${i.id.slice(0, 8)}\` **${i.name}**${nota}`;
  });

  await interaction.editReply(
    `🔐 **Itens para resolver (${pending.length}):**\n\n${lines.join('\n')}`,
  );
}
