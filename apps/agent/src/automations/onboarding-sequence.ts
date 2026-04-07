// Automation: Onboarding Sequence
// Sends one deepening question per day for the first 14 days after onboarding.
// Pauses automatically if the user ignores 2 consecutive questions.

import { db } from '@hawk/db';
import { getNextQuestion, markQuestionAsked } from '@hawk/module-memory';
import cron, { type ScheduledTask } from 'node-cron';
import { sendToChannel } from '../channels/discord.js';
import { type CronTenantCtx, resolveChannel, scopedCron } from './resolve-channel.js';

const ONBOARDING_WINDOW_DAYS = 14;
const MAX_IGNORED_IN_A_ROW = 2;

async function shouldSendOnboardingQuestion(): Promise<boolean> {
  try {
    const { data: profile } = await db
      .from('profile')
      .select('onboarding_complete, onboarding_completed_at')
      .limit(1)
      .single();

    if (!profile?.onboarding_complete) return false;

    const completedAt = profile.onboarding_completed_at
      ? new Date(profile.onboarding_completed_at as string)
      : null;

    if (!completedAt) return false;

    const daysSinceCompletion = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCompletion > ONBOARDING_WINDOW_DAYS) return false;

    // Check if user has been ignoring questions (MAX_IGNORED_IN_A_ROW asked but unanswered)
    const { data: recentAsked } = await db
      .from('onboarding_questions')
      .select('id, status')
      .eq('status', 'asked')
      .order('asked_at', { ascending: false })
      .limit(MAX_IGNORED_IN_A_ROW);

    if (recentAsked && recentAsked.length >= MAX_IGNORED_IN_A_ROW) {
      // All recent questions were asked but not answered → pause
      const allIgnored = recentAsked.every((q: { status: string }) => q.status === 'asked');
      if (allIgnored) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function runOnboardingSequence(slug?: string): Promise<void> {
  const channelId = resolveChannel(slug);
  if (!channelId) return;

  const send = await shouldSendOnboardingQuestion();
  if (!send) return;

  const question = await getNextQuestion();
  if (!question) return; // All questions answered

  await markQuestionAsked(question.id);

  const blockLabel: Record<string, string> = {
    health: '🏃 Saúde',
    finances: '💰 Finanças',
    relationships: '👥 Relações',
    career: '💼 Carreira',
    lifestyle: '🌿 Estilo de vida',
    psychology: '🧠 Psicologia',
    dynamic: '✨ Sugestão',
  };

  const label = blockLabel[question.block] ?? '💡 Conhecer-te melhor';
  const message = [
    `${label}`,
    '',
    `> ${question.question}`,
    '',
    question.reason ? `_${question.reason}_` : null,
    '',
    '_(Responde aqui ou ignora se não quiseres responder agora)_',
  ]
    .filter((line) => line !== null)
    .join('\n');

  await sendToChannel(channelId, message, slug);
}

let _onboardingRunning = false;

export function startOnboardingSequenceCron(ctx?: CronTenantCtx): ScheduledTask {
  return cron.schedule(
    '0 10 * * *',
    scopedCron(ctx, async () => {
      if (_onboardingRunning) return;
      _onboardingRunning = true;
      try {
        await runOnboardingSequence(ctx?.slug);
      } finally {
        _onboardingRunning = false;
      }
    }),
  );
}
