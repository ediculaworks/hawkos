// Automation: Streak Guardian (Habitica pattern)
// Verifica hábitos com streak em risco e envia alerta às 20h
// Permite que o usuário complete os hábitos antes da meia-noite

import { getHabitsAtRisk, getWeeklyRoutineScore } from '@hawk/module-routine';
import cron from 'node-cron';
import { sendToChannel } from '../channels/discord.js';

const CHANNEL_ID = process.env.DISCORD_CHANNEL_GERAL ?? '';

export async function runStreakGuardian(): Promise<void> {
  if (!CHANNEL_ID) return;

  const [atRisk, weeklyScore] = await Promise.all([getHabitsAtRisk(), getWeeklyRoutineScore()]);

  if (atRisk.length === 0) return; // silencioso quando tudo OK

  const lines: string[] = [
    `🔥 **Streak Guardian** — Score semanal: ${weeklyScore}/100`,
    '',
    `⚠️ ${atRisk.length} hábito(s) com streak em risco hoje:`,
  ];

  for (const h of atRisk) {
    const emoji = h.difficulty === 'hard' ? '🔴' : h.difficulty === 'medium' ? '🟠' : '🟡';
    lines.push(
      `${emoji} **${h.habit_name}** — streak ${h.current_streak}d · último: ${h.last_completed_date}`,
    );
  }

  lines.push('', '_Complete antes da meia-noite para não perder o streak!_');

  await sendToChannel(CHANNEL_ID, lines.join('\n'));
}

export function startStreakGuardianCron(): void {
  // Todos os dias às 20:00
  cron.schedule('0 20 * * *', () => {
    runStreakGuardian().catch(console.error);
  });
}
