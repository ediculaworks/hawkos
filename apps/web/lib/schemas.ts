import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);
export const AccountTypeSchema = z.enum([
  'checking',
  'savings',
  'credit_card',
  'investment',
  'cash',
]);
export const CategoryTypeSchema = z.enum(['income', 'expense', 'investment']);

export const CreateTransactionSchema = z.object({
  account_id: z.string().uuid('Conta inválida'),
  category_id: z.string().uuid('Categoria inválida'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  type: TransactionTypeSchema,
  description: z.string().max(500).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido')
    .optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  type: AccountTypeSchema,
  currency: z.string().length(3).default('BRL'),
  balance: z.number().default(0),
});

export const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: AccountTypeSchema.optional(),
  balance: z.number().optional(),
  enabled: z.boolean().optional(),
});

export const UpdateTransactionSchema = z.object({
  amount: z.number().min(0.01, 'Valor deve ser maior que zero').optional(),
  type: TransactionTypeSchema.optional(),
  description: z.string().max(500).optional(),
  category_id: z.string().uuid('Categoria inválida').optional(),
  account_id: z.string().uuid('Conta inválida').optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido')
    .optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const TransactionFilterSchema = z.object({
  accountId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const WorkoutTypeSchema = z.enum([
  'musculacao',
  'corrida',
  'ciclismo',
  'natacao',
  'caminhada',
  'skate',
  'futebol',
  'outro',
]);
export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']);
export const SubstanceTypeSchema = z.enum(['cannabis', 'tobacco', 'alcohol', 'caffeine', 'other']);
export const MedicationFrequencySchema = z.enum([
  'daily',
  'twice_daily',
  'three_times_daily',
  'as_needed',
  'weekly',
  'other',
]);

export const LogSleepSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  duration_h: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5).optional(),
  sleep_start: z.string().datetime({ message: 'Data/hora de início inválida' }).optional(),
  sleep_end: z.string().datetime({ message: 'Data/hora de fim inválida' }).optional(),
  notes: z.string().max(1000).optional(),
});

export const LogWorkoutSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: WorkoutTypeSchema,
  duration_m: z.number().int().min(1).max(480).optional(),
  notes: z.string().max(1000).optional(),
});

export const LogWeightSchema = z.object({
  weight_kg: z.number().min(20).max(300),
  measured_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(500).optional(),
});

export const LogSubstanceSchema = z.object({
  substance: SubstanceTypeSchema,
  quantity: z.number().min(0).optional(),
  unit: z.string().max(30).optional(),
  cost_brl: z.number().min(0).optional(),
  route: z.enum(['smoked', 'oral', 'vaporized', 'insufflated', 'other']).optional(),
  context: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const LogMealSchema = z.object({
  description: z.string().min(1).max(500),
  meal_type: MealTypeSchema.optional(),
  calories: z.number().int().min(0).optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const TakeMedicationSchema = z.object({
  medication_id: z.string().uuid('ID de medicação inválido'),
  taken: z.boolean().default(true),
  skipped_reason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const LogMedicationSchema = z.object({
  medication_id: z.string().uuid('ID de medicação inválido'),
  taken: z.boolean().optional(),
  skipped_reason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateMedicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: MedicationFrequencySchema,
  indication: z.string().max(500).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(500).optional(),
});

export const HabitFrequencySchema = z.enum(['daily', 'weekly_2x', 'weekly_3x', 'weekdays']);

export const CreateHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  frequency: HabitFrequencySchema,
  target_days: z.number().int().min(1).max(7).optional(),
  module: z.string().max(50).optional(),
  icon: z.string().max(10).optional(),
});

export const ToggleHabitSchema = z.object({
  habitId: z.string().uuid('ID de hábito inválido'),
  completed: z.boolean(),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  start_at: z.string().datetime({ message: 'Data/hora de início inválida' }),
  end_at: z.string().datetime({ message: 'Data/hora de fim inválida' }),
  all_day: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial()
  .omit({ start_at: true, end_at: true })
  .extend({
    end_at: z.string().datetime({ message: 'Data/hora de fim inválida' }).optional(),
  });

export const EventListSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
  upcomingOnly: z.boolean().optional(),
});

export const SearchExercisesSchema = z.object({
  query: z.string().min(1).max(200),
  muscleGroup: z.string().max(50).optional(),
});

export const MuscleGroupSchema = z.enum([
  'peito',
  'costas',
  'perna',
  'ombro',
  'biceps',
  'triceps',
  'core',
  'cardio',
  'outro',
]);
export const ExerciseTypeSchema = z.enum(['compound', 'isolation', 'cardio']);

export const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  muscle_group: MuscleGroupSchema,
  secondary_muscles: z.array(z.string().max(50)).max(5).optional(),
  equipment: z.array(z.string().max(50)).max(10).optional(),
  exercise_type: ExerciseTypeSchema,
  instructions: z.string().max(2000).optional(),
  video_url: z.string().url().optional().or(z.literal('')),
});

export const CreateWorkoutTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  frequency: z.string().max(50).optional(),
  estimated_duration_m: z.number().int().min(5).max(300).optional(),
});

export const AddTemplateSetSchema = z.object({
  template_id: z.string().uuid('ID de template inválido'),
  exercise_id: z.string().uuid('ID de exercício inválido'),
  set_order: z.number().int().min(1).optional(),
  target_sets: z.number().int().min(1).max(20).optional(),
  target_reps: z.string().min(1).max(20),
  target_weight_kg: z.number().min(0).optional(),
  rest_seconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(500).optional(),
});

export function validatedResult<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  actionName: string,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: `${actionName}: ${result.error.issues.map((e) => e.message).join('; ')}`,
    };
  }
  return { success: true, data: result.data };
}
