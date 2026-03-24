// Types: Health / Saúde

// ─────────────────────────────────────────────
// Enums e literais
// ─────────────────────────────────────────────

export type ObservationCategory =
  | 'vital-signs'
  | 'activity'
  | 'laboratory'
  | 'survey'
  | 'substance';
export type DataSource =
  | 'manual'
  | 'garmin'
  | 'oura'
  | 'withings'
  | 'apple_health'
  | 'fitbit'
  | 'strava'
  | 'cronometer'
  | 'myfitnesspal'
  | 'import';
export type WorkoutType =
  | 'musculacao'
  | 'corrida'
  | 'ciclismo'
  | 'natacao'
  | 'caminhada'
  | 'skate'
  | 'futebol'
  | 'outro';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
export type SubstanceType = 'cannabis' | 'tobacco' | 'alcohol' | 'caffeine' | 'other';
export type SubstanceRoute = 'smoked' | 'oral' | 'vaporized' | 'insufflated' | 'other';
export type MedicationFrequency =
  | 'daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'as_needed'
  | 'weekly'
  | 'other';
export type ConditionStatus = 'active' | 'managed' | 'resolved' | 'suspected';
export type LabStatus = 'normal' | 'elevated' | 'low' | 'critical' | 'unknown';

// ─────────────────────────────────────────────
// Entidades do banco
// ─────────────────────────────────────────────

export type HealthObservation = {
  id: string;
  observed_at: string;
  code: string;
  display: string;
  category: ObservationCategory;
  value_number: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  unit: string | null;
  source: DataSource;
  external_id: string | null;
  raw_payload: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

export type SleepSession = {
  id: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  duration_h: number | null;
  quality: number | null;
  deep_pct: number | null;
  rem_pct: number | null;
  light_pct: number | null;
  interruptions: number;
  hr_avg: number | null;
  source: DataSource;
  external_id: string | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSession = {
  id: string;
  date: string;
  started_at: string | null;
  ended_at: string | null;
  type: WorkoutType;
  duration_m: number | null;
  calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  distance_km: number | null;
  source: DataSource;
  external_id: string | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_s: number | null;
  rpe: number | null;
  notes: string | null;
};

export type NutritionLog = {
  id: string;
  logged_at: string;
  meal_type: MealType | null;
  description: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  source: DataSource;
  notes: string | null;
  created_at: string;
};

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  source: DataSource;
  notes: string | null;
  created_at: string;
};

export type LabResult = {
  id: string;
  collected_at: string;
  name: string;
  value_number: number | null;
  value_text: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  status: LabStatus | null;
  lab_name: string | null;
  exam_type: string | null;
  notes: string | null;
  created_at: string;
};

export type SubstanceLog = {
  id: string;
  logged_at: string;
  substance: SubstanceType;
  quantity: number | null;
  unit: string | null;
  cost_brl: number | null;
  route: SubstanceRoute | null;
  context: string | null;
  notes: string | null;
  created_at: string;
};

export type Medication = {
  id: string;
  name: string;
  active_ingredient: string | null;
  dosage: string | null;
  frequency: MedicationFrequency;
  route: string;
  indication: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  prescriber: string | null;
  notes: string | null;
  created_at: string;
};

export type MedicationLog = {
  id: string;
  medication_id: string;
  scheduled_at: string;
  taken: boolean;
  taken_at: string | null;
  dose_actual: string | null;
  skipped_reason: string | null;
  notes: string | null;
  created_at: string;
};

export type Condition = {
  id: string;
  name: string;
  icd10_code: string | null;
  category: string | null;
  diagnosed_at: string | null;
  status: ConditionStatus;
  treating_professional: string | null;
  notes: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────
// Inputs para criação
// ─────────────────────────────────────────────

export type LogSleepInput = {
  date?: string;
  duration_h: number;
  quality?: number;
  sleep_start?: string;
  sleep_end?: string;
  notes?: string;
};

export type LogWorkoutInput = {
  date?: string;
  type: WorkoutType;
  duration_m?: number;
  notes?: string;
};

export type AddWorkoutSetInput = {
  workout_id: string;
  exercise_name: string;
  set_number: number;
  reps?: number;
  weight_kg?: number;
  rpe?: number;
  notes?: string;
};

export type LogWeightInput = {
  weight_kg: number;
  measured_at?: string;
  notes?: string;
};

export type LogSubstanceInput = {
  substance: SubstanceType;
  quantity?: number;
  unit?: string;
  cost_brl?: number;
  route?: SubstanceRoute;
  context?: string;
  notes?: string;
};

export type LogMealInput = {
  description: string;
  meal_type?: MealType;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  notes?: string;
};

export type AddLabResultInput = {
  name: string;
  collected_at?: string;
  value_number?: number;
  value_text?: string;
  unit?: string;
  reference_min?: number;
  reference_max?: number;
  lab_name?: string;
  notes?: string;
};

export type LogMedicationInput = {
  medication_id: string;
  taken?: boolean;
  skipped_reason?: string;
  notes?: string;
};

export type CreateMedicationInput = {
  name: string;
  dosage?: string;
  frequency: MedicationFrequency;
  indication?: string;
  start_date?: string;
  notes?: string;
};

// ─────────────────────────────────────────────
// Agregados e summaries
// ─────────────────────────────────────────────

export type DailyHealthSummary = {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  weight_kg: number | null;
  exercised: boolean;
  workout_type: string | null;
  workout_min: number | null;
  calories_total: number | null;
  cannabis_g: number | null;
  tobacco_qty: number | null;
  substance_cost: number | null;
  meds_taken: number;
  meds_skipped: number;
  mood: number | null;
  energy: number | null;
};

export type WeekHealthStats = {
  avg_sleep_h: number | null;
  avg_sleep_quality: number | null;
  workouts_count: number;
  avg_mood: number | null;
  avg_energy: number | null;
  cannabis_days: number;
  tobacco_days: number;
  med_adherence_pct: number | null;
  latest_weight: number | null;
};

// ─────────────────────────────────────────────
// Exercises & Workout Templates
// ─────────────────────────────────────────────

export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'perna'
  | 'ombro'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'cardio'
  | 'outro';

export type ExerciseType = 'compound' | 'isolation' | 'cardio';

export type Exercise = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  secondary_muscles: string[];
  equipment: string[];
  exercise_type: ExerciseType;
  instructions: string | null;
  video_url: string | null;
  is_custom: boolean;
  created_at: string;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  estimated_duration_m: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplateSet = {
  id: string;
  template_id: string;
  exercise_id: string;
  set_order: number;
  target_sets: number;
  target_reps: string;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string | null;
};

export type WorkoutTemplateWithSets = WorkoutTemplate & {
  sets: (WorkoutTemplateSet & { exercise: Exercise })[];
};

export type CreateExerciseInput = {
  name: string;
  muscle_group: MuscleGroup;
  secondary_muscles?: string[];
  equipment?: string[];
  exercise_type: ExerciseType;
  instructions?: string;
  video_url?: string;
};

export type CreateWorkoutTemplateInput = {
  name: string;
  description?: string;
  frequency?: string;
  estimated_duration_m?: number;
};

export type AddTemplateSetInput = {
  template_id: string;
  exercise_id: string;
  set_order?: number;
  target_sets?: number;
  target_reps: string;
  target_weight_kg?: number;
  rest_seconds?: number;
  notes?: string;
};
