'use server';

import {
  createHobbyLog,
  createMedia,
  deleteHobbyLog,
  deleteMedia,
  getHobbyStats,
  listHobbyLogs,
  listMedia,
  updateMedia as updateMediaQuery,
  updateMediaStatus,
} from '@hawk/module-entertainment/queries';
import type { HobbyLog, MediaItem, MediaStatus } from '@hawk/module-entertainment/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchMedia(): Promise<MediaItem[]> {
  return withTenant(async () => listMedia());
}

export async function fetchHobbyLogs(): Promise<HobbyLog[]> {
  return withTenant(async () => listHobbyLogs(undefined, 10));
}

export async function fetchHobbyStats(): Promise<
  { activity: string; sessions: number; total_min: number }[]
> {
  return withTenant(async () => getHobbyStats());
}

export async function addMedia(input: { title: string; type: string }): Promise<MediaItem> {
  return withTenant(async () => createMedia(input as never));
}

export async function updateMedia(
  id: string,
  status: MediaStatus,
  rating?: number,
): Promise<MediaItem> {
  return withTenant(async () => updateMediaStatus(id, status, rating));
}

export async function addHobbyLog(input: {
  activity: string;
  duration_min?: number;
}): Promise<HobbyLog> {
  return withTenant(async () => createHobbyLog(input as never));
}

export async function editMedia(
  id: string,
  input: {
    title?: string;
    type?: string;
    status?: MediaStatus;
    platform?: string;
    genre?: string;
    rating?: number;
    notes?: string;
  },
): Promise<MediaItem> {
  return withTenant(async () => updateMediaQuery(id, input as never));
}

export async function removeMedia(id: string): Promise<void> {
  return withTenant(async () => deleteMedia(id));
}

export async function removeHobbyLog(id: string): Promise<void> {
  return withTenant(async () => deleteHobbyLog(id));
}
