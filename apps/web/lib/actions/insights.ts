'use server';

import { withTenant } from '@/lib/supabase/with-tenant';
import { db } from '@hawk/db';

export interface Insight {
  id: string;
  type: 'gap' | 'streak' | 'alert' | 'suggestion';
  module: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Scan all modules for gaps and surface proactive insights.
 * A "gap" is when expected activity hasn't happened recently.
 */
export async function fetchInsights(): Promise<Insight[]> {
  return withTenant(async () => {
    const insights: Insight[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    await Promise.allSettled([
      // ── Health: sleep gap ──────────────────────────────────────────────────
      (async () => {
        const { data } = await db
          .from('sleep_sessions')
          .select('date')
          .gte('date', threeDaysAgo)
          .limit(1);
        if (!data || data.length === 0) {
          insights.push({
            id: 'health-sleep-gap',
            type: 'gap',
            module: 'health',
            title: 'Sem registro de sono',
            description: 'Nenhum sono registrado nos últimos 3 dias. Registre para manter o histórico.',
            severity: 'warning',
            actionLabel: 'Registrar sono',
            actionHref: '/dashboard/health',
          });
        }
      })(),

      // ── Health: workout gap ────────────────────────────────────────────────
      (async () => {
        const { data } = await db
          .from('workout_sessions')
          .select('date')
          .gte('date', sevenDaysAgo)
          .limit(1);
        if (!data || data.length === 0) {
          insights.push({
            id: 'health-workout-gap',
            type: 'gap',
            module: 'health',
            title: 'Sem treino esta semana',
            description: 'Nenhum treino registrado esta semana.',
            severity: 'info',
            actionLabel: 'Ver saúde',
            actionHref: '/dashboard/health',
          });
        }
      })(),

      // ── Finances: no transactions this month ──────────────────────────────
      (async () => {
        const { count } = await db
          .from('finance_transactions')
          .select('id', { count: 'exact', head: true })
          .gte('date', `${monthStr}-01`);
        if ((count ?? 0) === 0) {
          insights.push({
            id: 'finances-no-transactions',
            type: 'gap',
            module: 'finances',
            title: 'Sem transações este mês',
            description: 'Nenhuma transação financeira registrada no mês atual.',
            severity: 'warning',
            actionLabel: 'Registrar transação',
            actionHref: '/dashboard/finances',
          });
        }
      })(),

      // ── Finances: over budget check ────────────────────────────────────────
      (async () => {
        const { data } = await db
          .from('finance_budget_vs_actual')
          .select('category_name, budgeted_amount, spent_amount')
          .eq('month', monthStr)
          .limit(20);
        if (data && data.length > 0) {
          const overBudget = data.filter(
            (r) => (r.spent_amount ?? 0) > (r.budgeted_amount ?? 0) * 1.1,
          );
          if (overBudget.length > 0) {
            insights.push({
              id: 'finances-over-budget',
              type: 'alert',
              module: 'finances',
              title: `${overBudget.length} categoria${overBudget.length > 1 ? 's' : ''} acima do orçamento`,
              description: overBudget.map((r) => r.category_name).join(', '),
              severity: overBudget.length >= 3 ? 'critical' : 'warning',
              actionLabel: 'Ver orçamento',
              actionHref: '/dashboard/finances',
            });
          }
        }
      })(),

      // ── Objectives: overdue tasks ──────────────────────────────────────────
      (async () => {
        const { count } = await db
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('due_date', todayStr);
        if ((count ?? 0) > 0) {
          insights.push({
            id: 'objectives-overdue',
            type: 'alert',
            module: 'objectives',
            title: `${count} tarefa${(count ?? 0) > 1 ? 's' : ''} atrasada${(count ?? 0) > 1 ? 's' : ''}`,
            description: 'Tarefas pendentes com prazo vencido.',
            severity: (count ?? 0) >= 5 ? 'critical' : 'warning',
            actionLabel: 'Ver objetivos',
            actionHref: '/dashboard/objectives',
          });
        }
      })(),

      // ── Routine: habit streak alert ────────────────────────────────────────
      (async () => {
        const { data } = await db
          .from('habit_logs')
          .select('habit_id, completed')
          .gte('date', sevenDaysAgo);
        if (data && data.length > 0) {
          const total = data.length;
          const completed = data.filter((l) => l.completed).length;
          const rate = completed / total;
          if (rate < 0.5) {
            insights.push({
              id: 'routine-low-adherence',
              type: 'alert',
              module: 'routine',
              title: 'Aderência baixa a hábitos',
              description: `${Math.round(rate * 100)}% dos hábitos completados esta semana.`,
              severity: rate < 0.3 ? 'critical' : 'warning',
              actionLabel: 'Ver rotina',
              actionHref: '/dashboard/routine',
            });
          }
        }
      })(),

      // ── People: no interactions this week ─────────────────────────────────
      (async () => {
        const { count } = await db
          .from('interactions')
          .select('id', { count: 'exact', head: true })
          .gte('date', sevenDaysAgo);
        if ((count ?? 0) === 0) {
          insights.push({
            id: 'people-no-interactions',
            type: 'suggestion',
            module: 'people',
            title: 'Sem interações registradas',
            description: 'Nenhuma interação com pessoas registrada esta semana.',
            severity: 'info',
            actionLabel: 'Ver pessoas',
            actionHref: '/dashboard/people',
          });
        }
      })(),
    ]);

    // Sort: critical first, then warning, then info
    const order = { critical: 0, warning: 1, info: 2 };
    return insights.sort((a, b) => order[a.severity] - order[b.severity]);
  });
}
