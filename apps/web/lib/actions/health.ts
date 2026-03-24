'use server';

import {
  addTemplateSet,
  createExercise,
  createWorkoutTemplate,
  deleteBodyMeasurement,
  deleteSleepSession,
  deleteSubstanceLog,
  deleteWorkout,
  deleteWorkoutTemplate,
  getDailyHealthSummary,
  getExerciseById,
  getLatestWeight,
  getMedicationAdherence,
  getSubstanceStats,
  getTodayNutrition,
  getTodaySleep,
  getTodayWorkouts,
  getWeekHealthStats,
  getWorkoutTemplateWithSets,
  listActiveMedications,
  listConditions,
  listExercises,
  listLabResults,
  listRecentSleep,
  listRecentSubstanceLogs,
  listRecentWorkouts,
  listWeightHistory,
  listWorkoutTemplates,
  logMeal,
  logMedicationTaken,
  logSleep,
  logSubstance,
  logWeight,
  logWorkout,
  removeTemplateSet,
  searchExercises,
  updateTemplateSet,
  updateWorkoutTemplate,
} from '@hawk/module-health/queries';
import { withTenant } from '../supabase/with-tenant';

import type {
  AddTemplateSetInput,
  BodyMeasurement,
  Condition,
  CreateExerciseInput,
  CreateWorkoutTemplateInput,
  DailyHealthSummary,
  Exercise,
  LabResult,
  Medication,
  NutritionLog,
  SleepSession,
  SubstanceLog,
  WeekHealthStats,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateWithSets,
} from '@hawk/module-health/types';

import {
  AddTemplateSetSchema,
  CreateExerciseSchema,
  CreateWorkoutTemplateSchema,
  LogMealSchema,
  LogMedicationSchema,
  LogSleepSchema,
  LogSubstanceSchema,
  LogWeightSchema,
  LogWorkoutSchema,
  SearchExercisesSchema,
  TakeMedicationSchema,
} from '../schemas';

export async function fetchDailySummary(): Promise<DailyHealthSummary | null> {
  return withTenant(async () => getDailyHealthSummary());
}

export async function fetchWeekStats(): Promise<WeekHealthStats> {
  return withTenant(async () => getWeekHealthStats());
}

export async function fetchTodaySleep(): Promise<SleepSession | null> {
  return withTenant(async () => getTodaySleep());
}

export async function fetchRecentSleep(days = 14): Promise<SleepSession[]> {
  return withTenant(async () => listRecentSleep(days));
}

export async function fetchTodayWorkouts(): Promise<WorkoutSession[]> {
  return withTenant(async () => getTodayWorkouts());
}

export async function fetchRecentWorkouts(limit = 20): Promise<WorkoutSession[]> {
  return withTenant(async () => listRecentWorkouts(limit));
}

export async function fetchLatestWeight(): Promise<BodyMeasurement | null> {
  return withTenant(async () => getLatestWeight());
}

export async function fetchWeightHistory(limit = 30): Promise<BodyMeasurement[]> {
  return withTenant(async () => listWeightHistory(limit));
}

export async function fetchActiveMedications(): Promise<Medication[]> {
  return withTenant(async () => listActiveMedications());
}

export async function fetchMedicationAdherence(): Promise<unknown> {
  return withTenant(async () => getMedicationAdherence());
}

export async function fetchConditions(): Promise<Condition[]> {
  return withTenant(async () => listConditions());
}

export async function fetchLabResults(limit = 10): Promise<LabResult[]> {
  return withTenant(async () => listLabResults(limit));
}

export async function fetchRecentSubstanceLogs(limit = 20): Promise<SubstanceLog[]> {
  return withTenant(async () => listRecentSubstanceLogs(limit));
}

export async function fetchSubstanceStats(days = 7): Promise<
  {
    substance: string;
    days_used: number;
    total_quantity: number | null;
    unit: string | null;
    total_cost: number | null;
  }[]
> {
  return withTenant(async () => getSubstanceStats(days));
}

export async function fetchTodayNutrition(): Promise<unknown> {
  return withTenant(async () => getTodayNutrition());
}

export async function addSleepLog(input: unknown): Promise<SleepSession> {
  return withTenant(async () => {
    const result = LogSleepSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addSleepLog: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return logSleep(result.data);
  });
}

export async function addWorkoutLog(input: unknown): Promise<WorkoutSession> {
  return withTenant(async () => {
    const result = LogWorkoutSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addWorkoutLog: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return logWorkout(result.data);
  });
}

export async function addWeightLog(input: unknown): Promise<BodyMeasurement> {
  return withTenant(async () => {
    const result = LogWeightSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addWeightLog: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return logWeight(result.data);
  });
}

export async function addSubstanceLog(input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = LogSubstanceSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addSubstanceLog: ${result.error.issues.map((e) => e.message).join('; ')}`);
    await logSubstance(result.data);
  });
}

export async function addMealLog(input: unknown): Promise<NutritionLog> {
  return withTenant(async () => {
    const result = LogMealSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addMealLog: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return logMeal(result.data);
  });
}

export async function takeMedication(input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = TakeMedicationSchema.safeParse(input);
    if (!result.success)
      throw new Error(`takeMedication: ${result.error.issues.map((e) => e.message).join('; ')}`);
    await logMedicationTaken({
      medication_id: result.data.medication_id,
      taken: result.data.taken,
    });
  });
}

export async function skipMedication(input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = LogMedicationSchema.safeParse(input);
    if (!result.success)
      throw new Error(`skipMedication: ${result.error.issues.map((e) => e.message).join('; ')}`);
    await logMedicationTaken({
      medication_id: result.data.medication_id,
      taken: false,
      skipped_reason: result.data.skipped_reason,
    });
  });
}

export async function fetchExercises(muscleGroup?: string): Promise<Exercise[]> {
  return withTenant(async () => listExercises(muscleGroup) as Promise<Exercise[]>);
}

export async function fetchExerciseById(id: string): Promise<Exercise | null> {
  return withTenant(async () => getExerciseById(id) as Promise<Exercise | null>);
}

export async function createNewExercise(input: unknown): Promise<Exercise> {
  return withTenant(async () => {
    const result = CreateExerciseSchema.safeParse(input);
    if (!result.success)
      throw new Error(`createNewExercise: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return createExercise(result.data as CreateExerciseInput) as Promise<Exercise>;
  });
}

export async function searchExercisesAction(
  query: string,
  muscleGroup?: string,
): Promise<Exercise[]> {
  return withTenant(async () => {
    const result = SearchExercisesSchema.safeParse({ query, muscleGroup });
    if (!result.success)
      throw new Error(
        `searchExercisesAction: ${result.error.issues.map((e) => e.message).join('; ')}`,
      );
    return searchExercises(result.data.query) as Promise<Exercise[]>;
  });
}

export async function fetchWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return withTenant(async () => listWorkoutTemplates() as Promise<WorkoutTemplate[]>);
}

export async function fetchWorkoutTemplateWithSets(
  id: string,
): Promise<WorkoutTemplateWithSets | null> {
  return withTenant(
    async () => getWorkoutTemplateWithSets(id) as Promise<WorkoutTemplateWithSets | null>,
  );
}

export async function createNewWorkoutTemplate(input: unknown): Promise<WorkoutTemplate> {
  return withTenant(async () => {
    const result = CreateWorkoutTemplateSchema.safeParse(input);
    if (!result.success)
      throw new Error(
        `createNewWorkoutTemplate: ${result.error.issues.map((e) => e.message).join('; ')}`,
      );
    return createWorkoutTemplate(
      result.data as CreateWorkoutTemplateInput,
    ) as Promise<WorkoutTemplate>;
  });
}

export async function updateExistingWorkoutTemplate(
  id: string,
  input: Partial<CreateWorkoutTemplateInput>,
): Promise<WorkoutTemplate> {
  return withTenant(async () => updateWorkoutTemplate(id, input) as Promise<WorkoutTemplate>);
}

export async function removeWorkout(id: string): Promise<void> {
  return withTenant(async () => deleteWorkout(id));
}

export async function removeSleepSession(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteSleepSession(id);
  });
}

export async function removeBodyMeasurement(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteBodyMeasurement(id);
  });
}

export async function removeSubstanceLog(id: string): Promise<void> {
  return withTenant(async () => {
    await deleteSubstanceLog(id);
  });
}

export async function removeWorkoutTemplate(id: string): Promise<void> {
  return withTenant(async () => deleteWorkoutTemplate(id));
}

export async function addExerciseToTemplate(input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = AddTemplateSetSchema.safeParse(input);
    if (!result.success)
      throw new Error(
        `addExerciseToTemplate: ${result.error.issues.map((e) => e.message).join('; ')}`,
      );
    await addTemplateSet(result.data as AddTemplateSetInput);
  });
}

export async function removeExerciseFromTemplate(setId: string): Promise<void> {
  return withTenant(async () => {
    await removeTemplateSet(setId);
  });
}

export async function updateExerciseInTemplate(setId: string, input: unknown): Promise<void> {
  return withTenant(async () => {
    const result = AddTemplateSetSchema.partial().safeParse(input);
    if (!result.success)
      throw new Error(
        `updateExerciseInTemplate: ${result.error.issues.map((e) => e.message).join('; ')}`,
      );
    await updateTemplateSet(setId, result.data);
  });
}

export async function fetchExerciseProgress(
  exerciseName: string,
  weeks = 12,
): Promise<{ date: string; best_weight_kg: number; best_reps: number; estimated_1rm: number }[]> {
  return withTenant(async () => {
    const { getExerciseProgress } = await import('@hawk/module-health/queries');
    return getExerciseProgress(exerciseName, weeks);
  });
}

export async function fetchPersonalRecords(): Promise<
  {
    exercise_name: string;
    best_weight_kg: number;
    best_reps: number;
    estimated_1rm: number;
    achieved_at: string;
  }[]
> {
  return withTenant(async () => {
    const { getPersonalRecords } = await import('@hawk/module-health/queries');
    return getPersonalRecords();
  });
}

export async function fetchWeeklyVolume(
  weeks = 8,
): Promise<{ week: string; total_volume_kg: number; session_count: number }[]> {
  return withTenant(async () => {
    const { getWeeklyVolume } = await import('@hawk/module-health/queries');
    return getWeeklyVolume(weeks);
  });
}
