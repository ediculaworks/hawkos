import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  addLabResult,
  addWorkoutSet,
  createMedication,
  getDailyHealthSummary,
  getLatestWeight,
  getSubstanceStats,
  getTodaySleep,
  getTodayWorkouts,
  getWeekHealthStats,
  listActiveMedications,
  listLabResults,
  listRecentSleep,
  listRecentWorkouts,
  listWeightHistory,
  logMedicationTaken,
  logSleep,
  logSubstance,
  logWeight,
  logWorkout,
} from './queries';
import type { MedicationFrequency, SubstanceType, WorkoutType } from './types';

// ─────────────────────────────────────────────
// /saude — overview e status geral
// ─────────────────────────────────────────────

export const saudeCommand = new SlashCommandBuilder()
  .setName('saude')
  .setDescription('Saúde — status geral e visão consolidada')
  .addSubcommand((sub) => sub.setName('hoje').setDescription('Resumo de saúde de hoje'))
  .addSubcommand((sub) => sub.setName('semana').setDescription('Estatísticas da semana'));

export async function handleSaude(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'hoje') return handleSaudeHoje(interaction);
  if (sub === 'semana') return handleSaudeSemana(interaction);
}

async function handleSaudeHoje(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const summary = await getDailyHealthSummary();
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

  const parts: string[] = [`**Saúde — ${today}**`];

  if (summary?.sleep_hours) {
    const qualStr = summary.sleep_quality ? ` (qualidade ${summary.sleep_quality}/10)` : '';
    parts.push(`🌙 Sono: ${summary.sleep_hours}h${qualStr}`);
  } else {
    parts.push('🌙 Sono: não registrado');
  }

  if (summary?.exercised) {
    const typeStr = summary.workout_type ? ` — ${summary.workout_type}` : '';
    const durStr = summary.workout_min ? ` (${summary.workout_min}min)` : '';
    parts.push(`💪 Treino: sim${typeStr}${durStr}`);
  } else {
    parts.push('💪 Treino: nenhum hoje');
  }

  if (summary?.weight_kg) parts.push(`⚖️ Peso: ${summary.weight_kg}kg`);
  if (summary?.mood) parts.push(`😊 Humor: ${summary.mood}/10`);
  if (summary?.energy) parts.push(`⚡ Energia: ${summary.energy}/10`);

  if (summary?.cannabis_g && summary.cannabis_g > 0) {
    const costStr = summary.substance_cost ? ` (R$${summary.substance_cost.toFixed(2)})` : '';
    parts.push(`🌿 Cannabis: ${summary.cannabis_g}g${costStr}`);
  }

  if (summary?.meds_taken !== undefined && summary.meds_taken + summary.meds_skipped > 0) {
    parts.push(`💊 Remédios: ${summary.meds_taken} tomados, ${summary.meds_skipped} perdidos`);
  }

  await interaction.editReply(parts.join('\n'));
}

async function handleSaudeSemana(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const stats = await getWeekHealthStats();
  const parts: string[] = ['**Saúde — últimos 7 dias**'];

  if (stats.avg_sleep_h) {
    const qualStr = stats.avg_sleep_quality ? ` · qualidade ${stats.avg_sleep_quality}/10` : '';
    parts.push(`🌙 Sono médio: ${stats.avg_sleep_h}h${qualStr}`);
  }
  parts.push(`💪 Treinos: ${stats.workouts_count}/7 dias`);
  if (stats.avg_mood) parts.push(`😊 Humor médio: ${stats.avg_mood}/10`);
  if (stats.avg_energy) parts.push(`⚡ Energia média: ${stats.avg_energy}/10`);
  if (stats.latest_weight) parts.push(`⚖️ Peso atual: ${stats.latest_weight}kg`);
  if (stats.cannabis_days > 0) parts.push(`🌿 Cannabis: ${stats.cannabis_days}/7 dias`);
  if (stats.tobacco_days > 0) parts.push(`🚬 Tabaco: ${stats.tobacco_days}/7 dias`);
  if (stats.med_adherence_pct !== null)
    parts.push(`💊 Aderência remédios: ${stats.med_adherence_pct}%`);

  await interaction.editReply(parts.join('\n'));
}

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

// ─────────────────────────────────────────────
// /corpo — peso e medidas
// ─────────────────────────────────────────────

export const corpoCommand = new SlashCommandBuilder()
  .setName('corpo')
  .setDescription('Corpo — peso e medidas')
  .addSubcommand((sub) =>
    sub
      .setName('peso')
      .setDescription('Registrar peso')
      .addNumberOption((opt) =>
        opt
          .setName('kg')
          .setDescription('Peso em kg')
          .setRequired(true)
          .setMinValue(30)
          .setMaxValue(300),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('historico').setDescription('Histórico de peso'));

export async function handleCorpo(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'peso') return handleCorpoPeso(interaction);
  if (sub === 'historico') return handleCorpoHistorico(interaction);
}

async function handleCorpoPeso(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const kg = interaction.options.getNumber('kg', true);
  const nota = interaction.options.getString('nota') ?? undefined;

  await logWeight({ weight_kg: kg, notes: nota });

  const latest = await getLatestWeight();
  await interaction.editReply(
    `⚖️ Peso registrado: **${kg}kg**${latest ? ` (anterior: ${latest.weight_kg}kg)` : ''}`,
  );
}

async function handleCorpoHistorico(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const history = await listWeightHistory(14);
  if (history.length === 0) {
    await interaction.editReply('⚖️ Nenhum peso registrado ainda. Use `/corpo peso`.');
    return;
  }

  const latest = history[0];
  const oldest = history[history.length - 1];
  if (!latest || !oldest) return;
  const diff = latest.weight_kg && oldest.weight_kg ? latest.weight_kg - oldest.weight_kg : null;
  const diffStr = diff !== null ? ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg)` : '';

  const lines = history.slice(0, 10).map((m) => {
    const date = new Date(m.measured_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    return `${date}: **${m.weight_kg}kg**`;
  });

  await interaction.editReply(`⚖️ **Histórico de peso**${diffStr}\n${lines.join('\n')}`);
}

// ─────────────────────────────────────────────
// /remedio — medicamentos
// ─────────────────────────────────────────────

export const remedioCommand = new SlashCommandBuilder()
  .setName('remedio')
  .setDescription('Remédios — aderência e gerenciamento')
  .addSubcommand((sub) =>
    sub
      .setName('tomei')
      .setDescription('Registrar que tomou um remédio')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do remédio (parcial aceito)').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('motivo').setDescription('Motivo caso não tenha tomado').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar remédios ativos'))
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar novo remédio')
      .addStringOption((opt) =>
        opt.setName('nome').setDescription('Nome do remédio').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('freq')
          .setDescription('Frequência')
          .setRequired(true)
          .addChoices(
            { name: 'Diário', value: 'daily' },
            { name: '2x ao dia', value: 'twice_daily' },
            { name: '3x ao dia', value: 'three_times_daily' },
            { name: 'Se necessário', value: 'as_needed' },
            { name: 'Semanal', value: 'weekly' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('dosagem').setDescription('Ex: 50mg').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('indicacao')
          .setDescription('Para que é: TDAH, ansiedade...')
          .setRequired(false),
      ),
  );

export async function handleRemedio(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'tomei') return handleRemedioTomei(interaction);
  if (sub === 'list') return handleRemedioList(interaction);
  if (sub === 'add') return handleRemedioAdd(interaction);
}

async function handleRemedioTomei(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const motivo = interaction.options.getString('motivo') ?? undefined;

  const meds = await listActiveMedications();
  const match = meds.find((m) => m.name.toLowerCase().includes(nome.toLowerCase()));

  if (!match) {
    await interaction.editReply(
      `💊 Remédio "${nome}" não encontrado. Use \`/remedio list\` para ver os ativos.`,
    );
    return;
  }

  await logMedicationTaken({
    medication_id: match.id,
    taken: !motivo,
    skipped_reason: motivo,
  });

  if (motivo) {
    await interaction.editReply(`💊 **${match.name}** — pulado. Motivo: ${motivo}`);
  } else {
    await interaction.editReply(`💊 **${match.name}** — tomado ✓`);
  }
}

async function handleRemedioList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const meds = await listActiveMedications();
  if (meds.length === 0) {
    await interaction.editReply('💊 Nenhum remédio ativo cadastrado. Use `/remedio add`.');
    return;
  }

  const lines = meds.map((m) => {
    const dosStr = m.dosage ? ` ${m.dosage}` : '';
    const indStr = m.indication ? ` — ${m.indication}` : '';
    const freqLabels: Record<string, string> = {
      daily: '1x/dia',
      twice_daily: '2x/dia',
      three_times_daily: '3x/dia',
      as_needed: 'se necessário',
      weekly: 'semanal',
      other: '',
    };
    return `• **${m.name}${dosStr}** (${freqLabels[m.frequency] ?? m.frequency})${indStr}`;
  });

  await interaction.editReply(`💊 **Remédios ativos:**\n${lines.join('\n')}`);
}

async function handleRemedioAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const freq = interaction.options.getString('freq', true) as MedicationFrequency;
  const dosagem = interaction.options.getString('dosagem') ?? undefined;
  const indicacao = interaction.options.getString('indicacao') ?? undefined;

  const med = await createMedication({
    name: nome,
    frequency: freq,
    dosage: dosagem,
    indication: indicacao,
  });

  await interaction.editReply(`💊 **${med.name}** cadastrado ✓`);
}

// ─────────────────────────────────────────────
// /substancia — tracking de substâncias
// ─────────────────────────────────────────────

export const substanciaCommand = new SlashCommandBuilder()
  .setName('substancia')
  .setDescription('Substâncias — registrar e acompanhar')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Registrar uso de substância')
      .addStringOption((opt) =>
        opt
          .setName('tipo')
          .setDescription('Substância')
          .setRequired(true)
          .addChoices(
            { name: 'Cannabis', value: 'cannabis' },
            { name: 'Tabaco', value: 'tobacco' },
            { name: 'Álcool', value: 'alcohol' },
            { name: 'Cafeína', value: 'caffeine' },
          ),
      )
      .addNumberOption((opt) =>
        opt.setName('quantidade').setDescription('Quantidade').setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('unidade')
          .setDescription('Unidade')
          .setRequired(false)
          .addChoices(
            { name: 'gramas (g)', value: 'g' },
            { name: 'cigarros', value: 'cigarettes' },
            { name: 'ml', value: 'ml' },
            { name: 'doses', value: 'doses' },
            { name: 'xícaras', value: 'cups' },
          ),
      )
      .addNumberOption((opt) =>
        opt.setName('custo').setDescription('Custo em R$').setRequired(false).setMinValue(0),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Contexto ou observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('semana').setDescription('Resumo da semana por substância'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('Estatísticas dos últimos 30 dias'));

export async function handleSubstancia(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleSubstanciaAdd(interaction);
  if (sub === 'semana') return handleSubstanciaSemana(interaction);
  if (sub === 'stats') return handleSubstanciaStats(interaction);
}

async function handleSubstanciaAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const tipo = interaction.options.getString('tipo', true) as SubstanceType;
  const quantidade = interaction.options.getNumber('quantidade') ?? undefined;
  const unidade = interaction.options.getString('unidade') ?? undefined;
  const custo = interaction.options.getNumber('custo') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  await logSubstance({
    substance: tipo,
    quantity: quantidade,
    unit: unidade,
    cost_brl: custo,
    notes: nota,
  });

  const qtyStr = quantidade && unidade ? ` — ${quantidade}${unidade}` : '';
  const costStr = custo ? ` (R$${custo.toFixed(2)})` : '';
  const labels: Record<SubstanceType, string> = {
    cannabis: '🌿 Cannabis',
    tobacco: '🚬 Tabaco',
    alcohol: '🍺 Álcool',
    caffeine: '☕ Cafeína',
    other: '💊 Substância',
  };
  await interaction.editReply(`${labels[tipo]}${qtyStr}${costStr} registrado.`);
}

async function handleSubstanciaSemana(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const stats = await getSubstanceStats(7);
  if (stats.length === 0) {
    await interaction.editReply('✅ Nenhuma substância registrada essa semana.');
    return;
  }
  const lines = stats.map((s) => {
    const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
    const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
    return `• **${s.substance}**: ${s.days_used}/7 dias${qtyStr}${costStr}`;
  });
  await interaction.editReply(`**Substâncias — semana:**\n${lines.join('\n')}`);
}

async function handleSubstanciaStats(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();
  const stats = await getSubstanceStats(30);
  if (stats.length === 0) {
    await interaction.editReply('✅ Nenhuma substância registrada nos últimos 30 dias.');
    return;
  }
  const lines = stats.map((s) => {
    const qtyStr = s.total_quantity && s.unit ? ` — ${s.total_quantity}${s.unit}` : '';
    const costStr = s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : '';
    return `• **${s.substance}**: ${s.days_used}/30 dias${qtyStr}${costStr}`;
  });
  await interaction.editReply(`**Substâncias — 30 dias:**\n${lines.join('\n')}`);
}

// ─────────────────────────────────────────────
// /exame — exames laboratoriais
// ─────────────────────────────────────────────

export const exameCommand = new SlashCommandBuilder()
  .setName('exame')
  .setDescription('Exames — registrar e consultar resultados')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Adicionar resultado de exame')
      .addStringOption((opt) =>
        opt
          .setName('nome')
          .setDescription('Nome do exame (ex: TSH, Testosterona)')
          .setRequired(true),
      )
      .addNumberOption((opt) =>
        opt.setName('valor').setDescription('Valor numérico').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('unidade').setDescription('Unidade (ex: mg/dL, mU/L)').setRequired(false),
      )
      .addNumberOption((opt) =>
        opt.setName('ref_min').setDescription('Referência mínima').setRequired(false),
      )
      .addNumberOption((opt) =>
        opt.setName('ref_max').setDescription('Referência máxima').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('laboratorio').setDescription('Nome do laboratório').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('data').setDescription('Data da coleta (YYYY-MM-DD)').setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName('nota').setDescription('Observação').setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('Listar exames recentes'));

export async function handleExame(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') return handleExameAdd(interaction);
  if (sub === 'list') return handleExameList(interaction);
}

async function handleExameAdd(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const nome = interaction.options.getString('nome', true);
  const valor = interaction.options.getNumber('valor') ?? undefined;
  const unidade = interaction.options.getString('unidade') ?? undefined;
  const refMin = interaction.options.getNumber('ref_min') ?? undefined;
  const refMax = interaction.options.getNumber('ref_max') ?? undefined;
  const lab = interaction.options.getString('laboratorio') ?? undefined;
  const data = interaction.options.getString('data') ?? undefined;
  const nota = interaction.options.getString('nota') ?? undefined;

  const result = await addLabResult({
    name: nome,
    value_number: valor,
    unit: unidade,
    reference_min: refMin,
    reference_max: refMax,
    lab_name: lab,
    collected_at: data,
    notes: nota,
  });

  const valStr = valor && unidade ? ` = ${valor} ${unidade}` : valor ? ` = ${valor}` : '';
  const statusEmoji =
    result.status === 'normal'
      ? '✅'
      : result.status === 'elevated'
        ? '⬆️'
        : result.status === 'low'
          ? '⬇️'
          : '🔬';
  const statusStr = result.status ? ` (${result.status})` : '';

  await interaction.editReply(`${statusEmoji} **${nome}**${valStr}${statusStr} registrado.`);
}

async function handleExameList(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const results = await listLabResults(15);
  if (results.length === 0) {
    await interaction.editReply('🔬 Nenhum exame registrado ainda. Use `/exame add`.');
    return;
  }

  const lines = results.slice(0, 15).map((r) => {
    const date = new Date(r.collected_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const valStr =
      r.value_number !== null && r.unit
        ? ` ${r.value_number} ${r.unit}`
        : r.value_number !== null
          ? ` ${r.value_number}`
          : '';
    const statusEmoji =
      r.status === 'normal'
        ? '✅'
        : r.status === 'elevated'
          ? '⬆️'
          : r.status === 'low'
            ? '⬇️'
            : '🔬';
    return `${statusEmoji} ${date} **${r.name}**${valStr}`;
  });

  await interaction.editReply(`🔬 **Exames recentes:**\n${lines.join('\n')}`);
}
