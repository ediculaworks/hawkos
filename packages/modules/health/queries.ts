import { db } from '@hawk/db';
import type {
  AddLabResultInput,
  AddTemplateSetInput,
  AddWorkoutSetInput,
  BodyMeasurement,
  Condition,
  CreateExerciseInput,
  CreateMedicationInput,
  CreateWorkoutTemplateInput,
  DailyHealthSummary,
  Exercise,
  LabResult,
  LogMealInput,
  LogMedicationInput,
  LogSleepInput,
  LogSubstanceInput,
  LogWeightInput,
  LogWorkoutInput,
  Medication,
  MedicationLog,
  NutritionLog,
  SleepSession,
  SubstanceLog,
  WeekHealthStats,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateSet,
  WorkoutTemplateWithSets,
} from './types';

// ─────────────────────────────────────────────
// Sono
// ─────────────────────────────────────────────

export async function logSleep(input: LogSleepInput): Promise<SleepSession> {
  const date = input.date ?? (new Date().toISOString().split('T')[0] as string);

  const { data, error } = await db
    .from('sleep_sessions')
    .upsert(
      {
        date,
        duration_h: input.duration_h,
        quality: input.quality ?? null,
        sleep_start: input.sleep_start ?? null,
        sleep_end: input.sleep_end ?? null,
        notes: input.notes ?? null,
        source: 'manual',
      },
      { onConflict: 'date,source' },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to log sleep: ${error.message}`);
  return data as SleepSession;
}

export async function getTodaySleep(): Promise<SleepSession | null> {
  const today = new Date().toISOString().split('T')[0] as string as string;
  const { data, error } = await db
    .from('sleep_sessions')
    .select(
      'id, date, duration_h, quality, sleep_start, sleep_end, notes, source, created_at, deep_pct, external_id, hr_avg, interruptions, light_pct, raw_payload, rem_pct',
    )
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to get today sleep: ${error.message}`);
  return data as SleepSession | null;
}

export async function listRecentSleep(days = 7): Promise<SleepSession[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('sleep_sessions')
    .select(
      'id, date, duration_h, quality, sleep_start, sleep_end, notes, source, created_at, deep_pct, external_id, hr_avg, interruptions, light_pct, raw_payload, rem_pct',
    )
    .gte('date', sinceStr)
    .order('date', { ascending: false });

  if (error) throw new Error(`Failed to list sleep: ${error.message}`);
  return (data ?? []) as SleepSession[];
}

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

  if (error) throw new Error(`Failed to log workout: ${error.message}`);
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

  if (error) throw new Error(`Failed to add workout set: ${error.message}`);
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

  if (error) throw new Error(`Failed to get today workouts: ${error.message}`);
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
  if (wErr) throw new Error(`Failed to get workout: ${wErr.message}`);

  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('duration_s, exercise_name, id, notes, reps, rpe, set_number, weight_kg, workout_id')
    .eq('workout_id', workoutId)
    .order('set_number', { ascending: true });
  if (sErr) throw new Error(`Failed to get workout sets: ${sErr.message}`);

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

  if (error) throw new Error(`Failed to list workouts: ${error.message}`);
  return (data ?? []) as WorkoutSession[];
}

// ─────────────────────────────────────────────
// Corpo / Peso
// ─────────────────────────────────────────────

export async function logWeight(input: LogWeightInput): Promise<BodyMeasurement> {
  const { data, error } = await db
    .from('body_measurements')
    .insert({
      weight_kg: input.weight_kg,
      measured_at: input.measured_at ?? new Date().toISOString(),
      notes: input.notes ?? null,
      source: 'manual',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log weight: ${error.message}`);
  return data as BodyMeasurement;
}

export async function getLatestWeight(): Promise<BodyMeasurement | null> {
  const { data, error } = await db
    .from('body_measurements')
    .select(
      'body_fat_pct, chest_cm, created_at, external_id, height_cm, hip_cm, id, measured_at, muscle_mass_kg, notes, raw_payload, source, waist_cm, weight_kg',
    )
    .not('weight_kg', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to get latest weight: ${error.message}`);
  return data as BodyMeasurement | null;
}

export async function listWeightHistory(limit = 30): Promise<BodyMeasurement[]> {
  const { data, error } = await db
    .from('body_measurements')
    .select(
      'body_fat_pct, chest_cm, created_at, external_id, height_cm, hip_cm, id, measured_at, muscle_mass_kg, notes, raw_payload, source, waist_cm, weight_kg',
    )
    .not('weight_kg', 'is', null)
    .order('measured_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list weight history: ${error.message}`);
  return (data ?? []) as BodyMeasurement[];
}

// ─────────────────────────────────────────────
// Substâncias
// ─────────────────────────────────────────────

export async function logSubstance(input: LogSubstanceInput): Promise<SubstanceLog> {
  const { data, error } = await db
    .from('substance_logs')
    .insert({
      substance: input.substance,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      cost_brl: input.cost_brl ?? null,
      route: input.route ?? null,
      context: input.context ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log substance: ${error.message}`);
  return data as SubstanceLog;
}

export async function listRecentSubstanceLogs(limit = 20): Promise<SubstanceLog[]> {
  const { data, error } = await db
    .from('substance_logs')
    .select('context, cost_brl, created_at, id, logged_at, notes, quantity, route, substance, unit')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list substance logs: ${error.message}`);
  return (data ?? []) as SubstanceLog[];
}

export async function getSubstanceStats(days = 7): Promise<
  {
    substance: string;
    days_used: number;
    total_quantity: number | null;
    total_cost: number | null;
    unit: string | null;
  }[]
> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString();

  const { data, error } = await db
    .from('substance_logs')
    .select('substance, quantity, cost_brl, unit, logged_at')
    .gte('logged_at', sinceStr)
    .order('logged_at', { ascending: false });

  if (error) throw new Error(`Failed to get substance stats: ${error.message}`);

  const grouped = new Map<
    string,
    { days: Set<string>; qty: number; cost: number; unit: string | null }
  >();

  for (const row of data ?? []) {
    const day = row.logged_at.split('T')[0] as string;
    if (!grouped.has(row.substance)) {
      grouped.set(row.substance, { days: new Set<string>(), qty: 0, cost: 0, unit: row.unit });
    }
    const entry = grouped.get(row.substance);
    if (!entry) continue;
    entry.days.add(day);
    entry.qty += row.quantity ?? 0;
    entry.cost += row.cost_brl ?? 0;
  }

  return Array.from(grouped.entries()).map(([substance, s]) => ({
    substance,
    days_used: s.days.size,
    total_quantity: s.qty > 0 ? Math.round(s.qty * 100) / 100 : null,
    total_cost: s.cost > 0 ? Math.round(s.cost * 100) / 100 : null,
    unit: s.unit,
  }));
}

// ─────────────────────────────────────────────
// Exames
// ─────────────────────────────────────────────

export async function addLabResult(input: AddLabResultInput): Promise<LabResult> {
  const collected_at = input.collected_at ?? (new Date().toISOString().split('T')[0] as string);

  let status: string | null = null;
  if (
    input.value_number !== undefined &&
    input.reference_min !== undefined &&
    input.reference_max !== undefined
  ) {
    if (input.value_number < input.reference_min) status = 'low';
    else if (input.value_number > input.reference_max) status = 'elevated';
    else status = 'normal';
  }

  const { data, error } = await db
    .from('lab_results')
    .insert({
      name: input.name,
      collected_at,
      value_number: input.value_number ?? null,
      value_text: input.value_text ?? null,
      unit: input.unit ?? null,
      reference_min: input.reference_min ?? null,
      reference_max: input.reference_max ?? null,
      status,
      lab_name: input.lab_name ?? null,
      notes: input.notes ?? null,
      exam_type: 'blood',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add lab result: ${error.message}`);
  return data as LabResult;
}

export async function listLabResults(limit = 20): Promise<LabResult[]> {
  const { data, error } = await db
    .from('lab_results')
    .select(
      'collected_at, created_at, exam_type, id, lab_name, name, notes, reference_max, reference_min, status, unit, value_number, value_text',
    )
    .order('collected_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list lab results: ${error.message}`);
  return (data ?? []) as LabResult[];
}

export async function getLabHistory(name: string): Promise<LabResult[]> {
  const { data, error } = await db
    .from('lab_results')
    .select(
      'id, name, value_number, value_text, unit, status, reference_min, reference_max, collected_at, lab_name, exam_type, notes, created_at',
    )
    .ilike('name', `%${name}%`)
    .order('collected_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Failed to get lab history: ${error.message}`);
  return (data ?? []) as LabResult[];
}

// ─────────────────────────────────────────────
// Medicamentos
// ─────────────────────────────────────────────

export async function createMedication(input: CreateMedicationInput): Promise<Medication> {
  const { data, error } = await db
    .from('medications')
    .insert({
      name: input.name,
      dosage: input.dosage ?? null,
      frequency: input.frequency,
      indication: input.indication ?? null,
      start_date: input.start_date ?? (new Date().toISOString().split('T')[0] as string),
      active: true,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create medication: ${error.message}`);
  return data as Medication;
}

export async function listActiveMedications(): Promise<Medication[]> {
  const { data, error } = await db
    .from('medications')
    .select(
      'id, name, dosage, frequency, route, active_ingredient, indication, prescriber, start_date, end_date, active, notes, created_at',
    )
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to list medications: ${error.message}`);
  return (data ?? []) as Medication[];
}

export async function logMedicationTaken(input: LogMedicationInput): Promise<MedicationLog> {
  const { data, error } = await db
    .from('medication_logs')
    .insert({
      medication_id: input.medication_id,
      taken: input.taken ?? true,
      taken_at: input.taken !== false ? new Date().toISOString() : null,
      skipped_reason: input.skipped_reason ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log medication: ${error.message}`);
  return data as MedicationLog;
}

export async function getMedicationAdherence(days = 30): Promise<
  {
    medication: Medication;
    taken: number;
    skipped: number;
    adherence_pct: number;
  }[]
> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString();

  const [{ data: meds }, { data: logs }] = await Promise.all([
    db.from('medications').select('id, name, dosage, frequency, active').eq('active', true),
    db
      .from('medication_logs')
      .select(
        'id, medication_id, taken, taken_at, scheduled_at, skipped_reason, dose_actual, notes, created_at',
      )
      .gte('scheduled_at', sinceStr),
  ]);

  return (meds ?? []).map((med) => {
    const medLogs = (logs ?? []).filter((l) => l.medication_id === med.id);
    const taken = medLogs.filter((l) => l.taken).length;
    const skipped = medLogs.filter((l) => !l.taken).length;
    const total = taken + skipped;
    return {
      medication: med as Medication,
      taken,
      skipped,
      adherence_pct: total > 0 ? Math.round((taken / total) * 100) : 100,
    };
  });
}

// ─────────────────────────────────────────────
// Condições
// ─────────────────────────────────────────────

export async function listConditions(): Promise<Condition[]> {
  const { data, error } = await db
    .from('conditions')
    .select(
      'id, name, status, category, diagnosed_at, icd10_code, treating_professional, notes, created_at',
    )
    .order('status', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`Failed to list conditions: ${error.message}`);
  return (data ?? []) as Condition[];
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

  if (error) throw new Error(`Failed to get sessions: ${error.message}`);
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('workout_id, weight_kg, reps')
    .in('workout_id', sessionIds)
    .ilike('exercise_name', `%${exerciseName}%`)
    .not('weight_kg', 'is', null)
    .not('reps', 'is', null);

  if (sErr) throw new Error(`Failed to get sets: ${sErr.message}`);

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

  if (error) throw new Error(`Failed to get sets: ${error.message}`);

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

  if (error) throw new Error(`Failed to get sessions: ${error.message}`);
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: sets, error: sErr } = await db
    .from('workout_sets')
    .select('workout_id, reps, weight_kg')
    .in('workout_id', sessionIds);

  if (sErr) throw new Error(`Failed to get sets: ${sErr.message}`);

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
// Nutrição
// ─────────────────────────────────────────────

export async function logMeal(input: LogMealInput): Promise<NutritionLog> {
  const { data, error } = await db
    .from('nutrition_logs')
    .insert({
      description: input.description,
      meal_type: input.meal_type ?? null,
      calories: input.calories ?? null,
      protein_g: input.protein_g ?? null,
      carbs_g: input.carbs_g ?? null,
      fat_g: input.fat_g ?? null,
      notes: input.notes ?? null,
      source: 'manual',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to log meal: ${error.message}`);
  return data as NutritionLog;
}

export async function getTodayNutrition(): Promise<{
  meals: NutritionLog[];
  total_calories: number;
}> {
  const today = new Date().toISOString().split('T')[0] as string;
  const { data, error } = await db
    .from('nutrition_logs')
    .select(
      'id, description, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, logged_at, notes, source, created_at',
    )
    .gte('logged_at', `${today}T00:00:00`)
    .lte('logged_at', `${today}T23:59:59`)
    .order('logged_at', { ascending: true });

  if (error) throw new Error(`Failed to get today nutrition: ${error.message}`);
  const meals = (data ?? []) as NutritionLog[];
  const total_calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  return { meals, total_calories };
}

// ─────────────────────────────────────────────
// Summaries
// ─────────────────────────────────────────────

export async function getDailyHealthSummary(date?: string): Promise<DailyHealthSummary | null> {
  const targetDate = date ?? (new Date().toISOString().split('T')[0] as string);
  const { data, error } = await db
    .from('daily_health_summary')
    .select(
      'date, sleep_hours, sleep_quality, mood, energy, exercised, workout_type, workout_min, weight_kg, cannabis_g, tobacco_qty, substance_cost, calories_total, meds_taken, meds_skipped',
    )
    .eq('date', targetDate)
    .maybeSingle();

  if (error) throw new Error(`Failed to get daily summary: ${error.message}`);
  return data as DailyHealthSummary | null;
}

export async function getWeekHealthStats(): Promise<WeekHealthStats> {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceStr = since.toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('daily_health_summary')
    .select(
      'date, sleep_hours, sleep_quality, mood, energy, exercised, workout_type, workout_min, weight_kg, cannabis_g, tobacco_qty, substance_cost, calories_total, meds_taken, meds_skipped',
    )
    .gte('date', sinceStr)
    .order('date', { ascending: false });

  if (error) throw new Error(`Failed to get week stats: ${error.message}`);

  const rows = (data ?? []) as DailyHealthSummary[];

  const sleepRows = rows.filter((r) => r.sleep_hours !== null);
  const sleepQualityRows = rows.filter((r) => r.sleep_quality !== null);
  const moodRows = rows.filter((r) => r.mood !== null);
  const energyRows = rows.filter((r) => r.energy !== null);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  const totalMedsTaken = rows.reduce((s, r) => s + (r.meds_taken ?? 0), 0);
  const totalMedsSkipped = rows.reduce((s, r) => s + (r.meds_skipped ?? 0), 0);
  const totalMeds = totalMedsTaken + totalMedsSkipped;

  const latestWeight = rows.find((r) => r.weight_kg !== null)?.weight_kg ?? null;

  return {
    avg_sleep_h: avg(sleepRows.map((r) => r.sleep_hours as number)),
    avg_sleep_quality: avg(sleepQualityRows.map((r) => r.sleep_quality as number)),
    workouts_count: rows.filter((r) => r.exercised).length,
    avg_mood: avg(moodRows.map((r) => r.mood as number)),
    avg_energy: avg(energyRows.map((r) => r.energy as number)),
    cannabis_days: rows.filter((r) => r.cannabis_g && r.cannabis_g > 0).length,
    tobacco_days: rows.filter((r) => r.tobacco_qty && r.tobacco_qty > 0).length,
    med_adherence_pct: totalMeds > 0 ? Math.round((totalMedsTaken / totalMeds) * 100) : null,
    latest_weight: latestWeight,
  };
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
  if (error) throw new Error(`Failed to list exercises: ${error.message}`);
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
  if (error) throw new Error(`Failed to get exercise: ${error.message}`);
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

  if (error) throw new Error(`Failed to create exercise: ${error.message}`);
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

  if (error) throw new Error(`Failed to search exercises: ${error.message}`);
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
  if (error) throw new Error(`Failed to list workout templates: ${error.message}`);
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

  if (tErr) throw new Error(`Failed to get template: ${tErr.message}`);

  const { data: sets, error: sErr } = await db
    .from('workout_template_sets')
    .select(
      'id, template_id, exercise_id, set_order, target_sets, target_reps, target_weight_kg, rest_seconds, notes',
    )
    .eq('template_id', id)
    .order('set_order', { ascending: true });

  if (sErr) throw new Error(`Failed to get template sets: ${sErr.message}`);

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

  if (error) throw new Error(`Failed to create workout template: ${error.message}`);
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

  if (error) throw new Error(`Failed to update workout template: ${error.message}`);
  return data as WorkoutTemplate;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await db.from('workout_sessions').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete workout: ${error.message}`);
}

export async function deleteSleepSession(id: string): Promise<void> {
  const { error } = await db.from('sleep_sessions').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete sleep session: ${error.message}`);
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const { error } = await db.from('body_measurements').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete body measurement: ${error.message}`);
}

export async function deleteSubstanceLog(id: string): Promise<void> {
  const { error } = await db.from('substance_logs').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete substance log: ${error.message}`);
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const { error } = await db.from('workout_templates').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete workout template: ${error.message}`);
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

  if (error) throw new Error(`Failed to add template set: ${error.message}`);
  return data as WorkoutTemplateSet;
}

export async function removeTemplateSet(id: string): Promise<void> {
  const { error } = await db.from('workout_template_sets').delete().eq('id', id);
  if (error) throw new Error(`Failed to remove template set: ${error.message}`);
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

  if (error) throw new Error(`Failed to update template set: ${error.message}`);
  return data as WorkoutTemplateSet;
}
