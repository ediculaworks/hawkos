'use server';

import {
  completeHabit,
  createHabit,
  deleteHabit,
  getHabitsAtRisk,
  getWeekSummary,
  getWeeklyRoutineScore,
  listHabitsWithTodayStatus,
  logHabit,
  unlogHabit,
  updateHabit,
} from '@hawk/module-routine/queries';
import type {
  CreateHabitInput,
  Habit,
  HabitAtRisk,
  HabitWeekSummary,
  HabitWithLog,
  UpdateHabitInput,
} from '@hawk/module-routine/types';
import { withTenant } from '../supabase/with-tenant';

import { CreateHabitSchema, ToggleHabitSchema } from '../schemas';

export async function fetchHabitsToday(): Promise<HabitWithLog[]> {
  return withTenant(async () => listHabitsWithTodayStatus());
}

export async function toggleHabit(input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = ToggleHabitSchema.safeParse(input);
    if (!result.success)
      throw new Error(`toggleHabit: ${result.error.issues.map((e) => e.message).join('; ')}`);
    if (result.data.completed) {
      await logHabit({ habit_id: result.data.habitId, completed: true });
    } else {
      await unlogHabit(result.data.habitId);
    }
  });
}

export async function fetchWeekSummary(): Promise<HabitWeekSummary[]> {
  return withTenant(async () => getWeekSummary());
}

export async function addHabit(input: unknown): Promise<Habit> {
  return withTenant(async () => {
    const result = CreateHabitSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addHabit: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return createHabit(result.data as CreateHabitInput);
  });
}

export async function fetchHabitsAtRisk(): Promise<HabitAtRisk[]> {
  return withTenant(async () => getHabitsAtRisk());
}

export async function fetchWeeklyScore(): Promise<number> {
  return withTenant(async () => getWeeklyRoutineScore());
}

export async function completeHabitAction(
  habitId: string,
): Promise<{ action: string; streak: number }> {
  return withTenant(async () => completeHabit(habitId));
}

export async function editHabit(id: string, input: UpdateHabitInput): Promise<Habit> {
  return withTenant(async () => updateHabit(id, input));
}

export async function removeHabit(id: string): Promise<void> {
  return withTenant(async () => deleteHabit(id));
}
