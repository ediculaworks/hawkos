'use server';

import {
  type ObjectiveWithValue,
  type UnifiedTimelineEntry,
  createReflection,
  getAllValuesWithObjectives,
  getCombinedMoodAverage,
  getObjectivesByValue,
  getSpiritualityStats,
  getTodayReflections,
  getUnifiedTimeline,
  getWeeklyMoodAverage,
  listPersonalValues,
  listReflections,
} from '@hawk/module-spirituality/queries';
import type {
  CreateReflectionInput,
  PersonalValue,
  Reflection,
  ReflectionType,
} from '@hawk/module-spirituality/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchReflections(
  type?: ReflectionType,
  limit?: number,
): Promise<Reflection[]> {
  return withTenant(async () => listReflections(type, limit));
}

export async function fetchTodayReflections(): Promise<Reflection[]> {
  return withTenant(async () => getTodayReflections());
}

export async function fetchPersonalValues(): Promise<PersonalValue[]> {
  return withTenant(async () => listPersonalValues());
}

export async function fetchWeeklyMood(): Promise<number | null> {
  return withTenant(async () => getWeeklyMoodAverage());
}

export async function fetchCombinedMood(days = 7): Promise<number | null> {
  return withTenant(async () => getCombinedMoodAverage(days));
}

export async function fetchUnifiedTimeline(days = 30): Promise<UnifiedTimelineEntry[]> {
  return withTenant(async () => getUnifiedTimeline(days));
}

export async function fetchObjectivesByValue(valueName: string): Promise<ObjectiveWithValue[]> {
  return withTenant(async () => getObjectivesByValue(valueName));
}

export async function fetchAllValuesWithObjectives(): Promise<
  (PersonalValue & { objectives: ObjectiveWithValue[] })[]
> {
  return withTenant(async () => getAllValuesWithObjectives());
}

export async function fetchSpiritualityStats(days = 30): Promise<{
  totalReflections: number;
  totalJournal: number;
  combinedMood: number | null;
  streak: number;
  byType: Record<string, number>;
}> {
  return withTenant(async () => getSpiritualityStats(days));
}

export async function addReflection(input: CreateReflectionInput): Promise<Reflection> {
  return withTenant(async () => createReflection(input));
}
