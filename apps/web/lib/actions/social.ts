'use server';

import { db } from '@hawk/db';
import {
  createPost,
  getPostStats,
  getPostsWithContext,
  getSocialStats,
  linkPostToEntity,
  listGoals,
  listPosts,
  listPostsByStatus,
  publishPost,
  updatePostStatus,
} from '@hawk/module-social/queries';
import type {
  CreatePostInput,
  LinkPostInput,
  PostStatus,
  SocialGoal,
  SocialPlatform,
  SocialPost,
  SocialPostWithContext,
  UpdatePostStatusInput,
} from '@hawk/module-social/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchPosts(
  platform?: SocialPlatform,
  status?: PostStatus,
): Promise<SocialPost[]> {
  return withTenant(async () => listPosts(platform, status));
}

export async function fetchPostsWithContext(
  platform?: SocialPlatform,
  status?: PostStatus,
  objectiveId?: string,
): Promise<SocialPostWithContext[]> {
  return withTenant(async () => getPostsWithContext(platform, status, objectiveId));
}

export async function fetchPostsByStatus(): Promise<{
  idea: SocialPostWithContext[];
  draft: SocialPostWithContext[];
  scheduled: SocialPostWithContext[];
  published: SocialPostWithContext[];
}> {
  return withTenant(async () => listPostsByStatus());
}

export async function fetchGoals(): Promise<SocialGoal[]> {
  return withTenant(async () => listGoals());
}

export async function fetchPostStats(): Promise<
  { platform: string; ideas: number; drafts: number; published: number }[]
> {
  return withTenant(async () => getPostStats());
}

export async function fetchSocialStats(): Promise<{
  totalPublished: number;
  totalPending: number;
  currentStreak: number;
  byPlatform: { platform: string; count: number }[];
}> {
  return withTenant(async () => getSocialStats());
}

// Cross-module queries live here (server actions are the orchestration layer)

export type CurrentContext = {
  mood: number | null;
  energy: number | null;
  activeMedia: { id: string; title: string; type: string; status: string } | null;
  activeObjectives: { id: string; title: string; progress: number }[];
  upcomingEvents: { id: string; title: string; date: string }[];
  recentInteractions: { id: string; personName: string; date: string }[];
};

export async function fetchCurrentContext(): Promise<CurrentContext> {
  return withTenant(async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );

    const [journalEntry, media, objectives, events, interactions] = await Promise.all([
      db
        .from('journal_entries')
        .select('mood, energy')
        .eq('date', today)
        .eq('type', 'daily')
        .single(),
      db
        .from('media_items')
        .select('id, title, type, status')
        .in('status', ['watching', 'reading', 'playing'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .single(),
      db
        .from('objectives')
        .select('id, title, progress')
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .limit(5),
      db
        .from('calendar_events')
        .select('id, title, start_at')
        .gte('start_at', today)
        .order('start_at', { ascending: true })
        .limit(3),
      db
        .from('interactions')
        .select('id, person_id, date')
        .order('date', { ascending: false })
        .limit(5),
    ]);

    let recentInteractions: { id: string; personName: string; date: string }[] = [];
    if (interactions.data && interactions.data.length > 0) {
      const personIds = [
        ...new Set(interactions.data.map((i) => i.person_id).filter(Boolean)),
      ] as string[];
      if (personIds.length > 0) {
        const { data: people } = await db
          .from('people')
          .select('id, name')
          .in('id', personIds.slice(0, 5));
        const personMap = new Map(people?.map((p) => [p.id, p.name]) ?? []);
        recentInteractions = interactions.data
          .filter((i) => i.person_id)
          .map((i) => ({
            id: i.id,
            personName: personMap.get(i.person_id) ?? 'Unknown',
            date: i.date,
          }));
      }
    }

    return {
      mood: journalEntry.data?.mood ?? null,
      energy: journalEntry.data?.energy ?? null,
      activeMedia: media.data
        ? {
            id: media.data.id,
            title: media.data.title,
            type: media.data.type,
            status: media.data.status,
          }
        : null,
      activeObjectives: (objectives.data ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        progress: o.progress,
      })),
      upcomingEvents: (events.data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        date: e.start_at,
      })),
      recentInteractions,
    };
  });
}

export async function fetchDayContext(date: string): Promise<{
  mood: number | null;
  energy: number | null;
  mediaTitle: string | null;
  objectiveTitle: string | null;
  eventTitle: string | null;
}> {
  const [journal, media, objectives, events] = await Promise.all([
    db.from('journal_entries').select('mood, energy').eq('date', date).eq('type', 'daily').single(),
    db.from('media_items').select('title').eq('finished_at', date).limit(1).single(),
    db.from('objectives').select('title').eq('status', 'active').limit(1).single(),
    db.from('calendar_events').select('title').eq('start_at', date).limit(1).single(),
  ]);

  return {
    mood: journal.data?.mood ?? null,
    energy: journal.data?.energy ?? null,
    mediaTitle: media.data?.title ?? null,
    objectiveTitle: objectives.data?.title ?? null,
    eventTitle: events.data?.title ?? null,
  };
}

export async function addPost(input: CreatePostInput): Promise<SocialPost> {
  return createPost(input);
}

export async function publish(id: string, url?: string): Promise<SocialPost> {
  return publishPost(id, url);
}

export async function updatePostStatusAction(input: UpdatePostStatusInput): Promise<SocialPost> {
  return updatePostStatus(input);
}

export async function linkPostAction(input: LinkPostInput): Promise<SocialPost> {
  return linkPostToEntity(input);
}

export async function fetchObjectivesForLinking(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await db
    .from('objectives')
    .select('id, title')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to get objectives: ${error.message}`);
  return (data ?? []) as { id: string; title: string }[];
}

export async function fetchTasksForLinking(): Promise<{ id: string; title: string }[]> {
  const { data, error } = await db
    .from('tasks')
    .select('id, title')
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(20);
  if (error) throw new Error(`Failed to get tasks: ${error.message}`);
  return (data ?? []) as { id: string; title: string }[];
}

export async function fetchProjectsForLinking(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from('projects')
    .select('id, name')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}

export async function fetchPeopleForLinking(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from('people')
    .select('id, name')
    .eq('active', true)
    .order('importance', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to get people: ${error.message}`);
  return (data ?? []) as { id: string; name: string }[];
}
