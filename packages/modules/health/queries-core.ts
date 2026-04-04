import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type {
  AddLabResultInput,
  BodyMeasurement,
  Condition,
  CreateMedicationInput,
  DailyHealthSummary,
  LabResult,
  LogMealInput,
  LogMedicationInput,
  LogSubstanceInput,
  LogWeightInput,
  Medication,
  MedicationLog,
  NutritionLog,
  SubstanceLog,
  WeekHealthStats,
} from './types';

const logger = createLogger('health:core');

const LogObservationSchema = z.object({
  code: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});

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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log weight');
    throw new HawkError(`Failed to log weight: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get latest weight');
    throw new HawkError(`Failed to get latest weight: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list weight history');
    throw new HawkError(`Failed to list weight history: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as BodyMeasurement[];
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const { error } = await db.from('body_measurements').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete body measurement');
    throw new HawkError(`Failed to delete body measurement: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

// ─────────────────────────────────────────────
// Substâncias
// ─────────────────────────────────────────────

export async function logSubstance(input: LogSubstanceInput): Promise<SubstanceLog> {
  const parsed = LogObservationSchema.safeParse({
    code: input.substance,
    value: input.quantity ?? 0,
  });
  if (!parsed.success) {
    throw new ValidationError(`Invalid logSubstance input: ${parsed.error.message}`);
  }

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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log substance');
    throw new HawkError(`Failed to log substance: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as SubstanceLog;
}

export async function listRecentSubstanceLogs(limit = 20): Promise<SubstanceLog[]> {
  const { data, error } = await db
    .from('substance_logs')
    .select('context, cost_brl, created_at, id, logged_at, notes, quantity, route, substance, unit')
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list substance logs');
    throw new HawkError(`Failed to list substance logs: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get substance stats');
    throw new HawkError(`Failed to get substance stats: ${error.message}`, 'DB_QUERY_FAILED');
  }

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

export async function deleteSubstanceLog(id: string): Promise<void> {
  const { error } = await db.from('substance_logs').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete substance log');
    throw new HawkError(`Failed to delete substance log: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to add lab result');
    throw new HawkError(`Failed to add lab result: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list lab results');
    throw new HawkError(`Failed to list lab results: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get lab history');
    throw new HawkError(`Failed to get lab history: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to create medication');
    throw new HawkError(`Failed to create medication: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list medications');
    throw new HawkError(`Failed to list medications: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log medication');
    throw new HawkError(`Failed to log medication: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  return (meds ?? []).map((med: Record<string, unknown>) => {
    const medLogs = (logs ?? []).filter((l: Record<string, unknown>) => l.medication_id === med.id);
    const taken = medLogs.filter((l: Record<string, unknown>) => l.taken).length;
    const skipped = medLogs.filter((l: Record<string, unknown>) => !l.taken).length;
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list conditions');
    throw new HawkError(`Failed to list conditions: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Condition[];
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log meal');
    throw new HawkError(`Failed to log meal: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get today nutrition');
    throw new HawkError(`Failed to get today nutrition: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get daily summary');
    throw new HawkError(`Failed to get daily summary: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get week stats');
    throw new HawkError(`Failed to get week stats: ${error.message}`, 'DB_QUERY_FAILED');
  }

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
