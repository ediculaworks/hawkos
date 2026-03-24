// Context Engine: Routine / Hábitos
// L0: resumo compacto (streaks + completados hoje)
// L1: semana completa com completion rates
// L2: histórico detalhado por hábito

import { getWeekSummary, listHabitsWithTodayStatus } from './queries';

/**
 * L0 — Snapshot de hoje: hábitos completados e streaks ativos
 * Usado em todas as respostas do agente como contexto base
 */
export async function loadL0(): Promise<string> {
  try {
    const habits = await listHabitsWithTodayStatus();
    if (habits.length === 0) return 'Rotina: nenhum hábito ativo.';

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const completed = habits.filter((h) => h.completed_today);
    const pending = habits.filter((h) => !h.completed_today);

    const lines: string[] = [`Hábitos ${today}: ${completed.length}/${habits.length} feitos`];

    if (completed.length > 0) {
      lines.push(
        completed
          .map((h) => `✅ ${h.icon ?? ''}${h.name} (streak: ${h.current_streak})`)
          .join(', '),
      );
    }
    if (pending.length > 0) {
      lines.push(pending.map((h) => `⬜ ${h.icon ?? ''}${h.name}`).join(', '));
    }

    return lines.join('\n');
  } catch (_error) {
    return 'Rotina: indisponível';
  }
}

/**
 * L1 — Resumo semanal: completion rates dos últimos 7 dias
 */
export async function loadL1(): Promise<string> {
  try {
    const summaries = await getWeekSummary();
    if (summaries.length === 0) return 'Rotina: sem dados da semana.';

    const lines = summaries.map((s) => {
      const pct = s.completion_rate;
      const status = pct >= 100 ? '✅' : pct >= 70 ? '⚠️' : '❌';
      return `${status} ${s.habit.icon ?? ''}${s.habit.name}: ${s.week_completions}/${s.week_target} (${pct}%)`;
    });

    return `Hábitos — semana:\n${lines.join('\n')}`;
  } catch (_error) {
    return 'Rotina (semana): indisponível';
  }
}

/**
 * L2 — Detalhes completos: melhores streaks e histórico
 */
export async function loadL2(): Promise<string> {
  try {
    const habits = await listHabitsWithTodayStatus();
    if (habits.length === 0) return 'Rotina: nenhum hábito ativo.';

    const lines = habits.map((h) => {
      return [
        `${h.icon ?? '📌'} **${h.name}**`,
        `  Frequência: ${h.frequency}`,
        `  Streak atual: ${h.current_streak} | Melhor: ${h.best_streak} | Total: ${h.total_completions}`,
      ].join('\n');
    });

    return `Hábitos — detalhes:\n\n${lines.join('\n\n')}`;
  } catch (_error) {
    return 'Rotina (detalhes): indisponível';
  }
}
