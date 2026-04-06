// Automation: Health Insights
// - Detecta padrões: sono baixo + humor baixo
// - Detecta: exercício vs humor
// - Detecta: streaks de exercícios
// - Detecta: uso de substâncias + impacto no humor
// Roda diariamente às 09:00

import {
  getDailyHealthSummary,
  getSubstanceStats,
  getWeekHealthStats,
} from '@hawk/module-health/queries';
import { getJournalStats, listRecentEntries } from '@hawk/module-journal/queries';
import { getCombinedMoodAverage } from '@hawk/module-spirituality/queries';
import cron, { type ScheduledTask } from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { type CronTenantCtx, resolveChannel, scopedCron } from './resolve-channel.js';

/**
 * Analisa correlações de saúde e envia insights
 */
export async function runHealthInsights(slug?: string): Promise<void> {
  const channelId = resolveChannel(slug);
  if (!channelId) return;

  const insights: string[] = [];

  const [todayHealth, weekStats, _journalStats, recentJournal, combinedMood, substanceStats] =
    await Promise.all([
      getDailyHealthSummary(),
      getWeekHealthStats(),
      getJournalStats(),
      listRecentEntries(7),
      getCombinedMoodAverage(7),
      getSubstanceStats(7),
    ]);

  // ── Correlação Sono + Humor ─────────────────────────────────────────────
  const journalMoods = recentJournal
    .filter((e: { mood: number | null }) => e.mood)
    .map((e: { mood: number | null }) => e.mood as number);
  const avgMoodFromJournal =
    journalMoods.length > 0
      ? journalMoods.reduce((a: number, b: number) => a + b, 0) / journalMoods.length
      : null;
  const avgMood = combinedMood ?? avgMoodFromJournal;

  if (
    weekStats.avg_sleep_h !== null &&
    weekStats.avg_sleep_h < 6 &&
    avgMood !== null &&
    avgMood < 6
  ) {
    insights.push(
      `😴 **Padrão detectado:** Você dormiu em média ${weekStats.avg_sleep_h.toFixed(1)}h essa semana e seu humor está em ${avgMood.toFixed(1)}/10. Dormir mais pode melhorar seu humor!`,
    );
  }

  // ── Exercício + Humor ───────────────────────────────────────────────────
  if (weekStats.workouts_count >= 3 && avgMood !== null && avgMood >= 7) {
    insights.push(
      `💪 **Bom sinal:** ${weekStats.workouts_count} treinos essa semana e humor em ${avgMood.toFixed(1)}/10. O exercício está ajudando!`,
    );
  }

  if (weekStats.workouts_count === 0 && recentJournal.length > 0) {
    insights.push('⚠️ **Sem exercícios essa semana.** Que tal um treino leve hoje?');
  }

  // ── Streak de exercício ──────────────────────────────────────────────────
  // Detectar se houve treino ontem (simples verificação)
  if (todayHealth?.exercised) {
    insights.push(
      `🏃 **Você já treinou hoje!** ${todayHealth.workout_type ? `(${todayHealth.workout_type})` : ''}`,
    );
  }

  // ── Substâncias + Impacto ───────────────────────────────────────────────
  if (substanceStats.length > 0) {
    for (const s of substanceStats) {
      if (s.substance === 'cannabis' && s.days_used >= 5) {
        insights.push(
          `🌿 **Uso de cannabis:** ${s.days_used}/7 dias essa semana${s.total_cost ? ` (R$${s.total_cost.toFixed(2)})` : ''}. Como está seu humor?`,
        );
      }
      if (s.substance === 'tobacco' && s.days_used >= 3) {
        insights.push(`🚬 **Cigarro:** ${s.days_used}/7 dias. Considere reduzir!`);
      }
    }
  }

  // ── Peso corporal ────────────────────────────────────────────────────────
  if (todayHealth?.weight_kg) {
    insights.push(`⚖️ **Peso atual:** ${todayHealth.weight_kg}kg`);
  }

  // ── Sono de hoje ───────────────────────────────────────────────────────
  if (todayHealth?.sleep_hours) {
    const quality = todayHealth.sleep_quality ? ` (qualidade ${todayHealth.sleep_quality}/10)` : '';
    insights.push(`🌙 **Sono hoje:** ${todayHealth.sleep_hours}h${quality}`);
  }

  if (insights.length === 0) return;

  const message = `💊 **Insights de Saúde:**\n\n${insights.join('\n\n')}`;
  await sendToChannel(channelId, message, slug);
}

/**
 * Inicializar cron de insights de saúde (09:00 daily)
 */
export function startHealthInsightsCron(ctx?: CronTenantCtx): ScheduledTask {
  return cron.schedule(
    '0 9 * * *',
    scopedCron(ctx, async () => {
      await runHealthInsights(ctx?.slug);
    }),
  );
}
