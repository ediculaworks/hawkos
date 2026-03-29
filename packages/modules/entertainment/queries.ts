import { db } from '@hawk/db';
import { createLogger, HawkError, ValidationError } from '@hawk/shared';
import { z } from 'zod';
import type {
  CreateHobbyLogInput,
  CreateMediaInput,
  HobbyLog,
  MediaItem,
  MediaStatus,
  MediaType,
} from './types';

const logger = createLogger('entertainment');

const createMediaSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.enum(['movie', 'series', 'book', 'game', 'podcast', 'music']),
  status: z.enum(['want', 'in_progress', 'done', 'abandoned']).optional(),
  platform: z.string().max(100).optional(),
  genre: z.string().max(100).optional(),
});

export async function createMedia(input: CreateMediaInput): Promise<MediaItem> {
  const parsed = createMediaSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(`Invalid createMedia input: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  }
  const { data, error } = await db
    .from('media_items')
    .insert({
      title: input.title,
      type: input.type,
      status: input.status ?? 'want',
      platform: input.platform ?? null,
      genre: input.genre ?? null,
    })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create media');
    throw new HawkError(`Failed to create media: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as MediaItem;
}

export async function listMedia(type?: MediaType, status?: MediaStatus): Promise<MediaItem[]> {
  let query = db.from('media_items').select('*').order('created_at', { ascending: false });
  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list media');
    throw new HawkError(`Failed to list media: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as MediaItem[];
}

export async function updateMediaStatus(
  id: string,
  status: MediaStatus,
  rating?: number,
  notes?: string,
): Promise<MediaItem> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'watching') updates.started_at = new Date().toISOString().split('T')[0];
  if (status === 'completed') updates.finished_at = new Date().toISOString().split('T')[0];
  if (rating != null) updates.rating = rating;
  if (notes) updates.notes = notes;

  const { data, error } = await db
    .from('media_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update media');
    throw new HawkError(`Failed to update media: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as MediaItem;
}

export async function updateMedia(
  id: string,
  input: {
    title?: string;
    type?: MediaType;
    status?: MediaStatus;
    platform?: string;
    genre?: string;
    rating?: number;
    notes?: string;
  },
): Promise<MediaItem> {
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.type !== undefined) updates.type = input.type;
  if (input.status !== undefined) updates.status = input.status;
  if (input.platform !== undefined) updates.platform = input.platform;
  if (input.genre !== undefined) updates.genre = input.genre;
  if (input.rating !== undefined) updates.rating = input.rating;
  if (input.notes !== undefined) updates.notes = input.notes;

  const { data, error } = await db
    .from('media_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update media');
    throw new HawkError(`Failed to update media: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as MediaItem;
}

export async function deleteMedia(id: string): Promise<void> {
  const { error } = await db.from('media_items').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete media');
    throw new HawkError(`Failed to delete media: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function deleteHobbyLog(id: string): Promise<void> {
  const { error } = await db.from('hobby_logs').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete hobby log');
    throw new HawkError(`Failed to delete hobby log: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function findMediaByTitle(title: string): Promise<MediaItem | null> {
  const { data, error } = await db
    .from('media_items')
    .select('*')
    .ilike('title', `%${title}%`)
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.error({ error: error.message }, 'Failed to find media');
    throw new HawkError(`Failed to find media: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as MediaItem | null;
}

export async function createHobbyLog(input: CreateHobbyLogInput): Promise<HobbyLog> {
  const { data, error } = await db
    .from('hobby_logs')
    .insert({
      activity: input.activity,
      duration_min: input.duration_min ?? null,
      notes: input.notes ?? null,
      logged_at: input.logged_at ?? new Date().toISOString().split('T')[0],
    })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create hobby log');
    throw new HawkError(`Failed to create hobby log: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as HobbyLog;
}

export async function listHobbyLogs(activity?: string, limit = 10): Promise<HobbyLog[]> {
  let query = db
    .from('hobby_logs')
    .select('*')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (activity) query = query.ilike('activity', `%${activity}%`);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list hobby logs');
    throw new HawkError(`Failed to list hobby logs: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as HobbyLog[];
}

export async function getHobbyStats(): Promise<
  { activity: string; sessions: number; total_min: number }[]
> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await db
    .from('hobby_logs')
    .select('activity, duration_min')
    .gte('logged_at', thirtyDaysAgo.toISOString().split('T')[0]);
  if (error) {
    logger.error({ error: error.message }, 'Failed to get hobby stats');
    throw new HawkError(`Failed to get hobby stats: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const map = new Map<string, { sessions: number; total_min: number }>();
  for (const row of data ?? []) {
    const existing = map.get(row.activity) ?? { sessions: 0, total_min: 0 };
    map.set(row.activity, {
      sessions: existing.sessions + 1,
      total_min: existing.total_min + (row.duration_min ?? 0),
    });
  }

  return [...map.entries()]
    .map(([activity, stats]) => ({ activity, ...stats }))
    .sort((a, b) => b.sessions - a.sessions);
}
