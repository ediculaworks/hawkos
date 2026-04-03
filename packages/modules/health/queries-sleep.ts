import { db } from '@hawk/db';
import { DateStringSchema, HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type { LogSleepInput, SleepSession } from './types';

const logger = createLogger('health:sleep');

const LogSleepSchema = z.object({
  duration_h: z.number().min(0).max(24),
  quality: z.number().min(1).max(10).optional(),
  date: DateStringSchema,
});

// ─────────────────────────────────────────────
// Sono
// ─────────────────────────────────────────────

export async function logSleep(input: LogSleepInput): Promise<SleepSession> {
  const parsed = LogSleepSchema.safeParse({
    ...input,
    date: input.date ?? new Date().toISOString().split('T')[0],
  });
  if (!parsed.success) {
    logger.warn({ errors: parsed.error.flatten() }, 'Invalid sleep input');
    throw new ValidationError(
      `Invalid sleep: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to log sleep');
    throw new HawkError(`Failed to log sleep: ${error.message}`, 'DB_INSERT_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to get today sleep');
    throw new HawkError(`Failed to get today sleep: ${error.message}`, 'DB_QUERY_FAILED');
  }
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

  if (error) {
    logger.error({ error: error.message }, 'Failed to list sleep');
    throw new HawkError(`Failed to list sleep: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SleepSession[];
}

export async function deleteSleepSession(id: string): Promise<void> {
  const { error } = await db.from('sleep_sessions').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete sleep session');
    throw new HawkError(`Failed to delete sleep session: ${error.message}`, 'DB_DELETE_FAILED');
  }
}
