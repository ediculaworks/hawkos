// Automation: Streak Guardian (Habitica pattern)
// Verifica hábitos com streak em risco e envia alerta às 20h
// Permite que o usuário complete os hábitos antes da meia-noite

import { getHabitsAtRisk, getWeeklyRoutineScore } from '@hawk/module-routine';
import cron, { type ScheduledTask } from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';
import { type CronTenantCtx, resolveChannel, scopedCron } from './resolve-channel.js';

export async function runStreakGuardian(slug?: string): Promise<void> {
  const channelId = resolveChannel(slug);
  if (!channelId) return;

  // Check web UI toggle (automation_configs)
  if (!(await isAutomationEnabled('streak-guardian'))) return;

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

  await sendToChannel(channelId, lines.join('\n'), slug);
}

export function startStreakGuardianCron(ctx?: CronTenantCtx): ScheduledTask {
  return cron.schedule(
    '0 20 * * *',
    scopedCron(ctx, async () => {
      await runStreakGuardian(ctx?.slug)
        .then(() => markAutomationRun('streak-guardian', 'success'))
        .catch((err: unknown) => {
          console.error('[streak-guardian] Failed:', err);
          markAutomationRun('streak-guardian', 'failure', String(err));
        });
    }),
  );
}
