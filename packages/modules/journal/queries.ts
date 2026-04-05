import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';
import type {
  CreateJournalEntryInput,
  JournalEntry,
  JournalEntryType,
  JournalStats,
  UpdateJournalEntryInput,
} from './types';

const logger = createLogger('journal');

const UpsertJournalEntrySchema = z.object({ content: z.string().min(1) });

/**
 * Criar ou atualizar entry do dia (upsert por date + type)
 */
export async function upsertJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const parsed = UpsertJournalEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
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
  const thisWeek = entries.filter((e: { date: string }) => e.date >= weekStr).length;
  const thisMonth = entries.filter((e: { date: string }) => e.date >= monthStr).length;

  const moodValues = entries
    .map((e: { mood: number | null }) => e.mood)
    .filter((m: number | null): m is number => m !== null);
  const energyValues = entries
    .map((e: { energy: number | null }) => e.energy)
    .filter((e: number | null): e is number => e !== null);

  const avgMood =
    moodValues.length > 0
      ? moodValues.reduce((a: number, b: number) => a + b, 0) / moodValues.length
      : null;
  const avgEnergy =
    energyValues.length > 0
      ? energyValues.reduce((a: number, b: number) => a + b, 0) / energyValues.length
      : null;

  // Calcular streak diário (dias consecutivos com pelo menos 1 entry)
  let streak = 0;
  const dateSets = new Set(entries.map((e: { date: string }) => e.date));
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

/**
 * Buscar entries por range de mood
 */
export async function searchEntriesByMood(
  minMood: number,
  maxMood: number,
  limit = 20,
): Promise<JournalEntry[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .gte('mood', minMood)
    .lte('mood', maxMood)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to search entries by mood');
    throw new HawkError(`Failed to search entries by mood: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Buscar entries por range de energia
 */
export async function searchEntriesByEnergy(
  minEnergy: number,
  maxEnergy: number,
  limit = 20,
): Promise<JournalEntry[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .gte('energy', minEnergy)
    .lte('energy', maxEnergy)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to search entries by energy');
    throw new HawkError(`Failed to search entries by energy: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Busca full-text no conteúdo das entries
 */
export async function searchEntries(query: string, limit = 20): Promise<JournalEntry[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .ilike('content', `%${query}%`)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to search entries');
    throw new HawkError(`Failed to search entries: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Exportar entries como array JSON num período
 */
export async function exportEntries(fromDate: string, toDate: string): Promise<JournalEntry[]> {
  const { data, error } = await db
    .from('journal_entries')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to export entries');
    throw new HawkError(`Failed to export entries: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as JournalEntry[];
}

/**
 * Estatísticas por período (semana/mês) — N períodos mais recentes
 */
export async function getJournalStatsByPeriod(
  period: 'week' | 'month',
  count = 4,
): Promise<
  { period: string; entries: number; avg_mood: number | null; avg_energy: number | null }[]
> {
  const now = new Date();
  const results = [];

  for (let i = 0; i < count; i++) {
    let fromDate: string;
    let toDate: string;
    let label: string;

    if (period === 'week') {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      fromDate = start.toISOString().split('T')[0] as string;
      toDate = end.toISOString().split('T')[0] as string;
      label = `Semana de ${fromDate}`;
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      fromDate = d.toISOString().split('T')[0] as string;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      toDate = last.toISOString().split('T')[0] as string;
      label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const { data, error } = await db
      .from('journal_entries')
      .select('mood, energy')
      .gte('date', fromDate)
      .lte('date', toDate);

    if (error) continue;

    const entries = data ?? [];
    const moods = entries
      .map((e: { mood: number | null }) => e.mood)
      .filter((v: number | null): v is number => v !== null);
    const energies = entries
      .map((e: { energy: number | null }) => e.energy)
      .filter((v: number | null): v is number => v !== null);

    results.push({
      period: label,
      entries: entries.length,
      avg_mood: moods.length
        ? Math.round((moods.reduce((a: number, b: number) => a + b, 0) / moods.length) * 10) / 10
        : null,
      avg_energy: energies.length
        ? Math.round((energies.reduce((a: number, b: number) => a + b, 0) / energies.length) * 10) /
          10
        : null,
    });
  }

  return results;
}

/**
 * Streak de escrita — dias consecutivos com entry até hoje
 */
export async function getWritingStreak(): Promise<{
  streak: number;
  last_entry_date: string | null;
}> {
  const { data, error } = await db
    .from('journal_entries')
    .select('date')
    .eq('type', 'daily')
    .order('date', { ascending: false })
    .limit(365);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get writing streak');
    throw new HawkError(`Failed to get writing streak: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const dates = [...new Set((data ?? []).map((e: { date: string }) => e.date))].sort().reverse();
  if (dates.length === 0) return { streak: 0, last_entry_date: null };

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0] as string;
    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return { streak, last_entry_date: dates[0] ?? null } as {
    streak: number;
    last_entry_date: string | null;
  };
}

/**
 * Mood trend — média semanal nas últimas N semanas
 */
export async function getMoodTrend(
  weeks = 8,
): Promise<{ week: string; avg_mood: number | null; avg_energy: number | null }[]> {
  return getJournalStatsByPeriod('week', weeks).then((stats) =>
    stats.map((s) => ({ week: s.period, avg_mood: s.avg_mood, avg_energy: s.avg_energy })),
  );
}

/**
 * Tags frequentes nas entries (campo JSONB tags[])
 */
export async function getFrequentTags(limit = 10): Promise<{ tag: string; count: number }[]> {
  const { data, error } = await db.from('journal_entries').select('tags');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get frequent tags');
    throw new HawkError(`Failed to get frequent tags: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const tag of (row.tags as string[]) ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
