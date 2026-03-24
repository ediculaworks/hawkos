/**
 * Analytical query tools — read-only tools for data analysis across modules.
 * These complement the write-oriented tools in each module file.
 */

import {
  getAccounts,
  getNetWorthHistory,
  listTransactionsWithCategory,
} from '@hawk/module-finances/queries';
import {
  getDailyHealthSummary,
  getWeekHealthStats,
  listRecentSleep,
} from '@hawk/module-health/queries';
import {
  listActiveTasks,
  listObjectivesByTimeframe,
  listOverdueTasks,
} from '@hawk/module-objectives/queries';
import { getDormantContacts, getNetworkStats } from '@hawk/module-people/queries';
import {
  getWeekSummary,
  getWeeklyRoutineScore,
  listHabitsWithTodayStatus,
} from '@hawk/module-routine/queries';

import type { ToolDefinition } from './types.js';

export const analyticsTools: Record<string, ToolDefinition> = {
  // ── Finances ──────────────────────────────────────────────────

  get_account_balances: {
    name: 'get_account_balances',
    modules: ['finances'],
    description: 'Mostra saldos atuais de todas as contas bancárias e carteiras',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const accounts = await getAccounts();
      if (accounts.length === 0) return 'Nenhuma conta cadastrada.';
      const total = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
      const lines = accounts.map(
        (a) => `• ${a.name} (${a.type}): R$ ${(a.balance ?? 0).toFixed(2)}`,
      );
      return [`**Contas** — Total: R$ ${total.toFixed(2)}`, ...lines].join('\n');
    },
  },

  get_spending_by_category: {
    name: 'get_spending_by_category',
    modules: ['finances'],
    description:
      'Lista transações de um período, opcionalmente filtradas por categoria. Útil para analisar gastos.',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Número de dias para trás (default: 30)',
        },
        category: {
          type: 'string',
          description: 'Filtrar por nome de categoria (opcional)',
        },
        type: {
          type: 'string',
          enum: ['expense', 'income'],
          description: 'Filtrar por tipo (opcional)',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de transações (default: 20)',
        },
      },
    },
    handler: async (args: {
      days?: number;
      category?: string;
      type?: 'expense' | 'income';
      limit?: number;
    }) => {
      const days = args.days ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const result = await listTransactionsWithCategory(
        undefined, // accountId
        since.toISOString().split('T')[0], // startDate
        undefined, // endDate
        undefined, // categoryId
        args.limit ?? 100,
      );

      const transactions = result.data ?? [];
      if (transactions.length === 0) return `Nenhuma transação nos últimos ${days} dias.`;

      // Filter by type if specified
      const filtered = args.type ? transactions.filter((t) => t.type === args.type) : transactions;

      // Group by category
      const byCategory = new Map<string, { total: number; count: number }>();
      for (const t of filtered) {
        const cat = t.category_name ?? 'Sem categoria';
        const existing = byCategory.get(cat) ?? { total: 0, count: 0 };
        existing.total += t.amount ?? 0;
        existing.count++;
        byCategory.set(cat, existing);
      }

      const sorted = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);
      const lines = sorted.map(
        ([cat, data]) => `• ${cat}: R$ ${data.total.toFixed(2)} (${data.count}x)`,
      );

      const total = sorted.reduce((s, [, d]) => s + d.total, 0);
      return [
        `**Transações (últimos ${days} dias)** — Total: R$ ${total.toFixed(2)}`,
        ...lines,
      ].join('\n');
    },
  },

  get_net_worth_trend: {
    name: 'get_net_worth_trend',
    modules: ['finances'],
    description: 'Histórico de patrimônio líquido (net worth) ao longo dos meses',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Número de meses (default: 6)' },
      },
    },
    handler: async (args: { months?: number }) => {
      const history = await getNetWorthHistory(args.months ?? 6);
      if (history.length === 0) return 'Nenhum snapshot de net worth encontrado.';
      const lines = history.map(
        (h: Record<string, unknown>) =>
          `• ${(h.snapshot_date as string)?.slice(0, 7)}: R$ ${((h.total_net_worth as number) ?? 0).toFixed(2)}`,
      );
      return ['**Evolução do Patrimônio**', ...lines].join('\n');
    },
  },

  // ── Routine ──────────────────────────────────────────────────

  get_today_habits: {
    name: 'get_today_habits',
    modules: ['routine'],
    description: 'Status de todos os hábitos de hoje (feitos e pendentes)',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const habits = await listHabitsWithTodayStatus();
      if (habits.length === 0) return 'Nenhum hábito cadastrado.';
      const done = habits.filter((h) => h.completed_today);
      const pending = habits.filter((h) => !h.completed_today);
      const lines = [
        `**Hábitos hoje** — ${done.length}/${habits.length} feitos`,
        ...done.map((h) => `✅ ${h.icon ?? ''}${h.name} (streak: ${h.current_streak})`),
        ...pending.map((h) => `⬜ ${h.icon ?? ''}${h.name} (streak: ${h.current_streak})`),
      ];
      return lines.join('\n');
    },
  },

  get_weekly_routine_score: {
    name: 'get_weekly_routine_score',
    modules: ['routine'],
    description: 'Score semanal de rotina com detalhamento por hábito',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const [score, summaries] = await Promise.all([getWeeklyRoutineScore(), getWeekSummary()]);
      const lines = [`**Score semanal de rotina: ${score}%**`];
      for (const s of summaries) {
        const pct = s.completion_rate;
        const icon = pct >= 100 ? '✅' : pct >= 70 ? '⚠️' : '❌';
        lines.push(
          `${icon} ${s.habit.icon ?? ''}${s.habit.name}: ${s.week_completions}/${s.week_target} (${pct}%)`,
        );
      }
      return lines.join('\n');
    },
  },

  // ── Health ──────────────────────────────────────────────────

  get_health_summary: {
    name: 'get_health_summary',
    modules: ['health'],
    description: 'Resumo de saúde do dia (sono, treinos, peso, humor)',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const summary = await getDailyHealthSummary();
      if (!summary) return 'Nenhum dado de saúde registrado hoje.';
      const lines = ['**Saúde hoje:**'];
      const s = summary as Record<string, unknown>;
      if (s.sleep_hours)
        lines.push(`😴 Sono: ${s.sleep_hours}h (qualidade: ${s.sleep_quality ?? '?'}/10)`);
      if (s.weight_kg) lines.push(`⚖️ Peso: ${s.weight_kg}kg`);
      if (s.workouts_count) lines.push(`💪 Treinos: ${s.workouts_count}`);
      if (s.mood) lines.push(`😊 Humor: ${s.mood}/10`);
      if (s.energy) lines.push(`⚡ Energia: ${s.energy}/10`);
      return lines.length > 1 ? lines.join('\n') : 'Nenhum dado de saúde registrado hoje.';
    },
  },

  get_health_trends: {
    name: 'get_health_trends',
    modules: ['health'],
    description: 'Tendências de saúde da última semana (sono, humor, exercício)',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const [weekStats, recentSleep] = await Promise.all([
        getWeekHealthStats(),
        listRecentSleep(7),
      ]);
      const lines = ['**Tendências de saúde (7 dias):**'];
      const w = weekStats as Record<string, unknown>;
      if (w.avg_sleep_hours) lines.push(`😴 Sono médio: ${Number(w.avg_sleep_hours).toFixed(1)}h`);
      if (w.avg_mood) lines.push(`😊 Humor médio: ${Number(w.avg_mood).toFixed(1)}/10`);
      if (w.avg_energy) lines.push(`⚡ Energia média: ${Number(w.avg_energy).toFixed(1)}/10`);
      if (w.workout_count) lines.push(`💪 Treinos: ${w.workout_count}`);
      if (w.avg_weight) lines.push(`⚖️ Peso médio: ${Number(w.avg_weight).toFixed(1)}kg`);

      if (recentSleep.length >= 2) {
        const avgRecent =
          recentSleep.reduce((s, r) => s + (r.duration_h ?? 0), 0) / recentSleep.length;
        lines.push(
          `💤 Média sono (últimas ${recentSleep.length} noites): ${avgRecent.toFixed(1)}h`,
        );
      }

      return lines.length > 1 ? lines.join('\n') : 'Nenhum dado de saúde na última semana.';
    },
  },

  // ── Objectives ──────────────────────────────────────────────

  get_active_objectives: {
    name: 'get_active_objectives',
    modules: ['objectives'],
    description: 'Lista objetivos ativos por timeframe (curto, médio, longo prazo) com progresso',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const byTimeframe = await listObjectivesByTimeframe();
      const lines = ['**Objetivos ativos:**'];

      for (const [tf, label] of [
        ['short', 'Curto prazo'],
        ['medium', 'Médio prazo'],
        ['long', 'Longo prazo'],
      ] as const) {
        const objs = byTimeframe[tf];
        if (objs.length > 0) {
          lines.push(`\n**${label}:**`);
          for (const o of objs) {
            const bar = `${'█'.repeat(Math.round(o.progress / 10))}${'░'.repeat(10 - Math.round(o.progress / 10))}`;
            lines.push(`• ${o.title} [${bar}] ${o.progress}% (P${o.priority})`);
          }
        }
      }

      return lines.length > 1 ? lines.join('\n') : 'Nenhum objetivo ativo.';
    },
  },

  get_overdue_tasks: {
    name: 'get_overdue_tasks',
    modules: ['objectives'],
    description: 'Lista tarefas atrasadas (vencidas)',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const overdue = await listOverdueTasks();
      if (overdue.length === 0) return '✅ Nenhuma tarefa atrasada!';
      const lines = [`**⚠️ ${overdue.length} tarefa(s) atrasada(s):**`];
      for (const t of overdue) {
        const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '';
        lines.push(`• ${t.title} (vencida em ${dueDate}, P${t.priority})`);
      }
      return lines.join('\n');
    },
  },

  get_active_tasks: {
    name: 'get_active_tasks',
    modules: ['objectives'],
    description: 'Lista tarefas ativas (pendentes e em progresso)',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const tasks = await listActiveTasks();
      if (tasks.length === 0) return 'Nenhuma tarefa ativa.';
      const lines = [`**Tarefas ativas (${tasks.length}):**`];
      for (const t of tasks) {
        const status = t.status === 'in_progress' ? '🔵' : '⚪';
        const due = t.due_date ? ` (até ${new Date(t.due_date).toLocaleDateString('pt-BR')})` : '';
        lines.push(`${status} ${t.title}${due} — P${t.priority}`);
      }
      return lines.join('\n');
    },
  },

  // ── People ──────────────────────────────────────────────────

  get_network_stats: {
    name: 'get_network_stats',
    modules: ['people'],
    description: 'Estatísticas do CRM: total de contatos, interações recentes, dormentes',
    parameters: { type: 'object', properties: {} },
    handler: async () => {
      const stats = await getNetworkStats();
      const s = stats as Record<string, unknown>;
      const lines = [
        '**Rede de contatos:**',
        `👥 Total: ${s.total_contacts ?? 0}`,
        `💬 Interações (30d): ${s.recent_interactions ?? 0}`,
        `😴 Dormentes: ${s.dormant_count ?? 0}`,
      ];
      return lines.join('\n');
    },
  },

  get_dormant_contacts: {
    name: 'get_dormant_contacts',
    modules: ['people'],
    description: 'Lista pessoas sem interação recente (contatos dormentes)',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Dias sem interação (default: 30)' },
        limit: { type: 'number', description: 'Máximo de resultados (default: 10)' },
      },
    },
    handler: async (args: { days?: number; limit?: number }) => {
      const dormant = await getDormantContacts(args.days ?? 30);
      const limited = dormant.slice(0, args.limit ?? 10);
      if (limited.length === 0) return '✅ Nenhum contato dormente!';
      const lines = [`**Contatos sem interação há ${args.days ?? 30}+ dias:**`];
      for (const p of limited) {
        const d = p as Record<string, unknown>;
        lines.push(`• ${d.name} — última interação: ${d.last_interaction_date ?? 'nunca'}`);
      }
      return lines.join('\n');
    },
  },
};
