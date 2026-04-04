// Automation: Weekly Review
// Resumo completo da semana — horário configurável via agent_settings

import { db } from '@hawk/db';
import { type JournalEntry, getJournalStats, listEntriesByPeriod } from '@hawk/module-journal';
import { type Objective, listObjectivesByTimeframe } from '@hawk/module-objectives';
import { type HabitWeekSummary, getWeekSummary } from '@hawk/module-routine';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';

const CHANNEL_ID = process.env.DISCORD_CHANNEL_GERAL ?? '';

interface WeeklyReviewSettings {
  weekly_review_enabled: boolean;
  weekly_review_time: string;
}

async function getWeeklyReviewSettings(): Promise<WeeklyReviewSettings> {
  try {
    const { data } = await db.from('agent_settings').select('*').limit(1).single();
    return {
      weekly_review_enabled: data?.weekly_review_enabled ?? true,
      weekly_review_time: data?.weekly_review_time ?? '20:00',
    };
  } catch {
    return {
      weekly_review_enabled: true,
      weekly_review_time: '20:00',
    };
  }
}

export async function sendWeeklyReview(): Promise<void> {
  if (!CHANNEL_ID) {
    return;
  }

  // Check web UI toggle (automation_configs) + agent_settings
  if (!(await isAutomationEnabled('weekly-review'))) return;

  const settings = await getWeeklyReviewSettings();
  if (!settings.weekly_review_enabled) return;

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const startDate = weekAgo.toISOString().split('T')[0] as string;
  const endDate = today.toISOString().split('T')[0] as string;

  const weekLabel = `${weekAgo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}–${today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

  const [habitSummaries, journalEntries, journalStats, objectivesByTimeframe] = await Promise.all([
    getWeekSummary(),
    listEntriesByPeriod(startDate, endDate),
    getJournalStats(),
    listObjectivesByTimeframe(),
  ]);

  const sections: string[] = [`📊 **Review Semanal (${weekLabel})**`];

  if (habitSummaries.length > 0) {
    const habitLines = habitSummaries.map((s: HabitWeekSummary) => {
      const pct = s.completion_rate;
      const status = pct >= 100 ? '✅' : pct >= 70 ? '⚠️' : '❌';
      const icon = s.habit.icon ?? '';
      const streakInfo = s.habit.current_streak > 0 ? ` (streak: ${s.habit.current_streak})` : '';
      return `${status} ${icon}${s.habit.name}: ${s.week_completions}/${s.week_target} (${pct}%)${streakInfo}`;
    });
    sections.push(`**HÁBITOS:**\n${habitLines.join('\n')}`);
  }

  const dailyEntries = journalEntries.filter((e: JournalEntry) => e.type === 'daily');
  if (dailyEntries.length > 0 || journalStats.avg_mood) {
    const moodEntries = dailyEntries.filter((e: JournalEntry) => e.mood !== null);
    const avgMood =
      moodEntries.length > 0
        ? moodEntries.reduce((sum: number, e: JournalEntry) => sum + (e.mood ?? 0), 0) /
          moodEntries.length
        : null;

    const energyEntries = dailyEntries.filter((e: JournalEntry) => e.energy !== null);
    const avgEnergy =
      energyEntries.length > 0
        ? energyEntries.reduce((sum: number, e: JournalEntry) => sum + (e.energy ?? 0), 0) /
          energyEntries.length
        : null;

    const bestMoodEntry = moodEntries.sort(
      (a: JournalEntry, b: JournalEntry) => (b.mood ?? 0) - (a.mood ?? 0),
    )[0];
    const bestDay = bestMoodEntry
      ? new Date(bestMoodEntry.date).toLocaleDateString('pt-BR', { weekday: 'long' })
      : null;

    const diaryLines: string[] = [`${dailyEntries.length} entradas registradas`];
    if (avgMood) diaryLines.push(`Humor médio: ${avgMood.toFixed(1)}/10`);
    if (avgEnergy) diaryLines.push(`Energia média: ${avgEnergy.toFixed(1)}/10`);
    if (bestDay) diaryLines.push(`Melhor dia: ${bestDay} (humor ${bestMoodEntry?.mood})`);

    sections.push(`**DIÁRIO:**\n${diaryLines.join('\n')}`);
  }

  const allObjectives = [
    ...objectivesByTimeframe.short,
    ...objectivesByTimeframe.medium,
    ...objectivesByTimeframe.long,
  ]
    .filter((o: Objective) => o.priority >= 7)
    .slice(0, 6);

  if (allObjectives.length > 0) {
    const objLines = allObjectives.map((o: Objective) => {
      const pct = o.progress;
      const bar = `${'█'.repeat(Math.round(pct / 10))}${'░'.repeat(10 - Math.round(pct / 10))}`;
      return `• ${o.title}: [${bar}] ${pct}%`;
    });
    sections.push(`**OBJETIVOS (alta prioridade):**\n${objLines.join('\n')}`);
  }

  const suggestions: string[] = [];

  const weakHabits = habitSummaries.filter((s: HabitWeekSummary) => s.completion_rate < 70);
  if (weakHabits.length > 0) {
    suggestions.push(
      `→ Atenção: ${weakHabits.map((s: HabitWeekSummary) => s.habit.name).join(', ')} abaixo de 70%`,
    );
  }

  const stagnantObjectives = allObjectives.filter(
    (o: Objective) => o.progress === 0 && o.priority >= 8,
  );
  if (stagnantObjectives.length > 0) {
    suggestions.push(
      `→ Sem progresso: ${stagnantObjectives.map((o: Objective) => o.title).join(', ')}`,
    );
  }

  if (suggestions.length > 0) {
    sections.push(`**FOCO SUGERIDO:**\n${suggestions.join('\n')}`);
  }

  const message = sections.join('\n\n');
  await sendToChannel(CHANNEL_ID, message);
}

let _weeklyRunning = false;

function getLocalTime(timezone: string): { hours: number; minutes: number; dayOfWeek: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { hours: get('hour'), minutes: get('minute'), dayOfWeek: dayMap[weekday] ?? 0 };
}

export function startWeeklyReviewCron(): void {
  cron.schedule('0 * * * *', async () => {
    if (_weeklyRunning) return;
    _weeklyRunning = true;
    try {
      const settings = await getWeeklyReviewSettings();
      if (!settings.weekly_review_enabled) return;

      const timezone =
        ((settings as unknown as Record<string, unknown>).timezone as string) ??
        'America/Sao_Paulo';
      const now = getLocalTime(timezone);
      const [hours, minutes] = settings.weekly_review_time.split(':').map(Number);

      if (now.dayOfWeek === 0 && now.hours === hours && now.minutes === minutes) {
        await sendWeeklyReview()
          .then(() => markAutomationRun('weekly-review', 'success'))
          .catch((err) => {
            console.error('[weekly-review] Failed:', err);
            markAutomationRun('weekly-review', 'failure', String(err));
          });
      }
    } finally {
      _weeklyRunning = false;
    }
  });
}
