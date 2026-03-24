import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { listActiveContracts, listPendingObligations } from './queries';

export const obrigacoesCommand = new SlashCommandBuilder()
  .setName('obrigacoes')
  .setDescription('Listar obrigações fiscais e legais pendentes');

export const contratosCommand = new SlashCommandBuilder()
  .setName('contratos')
  .setDescription('Listar contratos ativos');

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function handleObrigacoes(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const obligations = await listPendingObligations();

  if (obligations.length === 0) {
    await interaction.editReply('✅ Nenhuma obrigação pendente.');
    return;
  }

  const urgencyEmoji: Record<string, string> = {
    critical: '🔴',
    urgent: '🟠',
    warning: '🟡',
    ok: '🟢',
  };

  const lines = obligations.map((o) => {
    const emoji = urgencyEmoji[o.urgency] ?? '🟢';
    const dueStr = new Date(o.due_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const daysStr =
      o.days_until_due < 0
        ? ` · VENCIDA há ${Math.abs(o.days_until_due)}d`
        : o.days_until_due === 0
          ? ' · VENCE HOJE'
          : ` · ${o.days_until_due}d`;
    const valueStr = o.amount ? ` · R$${o.amount.toFixed(2)}` : '';
    return `${emoji} **${o.name}** · ${dueStr}${daysStr}${valueStr}`;
  });

  await interaction.editReply(
    `📋 **Obrigações pendentes (${obligations.length}):**\n\n${lines.join('\n')}`,
  );
}

export async function handleContratos(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const contracts = await listActiveContracts();

  if (contracts.length === 0) {
    await interaction.editReply('Nenhum contrato ativo cadastrado.');
    return;
  }

  const lines = contracts.map((c) => {
    const endStr = c.end_date
      ? ` · até ${new Date(c.end_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
      : '';
    const valueStr = c.value ? ` · R$${c.value.toFixed(2)}` : '';
    const parties = c.parties.length > 0 ? ` (${c.parties.join(', ')})` : '';
    return `📄 **${c.title}**${parties}${endStr}${valueStr}`;
  });

  await interaction.editReply(`**Contratos ativos (${contracts.length}):**\n\n${lines.join('\n')}`);
}
