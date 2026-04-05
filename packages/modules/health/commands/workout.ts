import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { addWorkoutSet, getTodayWorkouts, listRecentWorkouts, logWorkout } from '../queries';
import type { WorkoutType } from '../types';

// ─────────────────────────────────────────────
// /treino — tracking de exercício
// ─────────────────────────────────────────────

export const treinoCommand = new SlashCommandBuilder()
  .setName('treino')
  .setDescription('Treino — registrar e acompanhar exercícios')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar treino')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Tipo de treino')
          .setRequired(true)
          .addChoices(
            { name: 'Musculação', value: 'musculacao' },
            { name: 'Corrida', value: 'corrida' },
            { name: 'Ciclismo', value: 'ciclismo' },
            { name: 'Natação', value: 'natacao' },
            { name: 'Caminhada', value: 'caminhada' },
            { name: 'Skate', value: 'skate' },
            { name: 'Futebol', value: 'futebol' },
            { name: 'Outro', value: 'outro' },
          ),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('duracao')
          .setDescription('Duração em minutos')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(480),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('serie')
      .setDescription('Adicionar série a um treino de musculação (usa último treino do dia)')
      .addStringOption((opt) =>
        opt.setName('exercicio').setDescription('Nome do exercício').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('serie')
          .setDescription('Número da série')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('reps')
          .setDescription('Repetições')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addNumberOption((opt) =>
        opt
          .setName('carga')
          .setDescription('Carga em kg')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(500),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('rpe')
          .setDescription('Esforço percebido (1-10)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(10),
      ),
  )
  .addSubcommand((sub) => sub.setName('hoje').setDescription('Ver treino de hoje'))
  .addSubcommand((sub) => sub.setName('historico').setDescription('Últimos 10 treinos'));

export async function handleTreino(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleTreinoAdd(interaction);
  if (sub === 'serie') return handleTreinoSerie(interaction);
  if (sub === 'hoje') return handleTreinoHoje(interaction);
  if (sub === 'historico') return handleTreinoHistorico(interaction);
}

async function handleTreinoAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const tipo = interaction.options.getString('tipo', true) as WorkoutType;
  const duracao = interaction.options.getInteger('duracao') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  const workout = await logWorkout({ type: tipo, duration_m: duracao, notes: nota });

  const typeLabels: Record<WorkoutType, string> = {
    musculacao: 'Musculação',
    corrida: 'Corrida',
    ciclismo: 'Ciclismo',
    natacao: 'Natação',
    caminhada: 'Caminhada',
    skate: 'Skate',
    futebol: 'Futebol',
    outro: 'Treino',
  };
  const durStr = duracao ? ` · ${duracao}min` : '';
  await interaction.editReply(
    `💪 **${typeLabels[tipo]}** registrada${durStr}\nID: \`${workout.id.slice(0, 8)}\` (use \`/treino serie\` para adicionar séries)`,
  );
}

async function handleTreinoSerie(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  // Busca último treino de musculação de hoje
  const workouts = await getTodayWorkouts();
  const musculacao = workouts.filter((w) => w.type === 'musculacao');
  if (musculacao.length === 0) {
    await interaction.editReply(
      '💪 Nenhum treino de musculação registrado hoje. Use `/treino add tipo:musculacao` primeiro.',
    );
    return;
  }

  const lastWorkout = musculacao[musculacao.length - 1];
  if (!lastWorkout) return;
  const exercicio = interaction.options.getString('exercicio', true);
  const serieNum = interaction.options.getInteger('serie', true);
  const reps = interaction.options.getInteger('reps') ?? undefined;
  const carga = interaction.options.getNumber('carga') ?? undefined;
  const rpe = interaction.options.getInteger('rpe') ?? undefined;

  await addWorkoutSet({
    workout_id: lastWorkout.id,
    exercise_name: exercicio,
    set_number: serieNum,
    reps,
    weight_kg: carga,
    rpe,
  });

  const repsStr = reps ? ` · ${reps} reps` : '';
  const cargaStr = carga ? ` · ${carga}kg` : '';
  const rpeStr = rpe ? ` · RPE ${rpe}` : '';
  await interaction.editReply(
    `💪 **${exercicio}** — Série ${serieNum}${repsStr}${cargaStr}${rpeStr} ✓`,
  );
}

async function handleTreinoHoje(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const workouts = await getTodayWorkouts();
  if (workouts.length === 0) {
    await interaction.editReply('💪 Nenhum treino hoje. Use `/treino add` para registrar.');
    return;
  }

  const lines = workouts.map((w) => {
    const durStr = w.duration_m ? ` (${w.duration_m}min)` : '';
    return `• ${w.type}${durStr}`;
  });

  await interaction.editReply(`💪 **Treinos hoje:**\n${lines.join('\n')}`);
}

async function handleTreinoHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const workouts = await listRecentWorkouts(10);
  if (workouts.length === 0) {
    await interaction.editReply('💪 Nenhum treino registrado ainda.');
    return;
  }

  const lines = workouts.map((w) => {
    const date = new Date(w.date).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    const durStr = w.duration_m ? ` (${w.duration_m}min)` : '';
    return `${date}: ${w.type}${durStr}`;
  });

  await interaction.editReply(`💪 **Últimos treinos:**\n${lines.join('\n')}`);
}
