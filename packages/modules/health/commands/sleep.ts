import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getTodaySleep, listRecentSleep, logSleep } from '../queries';

// ─────────────────────────────────────────────
// /sono — tracking de sono
// ─────────────────────────────────────────────

export const sonoCommand = new SlashCommandBuilder()
  .setName('sono')
  .setDescription('Sono — registrar e acompanhar')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar sono de hoje/ontem')
      .addNumberOption((opt) =>
        opt
          .setName('horas')
          .setDescription('Horas dormidas')
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(24),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('qualidade')
          .setDescription('Qualidade (1-10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('hoje').setDescription('Ver sono de hoje'))
  .addSubcommand((sub) => sub.setName('semana').setDescription('Ver sono da última semana'));

export async function handleSono(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleSonoAdd(interaction);
  if (sub === 'hoje') return handleSonoHoje(interaction);
  if (sub === 'semana') return handleSonoSemana(interaction);
}

async function handleSonoAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const horas = interaction.options.getNumber('horas', true);
  const qualidade = interaction.options.getInteger('qualidade') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  const session = await logSleep({ duration_h: horas, quality: qualidade, notes: nota });

  const date = new Date(session.date).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const qualStr = qualidade ? ` · Qualidade: ${qualidade}/10` : '';
  await interaction.editReply(`🌙 Sono ${date}: **${horas}h**${qualStr} registrado.`);
}

async function handleSonoHoje(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const session = await getTodaySleep();
  if (!session) {
    await interaction.editReply('🌙 Sono de hoje não registrado. Use `/sono add`.');
    return;
  }

  const parts = [`🌙 **Sono de hoje:** ${session.duration_h}h`];
  if (session.quality) parts.push(`Qualidade: ${session.quality}/10`);
  if (session.notes) parts.push(`Nota: ${session.notes}`);
  await interaction.editReply(parts.join(' · '));
}

async function handleSonoSemana(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const sessions = await listRecentSleep(7);
  if (sessions.length === 0) {
    await interaction.editReply('🌙 Nenhum sono registrado na última semana.');
    return;
  }

  const avg = sessions.reduce((s, r) => s + (r.duration_h ?? 0), 0) / sessions.length;
  const lines = sessions.map((s) => {
    const date = new Date(s.date).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const qualStr = s.quality ? ` (${s.quality}/10)` : '';
    return `${date}: ${s.duration_h ?? '?'}h${qualStr}`;
  });

  await interaction.editReply(
    `🌙 **Sono — semana** (média: ${avg.toFixed(1)}h)\n${lines.join('\n')}`,
  );
}
