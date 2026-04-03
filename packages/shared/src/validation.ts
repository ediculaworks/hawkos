import { z } from 'zod';
import { ValidationError } from './errors.ts';

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);
export const AccountTypeSchema = z.enum([
  'checking',
  'savings',
  'credit_card',
  'investment',
  'cash',
]);
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
export const HabitFrequencySchema = z.enum(['daily', 'weekly_2x', 'weekly_3x', 'weekdays']);
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
export const ConditionStatusSchema = z.enum(['active', 'managed', 'resolved', 'suspected']);
export const EventStatusSchema = z.enum(['confirmed', 'cancelled', 'tentative']);
export const PositiveNumberSchema = z.number().positive();
export const NonEmptyStringSchema = z.string().min(1);
export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const DateTimeStringSchema = z.string().datetime();
export const UUIDSchema = z.string().uuid();

export function parseCommand<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  interaction: { editReply: (msg: string) => Promise<unknown> },
  actionName: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((e: z.ZodIssue) => e.message).join('; ');
    interaction.editReply(`❌ ${actionName}: ${msg}`).catch(() => {
      /* ignore */
    });
    return null;
  }
  return result.data;
}

/**
 * Sanitize user-supplied strings to prevent XSS.
 * Escapes HTML entities: <, >, &, ", '
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip all HTML tags from a string (for plain-text contexts).
 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

export function validatedCommand<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  actionName: string,
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((e: z.ZodIssue) => e.message).join('; ');
    return { success: false, error: new ValidationError(`${actionName}: ${msg}`) };
  }
  return { success: true, data: result.data };
}
