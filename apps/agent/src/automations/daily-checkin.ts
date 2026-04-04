// Automation: Daily Check-in
// Manhã e noite — horários configuráveis via agent_settings
// [SILENT] suppression: skips sending when nothing changed since last check-in

import { db } from '@hawk/db';
import { getTodayEntry } from '@hawk/module-journal';
import { getNextQuestion, markQuestionAsked } from '@hawk/module-memory';
import type { HabitWithLog } from '@hawk/module-routine';
import { listHabitsWithTodayStatus } from '@hawk/module-routine';
import { createLogger, fetchHolidays } from '@hawk/shared';
import cron from 'node-cron';
import { logActivity } from '../activity-logger.js';
import { sendToChannel } from '../channels/discord.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';

const logger = createLogger('daily-checkin');

const CHANNEL_ID = process.env.DISCORD_CHANNEL_GERAL ?? '';

interface AgentSettings {
  checkin_morning_enabled: boolean;
  checkin_morning_time: string;
  checkin_evening_enabled: boolean;
  checkin_evening_time: string;
  timezone: string;
}

async function getAgentSettings(): Promise<AgentSettings> {
  try {
    const { data } = await db.from('agent_settings').select('*').limit(1).single();
    return {
      checkin_morning_enabled: data?.checkin_morning_enabled ?? true,
      checkin_morning_time: data?.checkin_morning_time ?? '09:00',
      checkin_evening_enabled: data?.checkin_evening_enabled ?? true,
      checkin_evening_time: data?.checkin_evening_time ?? '22:00',
      timezone: data?.timezone ?? 'America/Sao_Paulo',
    };
  } catch {
    return {
      checkin_morning_enabled: true,
      checkin_morning_time: '09:00',
      checkin_evening_enabled: true,
      checkin_evening_time: '22:00',
      timezone: 'America/Sao_Paulo',
    };
  }
}

function getLocalizedDate(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
  });
}

// ── [SILENT] Cron Suppression ─────────────────────────────────────────────
// Skip check-in when nothing meaningful has changed (no pending habits, no new
// interactions since last check-in). Inspired by Hermes Agent's [SILENT] pattern.

async function shouldSuppressMorningCheckin(): Promise<boolean> {
  try {
    const habits = await listHabitsWithTodayStatus();
    // If there are no habits at all, nothing to report
    if (habits.length === 0) return true;

    // Check if there were any messages in the last 24h (user is active)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from('conversation_messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .eq('role', 'user');

    // If user hasn't interacted in 24h, suppress — they're probably away
    if ((count ?? 0) === 0) {
      logger.info('[SILENT] Morning check-in suppressed: no user activity in 24h');
      logActivity('automation_skipped', 'Morning check-in: SILENT (no activity 24h)', undefined, {
        automation: 'daily-checkin-morning',
        reason: 'no_user_activity',
      }).catch(() => {});
      return true;
    }

    return false;
  } catch {
    // On error, don't suppress — better to send than miss
    return false;
  }
}

async function shouldSuppressEveningCheckin(): Promise<boolean> {
  try {
    const habits = await listHabitsWithTodayStatus();
    const completed = habits.filter((h: HabitWithLog) => h.completed_today);
    const pending = habits.filter((h: HabitWithLog) => !h.completed_today);

    // If all habits are done and user already logged mood — nothing to check out
    const todayEntry = await getTodayEntry();
    if (pending.length === 0 && completed.length > 0 && todayEntry?.mood) {
      logger.info('[SILENT] Evening check-in suppressed: all habits done, mood logged');
      logActivity('automation_skipped', 'Evening check-in: SILENT (all complete)', undefined, {
        automation: 'daily-checkin-evening',
        reason: 'all_habits_complete_mood_logged',
      }).catch(() => {});
      return true;
    }

    // If no habits exist and no journal entry today — nothing useful to show
    if (habits.length === 0 && !todayEntry) {
      logger.info('[SILENT] Evening check-in suppressed: no habits or journal');
      logActivity('automation_skipped', 'Evening check-in: SILENT (no data)', undefined, {
        automation: 'daily-checkin-evening',
        reason: 'no_habits_no_journal',
      }).catch(() => {});
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check-in matinal
 * Pergunta humor, energia e top 3 do dia
 */
export async function sendMorningCheckin(): Promise<void> {
  if (!CHANNEL_ID) {
    return;
  }

  // Check web UI toggle (automation_configs) + agent_settings
  if (!(await isAutomationEnabled('daily-checkin-morning'))) return;

  const settings = await getAgentSettings();
  if (!settings.checkin_morning_enabled) {
    return;
  }

  // [SILENT] suppression — skip when nothing changed
  if (await shouldSuppressMorningCheckin()) return;

  const habits = await listHabitsWithTodayStatus();
  const activeHabits = habits.filter((h: HabitWithLog) => !h.completed_today);

  const today = getLocalizedDate(settings.timezone).format(new Date());

  const habitList =
    activeHabits.length > 0
      ? `\n📋 Hábitos de hoje: ${activeHabits.map((h: HabitWithLog) => `${h.icon ?? ''}${h.name}`).join(' · ')}`
      : '\n✅ Todos os hábitos já registrados!';

  let holidayLine = '';
  try {
    const holidays = await fetchHolidays(new Date().getFullYear());
    const todayISO = new Date().toISOString().slice(0, 10);
    const todayHoliday = holidays.find((h) => h.date === todayISO);
    if (todayHoliday) {
      holidayLine = `\n🎉 Hoje é **${todayHoliday.name}**!\n`;
    }
  } catch {
    /* BrasilAPI offline — skip */
  }

  let questionLine = '';
  try {
    const question = await getNextQuestion();
    if (question) {
      questionLine = `\n\n💡 **Pergunta do dia:**\n${question.question}`;
      await markQuestionAsked(question.id);
    }
  } catch {
    /* question system offline — skip */
  }

  const message = [
    `🌅 **Bom dia! ${today}**`,
    holidayLine,
    'Como você está? Responda com humor (1-10) e energia (1-10).',
    'Exemplo: `humor 7 energia 6`',
    '',
    'Quais são os seus **top 3** de hoje?',
    habitList,
    questionLine,
  ].join('\n');

  await sendToChannel(CHANNEL_ID, message);
}

/**
 * Check-out noturno
 * Mostra hábitos do dia e pede reflexão
 */
export async function sendEveningCheckin(): Promise<void> {
  if (!CHANNEL_ID) {
    return;
  }

  // Check web UI toggle (automation_configs) + agent_settings
  if (!(await isAutomationEnabled('daily-checkin-evening'))) return;

  const settings = await getAgentSettings();
  if (!settings.checkin_evening_enabled) {
    return;
  }

  // [SILENT] suppression — skip when everything is already done
  if (await shouldSuppressEveningCheckin()) return;

  const [habits, todayEntry] = await Promise.all([listHabitsWithTodayStatus(), getTodayEntry()]);

  const completed = habits.filter((h: HabitWithLog) => h.completed_today);
  const pending = habits.filter((h: HabitWithLog) => !h.completed_today);

  const habitLines = [
    ...completed.map((h: HabitWithLog) => `✅ ${h.icon ?? ''}${h.name}`),
    ...pending.map((h: HabitWithLog) => `⬜ ${h.icon ?? ''}${h.name}`),
  ].join('\n');

  const moodLine = todayEntry?.mood
    ? `\nHumor registrado hoje: ${todayEntry.mood}/10`
    : '\nAinda não registrou humor hoje.';

  const message = [
    '🌙 **Check-out — como foi o dia?**',
    '',
    '**Hábitos:**',
    habitLines || 'Nenhum hábito registrado.',
    moodLine,
    '',
    `${completed.length}/${habits.length} hábitos completados`,
    '',
    'Qual foi o **destaque do dia**? Use `/diario add` para registrar.',
  ].join('\n');

  await sendToChannel(CHANNEL_ID, message);
}

/**
 * Inicializar crons de check-in (chamado no startup do bot)
 * Nota: tempos são lidos a cada execução para suportar mudanças em runtime
 */
let _checkinRunning = false;

function getLocalHour(timezone: string): { hours: number; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hours: get('hour'), minutes: get('minute') };
}

export function startCheckinCrons(): void {
  cron.schedule('0 * * * *', async () => {
    if (_checkinRunning) return;
    _checkinRunning = true;
    try {
      const settings = await getAgentSettings();
      const now = getLocalHour(settings.timezone);
      const [mHours, mMinutes] = settings.checkin_morning_time.split(':').map(Number);
      const [eHours, eMinutes] = settings.checkin_evening_time.split(':').map(Number);

      if (settings.checkin_morning_enabled && now.hours === mHours && now.minutes === mMinutes) {
        await sendMorningCheckin()
          .then(() => markAutomationRun('daily-checkin-morning', 'success'))
          .catch((err) => {
            console.error('[daily-checkin] Morning failed:', err);
            markAutomationRun('daily-checkin-morning', 'failure', String(err));
          });
      }

      if (settings.checkin_evening_enabled && now.hours === eHours && now.minutes === eMinutes) {
        await sendEveningCheckin()
          .then(() => markAutomationRun('daily-checkin-evening', 'success'))
          .catch((err) => {
            console.error('[daily-checkin] Evening failed:', err);
            markAutomationRun('daily-checkin-evening', 'failure', String(err));
          });
      }
    } finally {
      _checkinRunning = false;
    }
  });
}
