import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createDemand, getActiveDemands } from './queries';
import { triageDemand } from './triage';

/**
 * /demanda - Gerenciar demandas de longa duração
 *
 * /demanda criar <título> [descrição]  → criar nova demanda
 * /demanda status                       → listar demandas ativas
 */
export const demandaCommand = new SlashCommandBuilder()
  .setName('demanda')
  .setDescription('Gerenciar demandas multi-agent')
  .addSubcommand((sub) =>
    sub
      .setName('criar')
      .setDescription('Criar nova demanda')
      .addStringOption((opt) =>
        opt.setName('titulo').setDescription('Título da demanda').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('descricao').setDescription('Descrição detalhada').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('prioridade')
          .setDescription('Prioridade')
          .setRequired(false)
          .addChoices(
            { name: 'Baixa', value: 'low' },
            { name: 'Média', value: 'medium' },
            { name: 'Alta', value: 'high' },
            { name: 'Urgente', value: 'urgent' },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName('status').setDescription('Ver demandas ativas'));

export async function handleDemanda(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'criar') {
    const titulo = interaction.options.getString('titulo') ?? 'Sem título';
    const descricao = interaction.options.getString('descricao');
    const prioridade =
      (interaction.options.getString('prioridade') as 'low' | 'medium' | 'high' | 'urgent') ??
      'medium';

    await interaction.deferReply();

    const demand = await createDemand({
      title: titulo,
      description: descricao ?? undefined,
      priority: prioridade,
      origin: 'chat',
    });

    // Trigger triage async
    triageDemand(demand).catch((err) => console.error('[demands] Triage failed:', err));

    await interaction.editReply(
      `📋 Demanda criada: **${titulo}**\nStatus: triaging...\nID: \`${demand.id}\``,
    );
    return;
  }

  if (sub === 'status') {
    await interaction.deferReply();

    const active = await getActiveDemands();

    if (active.length === 0) {
      await interaction.editReply('Nenhuma demanda ativa no momento.');
      return;
    }

    const lines = active.map((d) => {
      const statusEmoji =
        d.status === 'running'
          ? '🔄'
          : d.status === 'paused'
            ? '⏸'
            : d.status === 'planned'
              ? '📋'
              : d.status === 'triaging'
                ? '🔍'
                : '•';
      const bar = progressBar(d.progress);
      return `${statusEmoji} **${d.title}** ${bar} ${d.progress}% (${d.completed_steps}/${d.total_steps})`;
    });

    await interaction.editReply(`**Demandas ativas:**\n${lines.join('\n')}`);
  }
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
