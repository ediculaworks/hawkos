import { db } from '@hawk/db';
import { HabitFrequencySchema, HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';

const logger = createLogger('routine');

const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  frequency: HabitFrequencySchema,
});
import type {
  CreateHabitInput,
  Habit,
  HabitAtRisk,
  HabitLog,
  HabitScore,
  HabitWeekSummary,
  HabitWithLog,
  LogHabitInput,
  UpdateHabitInput,
} from './types';

/**
 * Listar hábitos ativos com status de hoje
 */
export async function listHabitsWithTodayStatus(): Promise<HabitWithLog[]> {
  const today = new Date().toISOString().split('T')[0] as string;

  // Single query with LEFT JOIN via Supabase relational syntax
  const { data: habits, error } = await db
    .from('habits')
    .select(
      'id, name, description, frequency, icon, active, current_streak, best_streak, streak_freeze_count, created_at, habit_logs!left(id, completed, notes, date)',
    )
    .eq('active', true)
    .eq('habit_logs.date', today)
    .order('name');

  if (error) {
    logger.error({ error: error.message }, 'Failed to list habits');
    throw new HawkError(`Failed to list habits: ${error.message}`, 'DB_QUERY_FAILED');
  }

  return (habits ?? []).map((habit: Record<string, unknown>) => {
    const logs = habit.habit_logs as unknown as HabitLog[] | null;
    const log = logs?.[0] ?? null;
    return {
      ...(habit as unknown as Habit),
      completed_today: log?.completed ?? false,
      log_today: log,
    };
  });
}

/**
 * Obter um hábito pelo nome (busca parcial)
 */
export async function findHabitByName(name: string): Promise<Habit | null> {
  const { data, error } = await db
    .from('habits')
    .select(
      'id, name, description, frequency, icon, active, current_streak, best_streak, streak_freeze_count, created_at, updated_at',
    )
    .eq('active', true)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to find habit');
    throw new HawkError(`Failed to find habit: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Habit | null;
}

/**
 * Registrar completion de um hábito (upsert)
 */
export async function logHabit(input: LogHabitInput): Promise<HabitLog> {
  const date = input.date ?? (new Date().toISOString().split('T')[0] as string);

  const { data, error } = await db
    .from('habit_logs')
    .upsert(
      {
        habit_id: input.habit_id,
        date,
        completed: input.completed ?? true,
        notes: input.notes ?? null,
      },
      { onConflict: 'habit_id,date' },
    )
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to log habit');
    throw new HawkError(`Failed to log habit: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as HabitLog;
}

/**
 * Desmarcar hábito do dia (marcar como não completado)
 */
export async function unlogHabit(habitId: string, date?: string): Promise<void> {
  const targetDate = date ?? (new Date().toISOString().split('T')[0] as string);

  const { error } = await db
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, date: targetDate, completed: false },
      { onConflict: 'habit_id,date' },
    );

  if (error) {
    logger.error({ error: error.message }, 'Failed to unlog habit');
    throw new HawkError(`Failed to unlog habit: ${error.message}`, 'DB_UPDATE_FAILED');
  }
}

/**
 * Criar novo hábito
 */
export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const parsed = CreateHabitSchema.safeParse(input);
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten() }, 'Invalid habit input');
    throw new ValidationError(
      `Invalid habit: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('habits')
    .insert({
      name: input.name,
      description: input.description ?? null,
      frequency: input.frequency,
      target_days: input.target_days ?? null,
      module: input.module ?? null,
      icon: input.icon ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create habit');
    throw new HawkError(`Failed to create habit: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Habit;
}

/**
 * Atualizar um hábito
 */
export async function updateHabit(id: string, input: UpdateHabitInput): Promise<Habit> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.frequency !== undefined) updates.frequency = input.frequency;
  if (input.target_days !== undefined) updates.target_days = input.target_days;
  if (input.icon !== undefined) updates.icon = input.icon;

  const { data, error } = await db.from('habits').update(updates).eq('id', id).select().single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update habit');
    throw new HawkError(`Failed to update habit: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Habit;
}

/**
 * Desativar hábito (soft-delete)
 */
export async function deleteHabit(id: string): Promise<void> {
  const { error } = await db.from('habits').update({ active: false }).eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete habit');
    throw new HawkError(`Failed to delete habit: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Resumo semanal de hábitos (últimos 7 dias)
 */
export async function getWeekSummary(): Promise<HabitWeekSummary[]> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const startDate = weekAgo.toISOString().split('T')[0] as string;
  const endDate = today.toISOString().split('T')[0] as string;

  const { data: habits, error } = await db
    .from('habits')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    logger.error({ error: error.message }, 'Failed to get habits');
    throw new HawkError(`Failed to get habits: ${error.message}`, 'DB_QUERY_FAILED');
  }
  if (!habits || habits.length === 0) return [];

  const habitIds = habits.map((h: Record<string, unknown>) => h.id as string);

  const { data: logs, error: logError } = await db
    .from('habit_logs')
    .select('*')
    .in('habit_id', habitIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('completed', true);

  if (logError) {
    logger.error({ error: logError.message }, 'Failed to get week logs');
    throw new HawkError(`Failed to get week logs: ${logError.message}`, 'DB_QUERY_FAILED');
  }

  return habits.map((habit: Record<string, unknown>) => {
    const habitLogs = (logs ?? []).filter((l: Record<string, unknown>) => l.habit_id === habit.id);

    // Calcular target semanal baseado na frequência
    let weekTarget = 7;
    if (habit.frequency === 'weekly_3x') weekTarget = 3;
    else if (habit.frequency === 'weekly_2x') weekTarget = 2;
    else if (habit.frequency === 'weekdays') weekTarget = 5;

    const completionRate = Math.round((habitLogs.length / weekTarget) * 100);

    return {
      habit: habit as Habit,
      week_completions: habitLogs.length,
      week_target: weekTarget,
      completion_rate: Math.min(completionRate, 100),
      logs: habitLogs as HabitLog[],
    };
  });
}

/**
 * Logs de hábito por período
 */
export async function getHabitLogs(
  habitId: string,
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  const { data, error } = await db
    .from('habit_logs')
    .select('*')
    .eq('habit_id', habitId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get habit logs');
    throw new HawkError(`Failed to get habit logs: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as HabitLog[];
}

// ============================================================
// STREAK ENGINE (Habitica pattern)
// ============================================================

/**
 * Completar hábito — atualiza streak via função SQL
 */
export async function completeHabit(habitId: string): Promise<{ action: string; streak: number }> {
  // biome-ignore lint/suspicious/noExplicitAny: update_habit_streak RPC not in generated types
  const { data, error } = await (db as any).rpc('update_habit_streak', { p_habit_id: habitId });
  if (error) {
    logger.error({ error: error.message }, 'Failed to update streak');
    throw new HawkError(`Failed to update streak: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as { action: string; streak: number };
}

/**
 * Score 0-100 de um hábito baseado em 30 dias (via função SQL)
 */
export async function getHabitScore(habitId: string): Promise<HabitScore> {
  // biome-ignore lint/suspicious/noExplicitAny: get_habit_score RPC not in generated types
  const { data, error } = await (db as any).rpc('get_habit_score', { p_habit_id: habitId });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get habit score');
    throw new HawkError(`Failed to get habit score: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as HabitScore;
}

/**
 * Hábitos com streak em risco de quebrar hoje (via função SQL)
 */
export async function getHabitsAtRisk(): Promise<HabitAtRisk[]> {
  // biome-ignore lint/suspicious/noExplicitAny: get_habits_at_risk RPC not in generated types
  const { data, error } = await (db as any).rpc('get_habits_at_risk');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get habits at risk');
    throw new HawkError(`Failed to get habits at risk: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as HabitAtRisk[];
}

/**
 * Score geral semanal: média dos scores de todos os hábitos ativos.
 * Uses batch RPC if available, falls back to sequential with concurrency limit.
 */
export async function getWeeklyRoutineScore(): Promise<number> {
  const habits = await listHabitsWithTodayStatus();
  if (habits.length === 0) return 0;

  // Try batch RPC first
  // biome-ignore lint/suspicious/noExplicitAny: get_all_habit_scores RPC not in generated types
  const { data: batchScores, error: batchError } = await (db as any).rpc('get_all_habit_scores');
  if (!batchError && batchScores && Array.isArray(batchScores) && batchScores.length > 0) {
    const activeIds = new Set(habits.map((h) => h.id));
    const relevant = batchScores.filter((s: { habit_id: string }) => activeIds.has(s.habit_id));
    if (relevant.length > 0) {
      const avg =
        relevant.reduce((s: number, sc: { score: number }) => s + sc.score, 0) / relevant.length;
      return Math.round(avg);
    }
  }

  // Fallback: sequential (N+1 but capped)
  const scores = await Promise.all(habits.slice(0, 30).map((h) => getHabitScore(h.id)));
  const avg = scores.reduce((s, sc) => s + sc.score, 0) / scores.length;
  return Math.round(avg);
}

/**
 * Adicionar freeze ao streak de um hábito
 */
export async function addStreakFreeze(habitId: string, days = 1): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: update_habit_streak RPC not in generated types
  await (db as any).rpc('update_habit_streak', { p_habit_id: habitId }); // garante que está up-to-date

  // biome-ignore lint/suspicious/noExplicitAny: streak_freeze_count not in generated types
  const { data: habit } = await (db as any)
    .from('habits')
    .select('streak_freeze_count')
    .eq('id', habitId)
    .single();

  // biome-ignore lint/suspicious/noExplicitAny: streak_freeze_count not in generated types
  const current = ((habit as any)?.streak_freeze_count ?? 0) as number;

  // biome-ignore lint/suspicious/noExplicitAny: streak_freeze_count not in generated types
  await (db as any)
    .from('habits')
    .update({ streak_freeze_count: current + days })
    .eq('id', habitId)
    .throwOnError();
}
