import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getWorkSummary, listActiveProjects, logWork } from './queries';

export const horasCommand = new SlashCommandBuilder()
  .setName('horas')
  .setDescription('Registrar horas trabalhadas')
  .addStringOption((opt) =>
    opt
      .setName('workspace')
      .setDescription('Onde trabalhou (empresa, freelance...)')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addIntegerOption((opt) =>
    opt.setName('minutos').setDescription('Duração em minutos').setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('projeto')
      .setDescription('Projeto específico (opcional)')
      .setRequired(false)
      .setAutocomplete(true),
  )
  .addStringOption((opt) =>
    opt.setName('descricao').setDescription('O que foi feito').setRequired(false),
  );

export const projetosCommand = new SlashCommandBuilder()
  .setName('projetos')
  .setDescription('Listar projetos ativos e resumo de horas');

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function handleHoras(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const workspace = interaction.options.getString('workspace', true);
  const minutos = interaction.options.getInteger('minutos', true);
  const projeto = interaction.options.getString('projeto') ?? undefined;
  const descricao = interaction.options.getString('descricao') ?? undefined;

  if (minutos <= 0) {
    await interaction.editReply('❌ Duração deve ser maior que zero.');
    return;
  }

  try {
    const _log = await logWork({
      workspace_name: workspace,
      duration_minutes: minutos,
      project_name: projeto,
      description: descricao,
    });

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    const duracaoStr = horas > 0 ? `${horas}h${mins > 0 ? `${mins}min` : ''}` : `${mins}min`;
    const projetoStr = projeto ? ` · ${projeto}` : '';
    const descStr = descricao ? `\n> ${descricao}` : '';

    await interaction.editReply(`✅ **${workspace}**${projetoStr} · ${duracaoStr}${descStr}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    await interaction.editReply(`❌ ${msg}`);
  }
}

export async function handleProjetos(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const [projects, summaries] = await Promise.all([listActiveProjects(), getWorkSummary()]);

  const sections: string[] = [];

  // Resumo de horas por workspace
  const horasLines = summaries.map((s) => {
    return `**${s.workspace.name}:** ${s.total_hours_week}h semana · ${s.total_hours_month}h mês`;
  });
  if (horasLines.length > 0) {
    sections.push(`⏱️ **Horas registradas:**\n${horasLines.join('\n')}`);
  }

  // Projetos ativos
  if (projects.length > 0) {
    const projLines = projects.map((p) => {
      const repoStr = p.github_repo ? ` · [${p.github_repo}]` : '';
      return `• **${p.name}**${repoStr}`;
    });
    sections.push(`📂 **Projetos ativos (${projects.length}):**\n${projLines.join('\n')}`);
  } else {
    sections.push('Nenhum projeto ativo.');
  }

  await interaction.editReply(sections.join('\n\n'));
}
