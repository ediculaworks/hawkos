import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  createHabit,
  findHabitByName,
  listHabitsWithTodayStatus,
  logHabit,
  unlogHabit,
} from './queries';
import type { HabitFrequency } from './types';

/**
 * /habito - Registrar, listar ou criar hábitos
 *
 * /habito <nome>              → marcar como completado hoje
 * /habito list                → listar hábitos com streaks
 * /habito novo <nome> <freq>  → criar novo hábito
 * /habito nao <nome>          → desmarcar hábito de hoje
 */
export const habitoCommand = new SlashCommandBuilder()
  .setName('habito')
  .setDescription('Gerenciar hábitos diários')
  .addSubcommand((sub) =>
    sub
      .setName('check')
      .setDescription('Marcar hábito como completado hoje')
      .addStringOption((opt) =>
        opt
          .setName('nome')
          .setDescription('Nome do hábito (parcial aceito)')
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Nota opcional').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Listar hábitos ativos com streaks de hoje'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('novo')
      .setDescription('Criar um novo hábito')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do hábito').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('freq')
          .setDescription('Frequência')
          .setRequired(true)
          .addChoices(
            { name: 'Diário', value: 'daily' },
            { name: '2x por semana', value: 'weekly_2x' },
            { name: '3x por semana', value: 'weekly_3x' },
            { name: 'Dias úteis', value: 'weekdays' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('icone').setDescription('Emoji do hábito').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('nao')
      .setDescription('Desmarcar hábito de hoje (registrar falta)')
      .addStringOption((opt) =>
        opt
          .setName('nome')
          .setDescription('Nome do hábito')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

/**
 * Handler para /habito
 */
export async function handleHabito(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'list') return handleHabitoList(interaction);
  if (sub === 'check') return handleHabitoCheck(interaction);
  if (sub === 'novo') return handleHabitoNovo(interaction);
  if (sub === 'nao') return handleHabitoNao(interaction);
}

async function handleHabitoList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const habits = await listHabitsWithTodayStatus();

  if (habits.length === 0) {
    await interaction.editReply('Nenhum hábito ativo. Use `/habito novo` para criar um.');
    return;
  }

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const completedCount = habits.filter((h) => h.completed_today).length;

  const lines = habits.map((h) => {
    const check = h.completed_today ? '✅' : '⬜';
    const streak =
      h.current_streak > 0
        ? ` · Streak: ${h.current_streak}${h.current_streak >= 7 ? ' 🔥' : ''}`
        : '';
    const icon = h.icon ? `${h.icon} ` : '';
    return `${check} ${icon}${h.name}${streak}`;
  });

  const response = [
    `📋 **Hábitos hoje (${today}):**\n`,
    lines.join('\n'),
    `\n**${completedCount}/${habits.length}** completados hoje`,
  ].join('\n');

  await interaction.editReply(response);
}

async function handleHabitoCheck(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const nota = interaction.options.getString('nota') ?? undefined;

  const habit = await findHabitByName(nome);

  if (!habit) {
    await interaction.editReply(
      `❌ Hábito **"${nome}"** não encontrado. Use \`/habito list\` para ver os hábitos ativos.`,
    );
    return;
  }

  await logHabit({ habit_id: habit.id, notes: nota });

  const streakMsg =
    habit.current_streak + 1 >= 7
      ? ` · Streak: ${habit.current_streak + 1} 🔥`
      : habit.current_streak + 1 > 1
        ? ` · Streak: ${habit.current_streak + 1} dias`
        : '';

  const icon = habit.icon ? `${habit.icon} ` : '';
  const notaMsg = nota ? `\n📝 ${nota}` : '';

  await interaction.editReply(`✅ **${icon}${habit.name}** marcado!${streakMsg}${notaMsg}`);
}

async function handleHabitoNovo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nomeRaw = interaction.options.getString('nome', true);
  const freqRaw = interaction.options.getString('freq', true);
  const icone = interaction.options.getString('icone') ?? undefined;

  if (!nomeRaw.trim()) {
    await interaction.editReply('❌ Nome do hábito não pode estar vazio.');
    return;
  }

  const validFreqs: HabitFrequency[] = ['daily', 'weekly_2x', 'weekly_3x', 'weekdays'];
  if (!validFreqs.includes(freqRaw as HabitFrequency)) {
    await interaction.editReply(
      '❌ Frequência inválida. Use: daily, weekly_2x, weekly_3x, weekdays.',
    );
    return;
  }

  const freq = freqRaw as HabitFrequency;
  const habit = await createHabit({
    name: nomeRaw.trim(),
    frequency: freq,
    icon: icone,
  });

  const freqLabels: Record<HabitFrequency, string> = {
    daily: 'diário',
    weekly_2x: '2x/semana',
    weekly_3x: '3x/semana',
    weekdays: 'dias úteis',
  };

  await interaction.editReply(
    `✅ Hábito criado!\n${icone ?? '📌'} **${habit.name}** · ${freqLabels[freq]}`,
  );
}

async function handleHabitoNao(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const habit = await findHabitByName(nome);

  if (!habit) {
    await interaction.editReply(`❌ Hábito **"${nome}"** não encontrado.`);
    return;
  }

  await unlogHabit(habit.id);

  await interaction.editReply(`⬜ **${habit.name}** desmarcado.`);
}
