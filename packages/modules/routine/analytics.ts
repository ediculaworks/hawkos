import { db } from '@hawk/db';

/**
 * Routine Analytics — Habit Failure Prediction
 *
 * B4: Predict which habits are at risk of being missed today
 * based on behavioral patterns: day of week, streak length,
 * recent completion history, and difficulty.
 *
 * Instead of a trained logistic regression (which needs a library),
 * we use a weighted feature scoring model that approximates the same
 * result. The weights can be tuned as data accumulates.
 *
 * Features:
 * 1. Day-of-week completion rate (some habits fail more on weekends)
 * 2. Streak momentum (longer streaks → less likely to fail)
 * 3. Recent consistency (completed 6/7 last days → strong, 2/7 → weak)
 * 4. Difficulty penalty (harder habits fail more)
 * 5. Time since last completion (gap momentum)
 */

// ── Types ──────────────────────────────────────────────────

export type HabitRiskAssessment = {
  habit_id: string;
  habit_name: string;
  risk_score: number; // 0-100 (higher = more likely to fail)
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  current_streak: number;
  factors: string[]; // Human-readable risk factors
};

// ── Feature Weights ────────────────────────────────────────

// These weights determine how much each factor contributes to risk.
// Higher weight = more influence on the risk score.
const WEIGHTS = {
  day_of_week: 25, // Max contribution from day-of-week pattern
  streak_momentum: 20, // Bonus/penalty from current streak
  recent_consistency: 30, // Weight of last 7 days completion rate
  difficulty: 15, // Penalty from difficulty level
  gap_momentum: 10, // Penalty from days since last completion
};

const DIFFICULTY_PENALTY: Record<string, number> = {
  trivial: 0,
  easy: 0.2,
  medium: 0.5,
  hard: 0.8,
};

// ── Risk Assessment ────────────────────────────────────────

/**
 * Assess failure risk for all active habits.
 *
 * For each habit, computes a risk score (0-100) based on:
 * 1. Historical day-of-week completion rate
 * 2. Current streak momentum
 * 3. Recent 7-day consistency
 * 4. Habit difficulty
 * 5. Gap since last completion
 */
export async function assessHabitRisks(): Promise<HabitRiskAssessment[]> {
  // Get active habits
  const { data: habits, error: habitsErr } = await db
    .from('habits')
    .select(
      'id, name, current_streak, best_streak, difficulty, frequency, last_completed_date, total_completions',
    )
    .eq('active', true);

  if (habitsErr || !habits || habits.length === 0) return [];

  // Get last 30 days of habit logs for all habits
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: logs, error: logsErr } = await db
    .from('habit_logs')
    .select('habit_id, date, completed')
    .gte('date', thirtyDaysAgo.toISOString().slice(0, 10))
    .eq('completed', true);

  if (logsErr) return [];

  // Index logs by habit
  const logsByHabit = new Map<string, string[]>();
  for (const log of logs ?? []) {
    const habitId = log.habit_id as string;
    if (!logsByHabit.has(habitId)) logsByHabit.set(habitId, []);
    logsByHabit.get(habitId)?.push(log.date as string);
  }

  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun, 6=Sat
  const todayStr = today.toISOString().slice(0, 10);

  const assessments: HabitRiskAssessment[] = [];

  for (const habit of habits) {
    const habitId = habit.id as string;
    const completedDates = logsByHabit.get(habitId) ?? [];
    const factors: string[] = [];
    let riskScore = 0;

    // 1. Day-of-week completion rate
    const sameDowDates = completedDates.filter((d) => new Date(d).getDay() === todayDow);
    const totalSameDow = Math.ceil(30 / 7); // ~4 same days in 30 days
    const dowRate = totalSameDow > 0 ? sameDowDates.length / totalSameDow : 0.5;
    const dowRisk = (1 - Math.min(dowRate, 1)) * WEIGHTS.day_of_week;
    riskScore += dowRisk;
    if (dowRate < 0.3) {
      const dowName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][todayDow];
      factors.push(`Baixa taxa de conclusão às ${dowName} (${Math.round(dowRate * 100)}%)`);
    }

    // 2. Streak momentum (longer streak = less risk)
    const streak = habit.current_streak as number;
    const streakFactor = Math.min(streak / 14, 1); // Normalize: 14+ days = max momentum
    const streakRisk = (1 - streakFactor) * WEIGHTS.streak_momentum;
    riskScore += streakRisk;
    if (streak === 0) {
      factors.push('Sem streak ativo');
    } else if (streak >= 7) {
      riskScore -= 5; // Bonus for strong streak
    }

    // 3. Recent 7-day consistency
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDayStr = sevenDaysAgo.toISOString().slice(0, 10);
    const recentCompletions = completedDates.filter((d) => d >= sevenDayStr).length;
    const recentRate = recentCompletions / 7;
    const consistencyRisk = (1 - recentRate) * WEIGHTS.recent_consistency;
    riskScore += consistencyRisk;
    if (recentRate < 0.5) {
      factors.push(`Baixa consistência recente (${recentCompletions}/7 dias)`);
    }

    // 4. Difficulty penalty
    const difficulty = (habit.difficulty as string) ?? 'medium';
    const difficultyPenalty = (DIFFICULTY_PENALTY[difficulty] ?? 0.5) * WEIGHTS.difficulty;
    riskScore += difficultyPenalty;
    if (difficulty === 'hard') {
      factors.push('Hábito de dificuldade alta');
    }

    // 5. Gap momentum
    const lastCompleted = habit.last_completed_date as string | null;
    if (lastCompleted) {
      const daysSinceLast = Math.floor(
        (today.getTime() - new Date(lastCompleted).getTime()) / 86_400_000,
      );
      if (daysSinceLast > 1) {
        const gapRisk = Math.min(daysSinceLast / 7, 1) * WEIGHTS.gap_momentum;
        riskScore += gapRisk;
        if (daysSinceLast >= 3) {
          factors.push(`${daysSinceLast} dias sem completar`);
        }
      }
    } else {
      riskScore += WEIGHTS.gap_momentum;
      factors.push('Nunca completado');
    }

    // Check if already completed today
    const completedToday = completedDates.includes(todayStr);
    if (completedToday) {
      riskScore = 0;
      factors.length = 0;
    }

    // Clamp to 0-100
    riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

    // Determine risk level
    let riskLevel: HabitRiskAssessment['risk_level'] = 'low';
    if (riskScore >= 75) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';

    assessments.push({
      habit_id: habitId,
      habit_name: habit.name as string,
      risk_score: riskScore,
      risk_level: riskLevel,
      current_streak: streak,
      factors,
    });
  }

  return assessments
    .filter((a) => a.risk_score > 0) // Exclude completed today
    .sort((a, b) => b.risk_score - a.risk_score);
}

/**
 * Format risk assessments into a human-readable message.
 */
export function formatRiskSummary(assessments: HabitRiskAssessment[]): string {
  const atRisk = assessments.filter((a) => a.risk_level !== 'low');
  if (atRisk.length === 0) return '';

  const lines = ['Hábitos em risco hoje:'];

  for (const a of atRisk) {
    const tag =
      a.risk_level === 'critical' ? '[CRITICO]' : a.risk_level === 'high' ? '[ALTO]' : '[MEDIO]';
    const factorsStr = a.factors.length > 0 ? ` — ${a.factors.join('; ')}` : '';
    lines.push(
      `  ${tag} ${a.habit_name} (risco ${a.risk_score}%, streak ${a.current_streak})${factorsStr}`,
    );
  }

  return lines.join('\n');
}
