// Automation: Daily Check-in
// Manhã e noite — horários configuráveis via agent_settings

import { db } from '@hawk/db';
import { getTodayEntry } from '@hawk/module-journal';
import { getNextQuestion, markQuestionAsked } from '@hawk/module-memory';
import type { HabitWithLog } from '@hawk/module-routine';
import { listHabitsWithTodayStatus } from '@hawk/module-routine';
import { fetchHolidays } from '@hawk/shared';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';

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
export function startCheckinCrons(): void {
  cron.schedule('0 * * * *', async () => {
    const settings = await getAgentSettings();
    const now = new Date();
    const [mHours, mMinutes] = settings.checkin_morning_time.split(':').map(Number);
    const [eHours, eMinutes] = settings.checkin_evening_time.split(':').map(Number);

    if (
      settings.checkin_morning_enabled &&
      now.getHours() === mHours &&
      now.getMinutes() === mMinutes
    ) {
      sendMorningCheckin()
        .then(() => markAutomationRun('daily-checkin-morning', 'success'))
        .catch((err) => {
          console.error('[daily-checkin] Morning failed:', err);
          markAutomationRun('daily-checkin-morning', 'failure', String(err));
        });
    }

    if (
      settings.checkin_evening_enabled &&
      now.getHours() === eHours &&
      now.getMinutes() === eMinutes
    ) {
      sendEveningCheckin()
        .then(() => markAutomationRun('daily-checkin-evening', 'success'))
        .catch((err) => {
          console.error('[daily-checkin] Evening failed:', err);
          markAutomationRun('daily-checkin-evening', 'failure', String(err));
        });
    }
  });
}
