import { db } from '@hawk/db';
import { createLogger, HawkError } from '@hawk/shared';
import type {
  CreateJournalEntryInput,
  JournalEntry,
  JournalEntryType,
  JournalStats,
  UpdateJournalEntryInput,
} from './types';

const logger = createLogger('journal');

/**
 * Criar ou atualizar entry do dia (upsert por date + type)
 */
export async function upsertJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const date = input.date ?? (new Date().toISOString().split('T')[0] as string);
  const type = input.type ?? 'daily';

  const { data, error } = await db
    .from('journal_entries')
    .upsert(
      {
        date,
        type,
        content: input.content,
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        tags: input.tags ?? [],
        metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
      },
      { onConflict: 'date,type' },
    )
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to upsert journal entry');
    throw new HawkError(`Failed to upsert journal entry: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as JournalEntry;
}

/**
 * Obter entry de hoje (tipo daily por padrão)
 */
export async function getTodayEntry(
  type: JournalEntryType = 'daily',
): Promise<JournalEntry | null> {
  const today = new Date().toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .eq('date', today)
    .eq('type', type)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get today entry');
    throw new HawkError(`Failed to get today entry: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as JournalEntry | null;
}

/**
 * Obter entry de uma data específica
 */
export async function getEntryByDate(
  date: string,
  type: JournalEntryType = 'daily',
): Promise<JournalEntry | null> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .eq('date', date)
    .eq('type', type)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get entry by date');
    throw new HawkError(`Failed to get entry by date: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as JournalEntry | null;
}

/**
 * Listar entries recentes
 */
export async function listRecentEntries(
  limit = 7,
  type?: JournalEntryType,
): Promise<JournalEntry[]> {
  let query = db
    .from('journal_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list entries');
    throw new HawkError(`Failed to list entries: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Listar entries por período
 */
export async function listEntriesByPeriod(
  startDate: string,
  endDate: string,
): Promise<JournalEntry[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list entries by period');
    throw new HawkError(`Failed to list entries by period: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Atualizar entry existente
 */
export async function updateJournalEntry(
  id: string,
  input: UpdateJournalEntryInput,
): Promise<JournalEntry> {
  const { data, error } = await db
    .from('journal_entries')
    .update({
      ...(input.content !== undefined && { content: input.content }),
      ...(input.mood !== undefined && { mood: input.mood }),
      ...(input.energy !== undefined && { energy: input.energy }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.metadata !== undefined && { metadata: JSON.parse(JSON.stringify(input.metadata)) }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update entry');
    throw new HawkError(`Failed to update entry: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as JournalEntry;
}

/**
 * Estatísticas do diário
 */
export async function getJournalStats(): Promise<JournalStats> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);

  const _todayStr = today.toISOString().split('T')[0] as string;
  const weekStr = weekAgo.toISOString().split('T')[0] as string;
  const monthStr = monthAgo.toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('journal_entries')
    .select('date, mood, energy')
    .order('date', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get stats');
    throw new HawkError(`Failed to get stats: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const entries = data ?? [];
  const total = entries.length;
  const thisWeek = entries.filter((e) => e.date >= weekStr).length;
  const thisMonth = entries.filter((e) => e.date >= monthStr).length;

  const moodValues = entries.map((e) => e.mood).filter((m): m is number => m !== null);
  const energyValues = entries.map((e) => e.energy).filter((e): e is number => e !== null);

  const avgMood =
    moodValues.length > 0 ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length : null;
  const avgEnergy =
    energyValues.length > 0 ? energyValues.reduce((a, b) => a + b, 0) / energyValues.length : null;

  // Calcular streak diário (dias consecutivos com pelo menos 1 entry)
  let streak = 0;
  const dateSets = new Set(entries.map((e) => e.date));
  const checkDate = new Date(today);
  while (dateSets.has(checkDate.toISOString().split('T')[0] as string)) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    total_entries: total,
    avg_mood: avgMood ? Math.round(avgMood * 10) / 10 : null,
    avg_energy: avgEnergy ? Math.round(avgEnergy * 10) / 10 : null,
    entries_this_week: thisWeek,
    entries_this_month: thisMonth,
    current_streak: streak,
  };
}
