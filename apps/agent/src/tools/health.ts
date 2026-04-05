import {
  addWorkoutSet,
  deleteWorkout,
  estimate1RM,
  getExerciseProgress,
  logSleep,
  logWeight,
  logWorkout,
} from '@hawk/module-health/queries';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const healthTools: Record<string, ToolDefinition> = {
  log_sleep: {
    name: 'log_sleep',
    modules: ['health'],
    description: 'Registra horas de sono',
    parameters: {
      type: 'object',
      properties: {
        duration_h: { type: 'number', description: 'Duração em horas' },
        quality: { type: 'number', description: 'Qualidade de 1-10 (opcional)' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['duration_h'],
    },
    schema: z.object({
      duration_h: z.number().min(0).max(24),
      quality: z.number().int().min(1).max(10).optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    handler: async (args: { duration_h: number; quality?: number; date?: string }) => {
      const sleep = await logSleep({
        duration_h: args.duration_h,
        quality: args.quality,
        date: args.date,
      });
      return `Sono registrado: ${sleep.duration_h}h`;
    },
  },

  log_workout: {
    name: 'log_workout',
    modules: ['health'],
    description: 'Registra um treino',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Tipo: musculacao, corrida, caminhada, etc' },
        duration_minutes: { type: 'number', description: 'Duração em minutos' },
        notes: { type: 'string', description: 'Notas sobre o treino' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['type'],
    },
    schema: z.object({
      type: z.string().min(1),
      duration_minutes: z.number().positive().optional(),
      notes: z.string().optional(),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    handler: async (args: {
      type: string;
      duration_minutes?: number;
      notes?: string;
      date?: string;
    }) => {
      const workout = await logWorkout({
        type: args.type as
          | 'musculacao'
          | 'corrida'
          | 'ciclismo'
          | 'natacao'
          | 'caminhada'
          | 'skate'
          | 'futebol'
          | 'outro',
        duration_m: args.duration_minutes,
        notes: args.notes,
        date: args.date,
      });
      return `Treino registrado: ${workout.type}`;
    },
  },

  delete_workout: {
    name: 'delete_workout',
    modules: ['health'],
    dangerous: true,
    description: 'Deleta uma sessão de treino por ID',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do treino a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteWorkout(args.id);
      return 'Treino deletado.';
    },
  },

  log_weight: {
    name: 'log_weight',
    modules: ['health'],
    description: 'Registra peso corporal',
    parameters: {
      type: 'object',
      properties: {
        weight_kg: { type: 'number', description: 'Peso em kg' },
        date: { type: 'string', description: 'Data (YYYY-MM-DD, opcional)' },
      },
      required: ['weight_kg'],
    },
    schema: z.object({
      weight_kg: z.number().positive().max(500),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
    handler: async (args: { weight_kg: number; date?: string }) => {
      const weight = await logWeight({
        weight_kg: args.weight_kg,
        measured_at: args.date,
      });
      return `Peso registrado: ${weight.weight_kg}kg`;
    },
  },

  log_workout_set: {
    name: 'log_workout_set',
    modules: ['health'],
    description: 'Registra uma série de exercício em um treino ativo',
    parameters: {
      type: 'object',
      properties: {
        workout_id: { type: 'string', description: 'ID da sessão de treino' },
        exercise_name: { type: 'string', description: 'Nome do exercício' },
        set_number: { type: 'number', description: 'Número da série' },
        reps: { type: 'number', description: 'Repetições' },
        weight_kg: { type: 'number', description: 'Peso em kg' },
        rpe: { type: 'number', description: 'RPE (percepção de esforço 1-10)' },
      },
      required: ['workout_id', 'exercise_name', 'set_number'],
    },
    schema: z.object({
      workout_id: z.string().uuid(),
      exercise_name: z.string().min(1),
      set_number: z.number().int().positive(),
      reps: z.number().int().positive().optional(),
      weight_kg: z.number().min(0).optional(),
      rpe: z.number().min(1).max(10).optional(),
    }),
    handler: async (args: {
      workout_id: string;
      exercise_name: string;
      set_number: number;
      reps?: number;
      weight_kg?: number;
      rpe?: number;
    }) => {
      const set = await addWorkoutSet(args);
      const e1rm =
        args.weight_kg && args.reps
          ? ` | 1RM estimado: ${estimate1RM(args.weight_kg, args.reps)}kg`
          : '';
      return `Série ${set.set_number} registrada: ${args.exercise_name} — ${args.reps ?? '?'} reps × ${args.weight_kg ?? '?'}kg${e1rm}`;
    },
  },

  get_exercise_history: {
    name: 'get_exercise_history',
    modules: ['health'],
    description: 'Histórico de progresso de um exercício com 1RM estimado ao longo do tempo',
    parameters: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Nome do exercício' },
        weeks: { type: 'number', description: 'Semanas a considerar (default 12)' },
      },
      required: ['exercise_name'],
    },
    schema: z.object({
      exercise_name: z.string().min(1),
      weeks: z.number().int().min(1).max(52).optional(),
    }),
    handler: async (args: { exercise_name: string; weeks?: number }) => {
      const history = await getExerciseProgress(args.exercise_name, args.weeks ?? 12);
      if (history.length === 0) return `Sem histórico para "${args.exercise_name}".`;
      const latest = history[history.length - 1];
      const first = history[0];
      const delta =
        latest && first
          ? (((latest.estimated_1rm - first.estimated_1rm) / first.estimated_1rm) * 100).toFixed(1)
          : '0';
      return [
        `**${args.exercise_name}** — ${history.length} sessões em ${args.weeks ?? 12} semanas`,
        `1RM: ${first?.estimated_1rm}kg → ${latest?.estimated_1rm}kg (${delta}%↑)`,
        ...history
          .slice(-5)
          .map(
            (h) => `  ${h.date}: ${h.best_weight_kg}kg × ${h.best_reps} = ${h.estimated_1rm}kg 1RM`,
          ),
      ].join('\n');
    },
  },
};
