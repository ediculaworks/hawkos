import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import type { CreateReflectionInput, PersonalValue, Reflection, ReflectionType } from './types';

const logger = createLogger('spirituality');

export type UnifiedTimelineEntry = {
  date: string;
  source: 'journal' | 'spirituality';
  id: string;
  type: string;
  content: string;
  mood: number | null;
  tags: string[];
  created_at: string;
};

export async function createReflection(input: CreateReflectionInput): Promise<Reflection> {
  const { data, error } = await db
    .from('reflections')
    .insert({
      type: input.type ?? 'reflection',
      content: input.content,
      mood: input.mood ?? null,
      tags: input.tags ?? [],
      logged_at: input.logged_at ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create reflection');
    throw new HawkError(`Failed to create reflection: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Reflection;
}

export async function listReflections(type?: ReflectionType, limit = 10): Promise<Reflection[]> {
  let query = db
    .from('reflections')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list reflections');
    throw new HawkError(`Failed to list reflections: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Reflection[];
}

export async function searchReflections(query: string, limit = 5): Promise<Reflection[]> {
  const { data, error } = await db
    .from('reflections')
    .select('*')
    .textSearch('search_vector', query, { type: 'plain', config: 'portuguese' })
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to search reflections');
    throw new HawkError(`Failed to search reflections: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Reflection[];
}

export async function getTodayReflections(): Promise<Reflection[]> {
  const today = new Date().toISOString().split('T')[0] ?? '';
  const { data, error } = await db
    .from('reflections')
    .select('*')
    .eq('logged_at', today)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get today reflections');
    throw new HawkError(`Failed to get today reflections: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Reflection[];
}

export async function listPersonalValues(): Promise<PersonalValue[]> {
  const { data, error } = await db
    .from('personal_values')
    .select('*')
    .order('priority', { ascending: false });
  if (error) {
    logger.error({ error: error.message }, 'Failed to list values');
    throw new HawkError(`Failed to list values: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as PersonalValue[];
}

export async function getWeeklyMoodAverage(): Promise<number | null> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await db
    .from('reflections')
    .select('mood')
    .not('mood', 'is', null)
    .gte('logged_at', sevenDaysAgo.toISOString().split('T')[0]);
  if (error) {
    logger.error({ error: error.message }, 'Failed to get mood average');
    throw new HawkError(`Failed to get mood average: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const moods = (data ?? [])
    .map((r: Record<string, unknown>) => r.mood as number)
    .filter((m: number) => m > 0);
  if (moods.length === 0) return null;
  return Math.round((moods.reduce((a: number, b: number) => a + b, 0) / moods.length) * 10) / 10;
}

export async function getCombinedMoodAverage(days = 7): Promise<number | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const [journalMoods, spiritMoods] = await Promise.all([
    db.from('journal_entries').select('mood').not('mood', 'is', null).gte('date', startStr),
    db.from('reflections').select('mood').not('mood', 'is', null).gte('logged_at', startStr),
  ]);

  const allMoods = [
    ...(journalMoods.data ?? []).map((e: Record<string, unknown>) => e.mood as number),
    ...(spiritMoods.data ?? []).map((r: Record<string, unknown>) => r.mood as number),
  ].filter((m) => m > 0);

  if (allMoods.length === 0) return null;
  return Math.round((allMoods.reduce((a, b) => a + b, 0) / allMoods.length) * 10) / 10;
}

export async function getUnifiedTimeline(days = 30): Promise<UnifiedTimelineEntry[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const [journalEntries, reflections] = await Promise.all([
    db
      .from('journal_entries')
      .select('id, date, type, content, mood, tags, created_at')
      .gte('date', startStr)
      .order('date', { ascending: false }),
    db
      .from('reflections')
      .select('id, logged_at, type, content, mood, tags, created_at')
      .gte('logged_at', startStr)
      .order('logged_at', { ascending: false }),
  ]);

  const unified: UnifiedTimelineEntry[] = [
    ...(journalEntries.data ?? []).map((e: Record<string, unknown>) => ({
      date: e.date,
      source: 'journal' as const,
      id: e.id,
      type: e.type,
      content: e.content,
      mood: e.mood,
      tags: e.tags ?? [],
      created_at: e.created_at ?? new Date().toISOString(),
    })),
    ...(reflections.data ?? []).map((r: Record<string, unknown>) => ({
      date: r.logged_at,
      source: 'spirituality' as const,
      id: r.id,
      type: r.type,
      content: r.content,
      mood: r.mood,
      tags: r.tags ?? [],
      created_at: r.created_at ?? new Date().toISOString(),
    })),
  ];

  return unified.sort((a, b) => b.date.localeCompare(a.date));
}

export type ObjectiveWithValue = {
  id: string;
  title: string;
  description: string | null;
  timeframe: string;
  status: string;
  progress: number;
  priority: number;
  tasks_count: number;
  open_tasks: number;
};

export async function getObjectivesByValue(valueName: string): Promise<ObjectiveWithValue[]> {
  const tagFilter = `#${valueName}`;

  const { data: objectives, error } = await db
    .from('objectives')
    .select('id, title, description, timeframe, status, progress, priority')
    .eq('status', 'active')
    .order('priority', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get objectives');
    throw new HawkError(`Failed to get objectives: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const { data: tasksWithTag } = await db
    .from('tasks')
    .select('objective_id, status')
    .contains('tags', [tagFilter]);

  const objectivesWithTag = new Set(
    (tasksWithTag ?? []).map((t: Record<string, unknown>) => t.objective_id),
  );

  const result: ObjectiveWithValue[] = [];
  for (const obj of objectives ?? []) {
    const hasTag = objectivesWithTag.has(obj.id);
    if (!hasTag && obj.id) {
      continue;
    }

    const tasksCount = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('objective_id', obj.id);

    const openTasks = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('objective_id', obj.id)
      .neq('status', 'done');

    result.push({
      id: obj.id,
      title: obj.title,
      description: obj.description,
      timeframe: obj.timeframe,
      status: obj.status,
      progress: obj.progress,
      priority: obj.priority,
      tasks_count: tasksCount.count ?? 0,
      open_tasks: openTasks.count ?? 0,
    });
  }

  return result;
}

export async function getAllValuesWithObjectives(): Promise<
  (PersonalValue & { objectives: ObjectiveWithValue[] })[]
> {
  const values = await listPersonalValues();
  const result: (PersonalValue & { objectives: ObjectiveWithValue[] })[] = [];

  for (const value of values) {
    const objectives = await getObjectivesByValue(value.name);
    result.push({ ...value, objectives });
  }

  return result;
}

export async function getSpiritualityStats(days = 30): Promise<{
  totalReflections: number;
  totalJournal: number;
  combinedMood: number | null;
  streak: number;
  byType: Record<string, number>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const [journalEntries, reflections, combinedMood] = await Promise.all([
    db
      .from('journal_entries')
      .select('date, mood')
      .gte('date', startStr)
      .order('date', { ascending: false }),
    db
      .from('reflections')
      .select('logged_at, type, mood')
      .gte('logged_at', startStr)
      .order('logged_at', { ascending: false }),
    getCombinedMoodAverage(days),
  ]);

  const byType: Record<string, number> = {};
  for (const r of reflections.data ?? []) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }

  // Calculate streak (consecutive days with either journal or reflection)
  const dateSet = new Set<string>();
  for (const e of journalEntries.data ?? []) {
    dateSet.add(e.date);
  }
  for (const r of reflections.data ?? []) {
    dateSet.add(r.logged_at);
  }

  let streak = 0;
  const today = new Date();
  while (dateSet.has(today.toISOString().split('T')[0] as string)) {
    streak++;
    today.setDate(today.getDate() - 1);
  }

  return {
    totalReflections: reflections.count ?? reflections.data?.length ?? 0,
    totalJournal: journalEntries.count ?? journalEntries.data?.length ?? 0,
    combinedMood,
    streak,
    byType,
  };
}
