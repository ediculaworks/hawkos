import { type CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDailyHealthSummary, getWeekHealthStats } from '../queries';

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
