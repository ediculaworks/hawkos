import { db } from '@hawk/db';
import { createLogger, HawkError } from '@hawk/shared';
import type {
  AddTemplateSetInput,
  AddWorkoutSetInput,
  CreateExerciseInput,
  CreateWorkoutTemplateInput,
  Exercise,
  LogWorkoutInput,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateSet,
  WorkoutTemplateWithSets,
} from './types';

const logger = createLogger('health:workout');

// ─────────────────────────────────────────────
// Treinos
// ─────────────────────────────────────────────

export async function logWorkout(input: LogWorkoutInput): Promise<WorkoutSession> {
  const date = input.date ?? (new Date().toISOString().split('T')[0] as string);

  const { data, error } = await db
    .from('workout_sessions')
    .insert({
      date,
      type: input.type,
      duration_m: input.duration_m ?? null,
      notes: input.notes ?? null,
      source: 'manual',
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to log workout');
    throw new HawkError(`Failed to log workout: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkoutSession;
}

export async function addWorkoutSet(input: AddWorkoutSetInput): Promise<WorkoutSet> {
  const { data, error } = await db
    .from('workout_sets')
    .insert({
      workout_id: input.workout_id,
      exercise_name: input.exercise_name,
      set_number: input.set_number,
      reps: input.reps ?? null,
      weight_kg: input.weight_kg ?? null,
      rpe: input.rpe ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to add workout set');
    throw new HawkError(`Failed to add workout set: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkoutSet;
}

export async function getTodayWorkouts(): Promise<WorkoutSession[]> {
  const today = new Date().toISOString().split('T')[0] as string;
  const { data, error } = await db
    .from('workout_sessions')
    .select(
      'id, date, type, duration_m, notes, source, created_at, avg_hr, calories, distance_km, ended_at, external_id, max_hr, raw_payload, started_at',
    )
    .eq('date', today)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get today workouts');
    throw new HawkError(`Failed to get today workouts: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as WorkoutSession[];
}

export async function getWorkoutWithSets(
  workoutId: string,
): Promise<WorkoutSession & { sets: WorkoutSet[] }> {
  const { data: workout, error: wErr } = await db
    .from('workout_sessions')
    .select(
      'id, date, type, duration_m, notes, source, created_at, avg_hr, calories, distance_km, ended_at, external_id, max_hr, raw_payload, started_at',
    )
    .eq('id', workoutId)
    .single();
  if (wErr) { logger.error({ error: wErr.message }, 'Failed to get workout'); throw new HawkError(`Failed to get workout: ${wErr.message}`, 'DB_QUERY_FAILED'); }

  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('duration_s, exercise_name, id, notes, reps, rpe, set_number, weight_kg, workout_id')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true });
  if (sErr) { logger.error({ error: sErr.message }, 'Failed to get workout sets'); throw new HawkError(`Failed to get workout sets: ${sErr.message}`, 'DB_QUERY_FAILED'); }

  return { ...(workout as WorkoutSession), sets: (sets ?? []) as WorkoutSet[] };
}

export async function listRecentWorkouts(limit = 10): Promise<WorkoutSession[]> {
  const { data, error } = await db
    .from('workout_sessions')
    .select(
      'avg_hr, calories, created_at, date, distance_km, duration_m, ended_at, external_id, id, max_hr, notes, raw_payload, source, started_at, type',
    )
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list workouts');
    throw new HawkError(`Failed to list workouts: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as WorkoutSession[];
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await db.from('workout_sessions').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete workout');
    throw new HawkError(`Failed to delete workout: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

// ============================================================
// EXERCISE ANALYTICS (wger pattern)
// ============================================================

/**
 * Fórmula de Epley para estimativa de 1RM
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * Progresso de um exercício: melhor série por sessão (últimas N semanas)
 */
export async function getExerciseProgress(
  exerciseName: string,
  weeks = 12,
): Promise<{ date: string; best_weight_kg: number; best_reps: number; estimated_1rm: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceDate = since.toISOString().split('T')[0] as string;

  const { data: sessions, error } = await db
    .from('workout_sessions')
    .select('id, date')
    .gte('date', sinceDate)
    .order('date', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get sessions');
    throw new HawkError(`Failed to get sessions: ${error.message}`, 'DB_QUERY_FAILED');
  }
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('workout_id, weight_kg, reps')
    .in('workout_id', sessionIds)
    .ilike('exercise_name', `%${exerciseName}%`)
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null);

  if (sErr) { logger.error({ error: sErr.message }, 'Failed to get sets'); throw new HawkError(`Failed to get sets: ${sErr.message}`, 'DB_QUERY_FAILED'); }

  const sessionMap = new Map(sessions.map((s) => [s.id, s.date]));
  const bySession = new Map<string, { weight: number; reps: number }>();

  for (const set of sets ?? []) {
    const date = sessionMap.get(set.workout_id);
    if (!date || set.weight_kg == null || set.reps == null) continue;
    const current = bySession.get(date);
    const e1rm = estimate1RM(set.weight_kg, set.reps);
    if (!current || e1rm > estimate1RM(current.weight, current.reps)) {
      bySession.set(date, { weight: set.weight_kg, reps: set.reps });
    }
  }

  return [...bySession.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { weight, reps }]) => ({
      date,
      best_weight_kg: weight,
      best_reps: reps,
      estimated_1rm: estimate1RM(weight, reps),
    }));
}

/**
 * Recordes pessoais: maior 1RM estimado por exercício
 */
export async function getPersonalRecords(): Promise<
  {
    exercise_name: string;
    best_weight_kg: number;
    best_reps: number;
    estimated_1rm: number;
    achieved_at: string;
  }[]
> {
  const { data: sets, error } = await db
    .from('workout_sets')
    .select('exercise_name, weight_kg, reps, workout_id, workout_sessions!inner(date)')
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null)
    .limit(5000);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get sets');
    throw new HawkError(`Failed to get sets: ${error.message}`, 'DB_UPDATE_FAILED');
  }

  const byExercise = new Map<string, { weight: number; reps: number; date: string }>();

  for (const set of sets ?? []) {
    if (set.weight_kg == null || set.reps == null) continue;
    const e1rm = estimate1RM(set.weight_kg, set.reps);
    // biome-ignore lint/suspicious/noExplicitAny: join result not in generated types
    const date = (set as any).workout_sessions?.date ?? '';
    const current = byExercise.get(set.exercise_name);
    if (!current || e1rm > estimate1RM(current.weight, current.reps)) {
      byExercise.set(set.exercise_name, { weight: set.weight_kg, reps: set.reps, date });
    }
  }

  return [...byExercise.entries()]
    .map(([name, { weight, reps, date }]) => ({
      exercise_name: name,
      best_weight_kg: weight,
      best_reps: reps,
      estimated_1rm: estimate1RM(weight, reps),
      achieved_at: date,
    }))
    .sort((a, b) => b.estimated_1rm - a.estimated_1rm);
}

/**
 * Volume semanal de treino: soma de (reps × peso) por semana
 */
export async function getWeeklyVolume(
  weeks = 8,
): Promise<{ week: string; total_volume_kg: number; session_count: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceDate = since.toISOString().split('T')[0] as string;

  const { data: sessions, error } = await db
    .from('workout_sessions')
    .select('id, date')
    .gte('date', sinceDate);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get sessions');
    throw new HawkError(`Failed to get sessions: ${error.message}`, 'DB_QUERY_FAILED');
  }
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('workout_id, reps, weight_kg')
    .in('workout_id', sessionIds);

  if (sErr) { logger.error({ error: sErr.message }, 'Failed to get sets'); throw new HawkError(`Failed to get sets: ${sErr.message}`, 'DB_QUERY_FAILED'); }

  const sessionMap = new Map(sessions.map((s) => [s.id, s.date]));
  const byWeek = new Map<string, { volume: number; sessions: Set<string> }>();

  for (const set of sets ?? []) {
    const date = sessionMap.get(set.workout_id);
    if (!date) continue;
    // ISO week string: YYYY-Www
    const d = new Date(date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const week = weekStart.toISOString().split('T')[0] as string;

    if (!byWeek.has(week)) byWeek.set(week, { volume: 0, sessions: new Set<string>() });
    const entry = byWeek.get(week);
    if (!entry) continue;
    entry.volume += (set.reps ?? 0) * (set.weight_kg ?? 0);
    entry.sessions.add(set.workout_id);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { volume, sessions }]) => ({
      week,
      total_volume_kg: Math.round(volume),
      session_count: sessions.size,
    }));
}

// ─────────────────────────────────────────────
// Exercises Library
// ─────────────────────────────────────────────

type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string[];
  exercise_type: string;
  instructions: string | null;
  video_url: string | null;
  is_custom: boolean;
  created_at: string;
};

export async function listExercises(muscleGroup?: string): Promise<ExerciseRow[]> {
  let query = db
    .from('exercises')
    .select(
      'id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, video_url, is_custom, created_at',
    )
    .order('name', { ascending: true });
  if (muscleGroup) query = query.eq('muscle_group', muscleGroup);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list exercises');
    throw new HawkError(`Failed to list exercises: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as ExerciseRow[];
}

export async function getExerciseById(id: string): Promise<ExerciseRow | null> {
  const { data, error } = await db
    .from('exercises')
    .select(
      'id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, video_url, is_custom, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.error({ error: error.message }, 'Failed to get exercise');
    throw new HawkError(`Failed to get exercise: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as ExerciseRow | null;
}

export async function createExercise(input: CreateExerciseInput): Promise<ExerciseRow> {
  const { data, error } = await db
    .from('exercises')
    .insert({
      name: input.name,
      muscle_group: input.muscle_group,
      secondary_muscles: input.secondary_muscles ?? [],
      equipment: input.equipment ?? [],
      exercise_type: input.exercise_type,
      instructions: input.instructions ?? null,
      video_url: input.video_url ?? null,
      is_custom: true,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create exercise');
    throw new HawkError(`Failed to create exercise: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Exercise;
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const { data, error } = await db
    .from('exercises')
    .select(
      'id, name, muscle_group, secondary_muscles, equipment, exercise_type, instructions, video_url, is_custom, created_at',
    )
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(20);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search exercises');
    throw new HawkError(`Failed to search exercises: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Exercise[];
}

// ─────────────────────────────────────────────
// Workout Templates
// ─────────────────────────────────────────────

export async function listWorkoutTemplates(includeInactive = false): Promise<WorkoutTemplate[]> {
  let query = db
    .from('workout_templates')
    .select(
      'id, name, description, frequency, estimated_duration_m, is_active, created_at, updated_at',
    )
    .order('name', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list workout templates');
    throw new HawkError(`Failed to list workout templates: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as WorkoutTemplate[];
}

export async function getWorkoutTemplateWithSets(
  id: string,
): Promise<WorkoutTemplateWithSets | null> {
  const { data: template, error: tErr } = await db
    .from('workout_templates')
    .select(
      'id, name, description, frequency, estimated_duration_m, is_active, created_at, updated_at',
    )
    .eq('id', id)
    .single();

  if (tErr) { logger.error({ error: tErr.message }, 'Failed to get template'); throw new HawkError(`Failed to get template: ${tErr.message}`, 'DB_QUERY_FAILED'); }

  const { data: sets, error: sErr } = await db
    .from('workout_template_sets')
    .select(
      'id, template_id, exercise_id, set_order, target_sets, target_reps, target_weight_kg, rest_seconds, notes',
    )
    .eq('template_id', id)
    .order('set_order', { ascending: true });

  if (sErr) { logger.error({ error: sErr.message }, 'Failed to get template sets'); throw new HawkError(`Failed to get template sets: ${sErr.message}`, 'DB_QUERY_FAILED'); }

  const setsWithExercises = await Promise.all(
    (sets ?? []).map(async (set) => {
      const exercise = await getExerciseById(set.exercise_id);
      if (!exercise) return { ...set, exercise: null };
      return { ...set, exercise };
    }),
  );

  return { ...(template as WorkoutTemplate), sets: setsWithExercises } as WorkoutTemplateWithSets;
}

export async function createWorkoutTemplate(
  input: CreateWorkoutTemplateInput,
): Promise<WorkoutTemplate> {
  const { data, error } = await db
    .from('workout_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      frequency: input.frequency ?? null,
      estimated_duration_m: input.estimated_duration_m ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create workout template');
    throw new HawkError(`Failed to create workout template: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkoutTemplate;
}

export async function updateWorkoutTemplate(
  id: string,
  input: Partial<CreateWorkoutTemplateInput>,
): Promise<WorkoutTemplate> {
  const { data, error } = await db
    .from('workout_templates')
    .update({
      name: input.name,
      description: input.description,
      frequency: input.frequency,
      estimated_duration_m: input.estimated_duration_m,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update workout template');
    throw new HawkError(`Failed to update workout template: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as WorkoutTemplate;
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const { error } = await db.from('workout_templates').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete workout template');
    throw new HawkError(`Failed to delete workout template: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function addTemplateSet(input: AddTemplateSetInput): Promise<WorkoutTemplateSet> {
  const { data, error } = await db
    .from('workout_template_sets')
    .insert({
      template_id: input.template_id,
      exercise_id: input.exercise_id,
      set_order: input.set_order ?? 1,
      target_sets: input.target_sets ?? 3,
      target_reps: input.target_reps,
      target_weight_kg: input.target_weight_kg ?? null,
      rest_seconds: input.rest_seconds ?? 90,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to add template set');
    throw new HawkError(`Failed to add template set: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkoutTemplateSet;
}

export async function removeTemplateSet(id: string): Promise<void> {
  const { error } = await db.from('workout_template_sets').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to remove template set');
    throw new HawkError(`Failed to remove template set: ${error.message}`, 'DB_UPDATE_FAILED');
  }
}

export async function updateTemplateSet(
  id: string,
  input: Partial<AddTemplateSetInput>,
): Promise<WorkoutTemplateSet> {
  const { data, error } = await db
    .from('workout_template_sets')
    .update({
      exercise_id: input.exercise_id,
      set_order: input.set_order,
      target_sets: input.target_sets,
      target_reps: input.target_reps,
      target_weight_kg: input.target_weight_kg,
      rest_seconds: input.rest_seconds,
      notes: input.notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update template set');
    throw new HawkError(`Failed to update template set: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as WorkoutTemplateSet;
}
