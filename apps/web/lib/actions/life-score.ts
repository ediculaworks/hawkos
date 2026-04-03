'use server';

import { withTenant } from '@/lib/supabase/with-tenant';
import { db } from '@hawk/db';

export interface LifeScoreDimension {
  id: string;
  label: string;
  score: number; // 0-100
  color: string;
}

export interface LifeScore {
  total: number; // 0-100
  dimensions: LifeScoreDimension[];
  updatedAt: string;
}

/**
 * Compute a holistic life score from available module data.
 * Each dimension is scored 0-100 based on recent activity and quality metrics.
 */
export async function fetchLifeScore(): Promise<LifeScore> {
  return withTenant(async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const dimensions: LifeScoreDimension[] = [];

    // ── Health score (sleep + workouts) ──────────────────────────────────
    try {
      const [sleepData, workoutData] = await Promise.all([
        db
          .from('sleep_sessions')
          .select('duration_h, quality')
          .gte('date', sevenDaysAgo)
          .order('date', { ascending: false })
          .limit(7),
        db.from('workout_sessions').select('id').gte('date', sevenDaysAgo).limit(7),
      ]);

      const sleeps = sleepData.data ?? [];
      const workouts = workoutData.data ?? [];

      let healthScore = 50;
      if (sleeps.length > 0) {
        const avgSleep = sleeps.reduce((s, r) => s + (r.duration_h ?? 0), 0) / sleeps.length;
        const avgQuality = sleeps.reduce((s, r) => s + (r.quality ?? 5), 0) / sleeps.length;
        // Ideal: 7-9h sleep, quality 8+
        const sleepScore = Math.min(100, (avgSleep / 8) * 50 + (avgQuality / 10) * 50);
        healthScore = Math.round(sleepScore);
      }
      if (workouts.length > 0) {
        healthScore = Math.round(
          healthScore * 0.6 + Math.min(100, (workouts.length / 4) * 100) * 0.4,
        );
      }

      dimensions.push({
        id: 'health',
        label: 'Saúde',
        score: healthScore,
        color: 'var(--color-mod-health)',
      });
    } catch {
      dimensions.push({ id: 'health', label: 'Saúde', score: 0, color: 'var(--color-mod-health)' });
    }

    // ── Finances score (budget adherence) ────────────────────────────────
    try {
      const month = now.toISOString().slice(0, 7);
      const { data: budgetData } = await db
        .from('finance_budget_vs_actual')
        .select('budgeted_amount, spent_amount')
        .eq('month', month)
        .limit(20);

      let financeScore = 70;
      if (budgetData && budgetData.length > 0) {
        const totalBudget = budgetData.reduce((s, r) => s + (r.budgeted_amount ?? 0), 0);
        const totalSpent = budgetData.reduce((s, r) => s + (r.spent_amount ?? 0), 0);
        if (totalBudget > 0) {
          const ratio = totalSpent / totalBudget;
          // Under budget = high score, over budget = low
          financeScore = Math.round(
            Math.max(0, Math.min(100, (1 - Math.max(0, ratio - 0.8)) * 100)),
          );
        }
      }

      dimensions.push({
        id: 'finances',
        label: 'Finanças',
        score: financeScore,
        color: 'var(--color-mod-finances)',
      });
    } catch {
      dimensions.push({
        id: 'finances',
        label: 'Finanças',
        score: 0,
        color: 'var(--color-mod-finances)',
      });
    }

    // ── Objectives score (task completion rate) ───────────────────────────
    try {
      const [completedData, totalData] = await Promise.all([
        db
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'done')
          .gte('updated_at', thirtyDaysAgo),
        db
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'in_progress', 'done'])
          .gte('created_at', thirtyDaysAgo),
      ]);

      const completed = completedData.count ?? 0;
      const total = totalData.count ?? 0;
      const objScore = total > 0 ? Math.round((completed / total) * 100) : 50;

      dimensions.push({
        id: 'objectives',
        label: 'Objetivos',
        score: objScore,
        color: 'var(--color-mod-objectives)',
      });
    } catch {
      dimensions.push({
        id: 'objectives',
        label: 'Objetivos',
        score: 0,
        color: 'var(--color-mod-objectives)',
      });
    }

    // ── Routine score (habit adherence) ──────────────────────────────────
    try {
      const { data: habitLogs } = await db
        .from('habit_logs')
        .select('completed')
        .gte('date', sevenDaysAgo);

      const logs = habitLogs ?? [];
      const routineScore =
        logs.length > 0
          ? Math.round((logs.filter((l) => l.completed).length / logs.length) * 100)
          : 50;

      dimensions.push({
        id: 'routine',
        label: 'Rotina',
        score: routineScore,
        color: 'var(--color-mod-routine)',
      });
    } catch {
      dimensions.push({
        id: 'routine',
        label: 'Rotina',
        score: 0,
        color: 'var(--color-mod-routine)',
      });
    }

    // ── People score (recent interactions) ───────────────────────────────
    try {
      const { data: interactions } = await db
        .from('interactions')
        .select('id')
        .gte('date', thirtyDaysAgo)
        .limit(20);

      const count = interactions?.length ?? 0;
      const peopleScore = Math.min(100, Math.round((count / 10) * 100));

      dimensions.push({
        id: 'people',
        label: 'Pessoas',
        score: peopleScore,
        color: 'var(--color-mod-people)',
      });
    } catch {
      dimensions.push({
        id: 'people',
        label: 'Pessoas',
        score: 0,
        color: 'var(--color-mod-people)',
      });
    }

    // ── Total score (weighted average) ──────────────────────────────────
    const weights = { health: 0.3, finances: 0.25, objectives: 0.2, routine: 0.15, people: 0.1 };
    const total = Math.round(
      dimensions.reduce(
        (sum, d) => sum + d.score * (weights[d.id as keyof typeof weights] ?? 0.2),
        0,
      ),
    );

    return {
      total,
      dimensions,
      updatedAt: now.toISOString(),
    };
  });
}
