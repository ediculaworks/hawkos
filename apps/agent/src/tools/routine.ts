import {
  createHabit,
  findHabitByName,
  getHabitsAtRisk,
  logHabit,
} from '@hawk/module-routine/queries';
import { eventBus } from '@hawk/shared';

import type { ToolDefinition } from './types.js';

export const routineTools: Record<string, ToolDefinition> = {
  log_habit: {
    name: 'log_habit',
    modules: ['routine'],
    description: 'Registra a conclusão de um hábito',
    parameters: {
      type: 'object',
      properties: {
        habit_name: { type: 'string', description: 'Nome do hábito' },
        completed: { type: 'boolean', description: 'Se foi completado (default true)' },
      },
      required: ['habit_name'],
    },
    handler: async (args: { habit_name: string; completed?: boolean }) => {
      const habit = await findHabitByName(args.habit_name);
      if (!habit) return `Erro: Hábito "${args.habit_name}" não encontrado.`;

      await logHabit({
        habit_id: habit.id,
        completed: args.completed ?? true,
      });

      eventBus
        .emit('habit:logged', {
          habitId: habit.id,
          habitName: habit.name,
          streak: habit.current_streak ?? 0,
          completed: args.completed ?? true,
        })
        .catch(() => {});

      return `${habit.name}: ${args.completed === false ? 'não completado' : 'marcado como feito'}!`;
    },
  },

  create_habit: {
    name: 'create_habit',
    modules: ['routine'],
    description: 'Cria um novo hábito',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do hábito' },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly_2x', 'weekly_3x', 'weekdays'],
          description: 'Frequência',
        },
      },
      required: ['name', 'frequency'],
    },
    handler: async (args: {
      name: string;
      frequency: 'daily' | 'weekly_2x' | 'weekly_3x' | 'weekdays';
    }) => {
      const habit = await createHabit({
        name: args.name,
        frequency: args.frequency,
      });
      return `Hábito criado: ${habit.name} (${habit.frequency})`;
    },
  },

  get_habit_scores: {
    name: 'get_habit_scores',
    modules: ['routine'],
    description: 'Scores de consistência e hábitos com streak em risco hoje',
    parameters: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const atRisk = await getHabitsAtRisk();
      const lines: string[] = [];
      if (atRisk.length > 0) {
        lines.push(`**⚠️ Hábitos em risco (${atRisk.length}):**`);
        for (const h of atRisk) {
          lines.push(
            `• ${h.habit_name} — streak ${h.current_streak}d (último: ${h.last_completed_date})`,
          );
        }
      } else {
        lines.push('✅ Nenhum hábito em risco de quebrar hoje.');
      }
      return lines.join('\n');
    },
  },
};
