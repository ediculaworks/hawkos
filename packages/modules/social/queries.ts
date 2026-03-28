import { db } from '@hawk/db';
import { createLogger, HawkError } from '@hawk/shared';

const logger = createLogger('social');

import type {
  CreatePostInput,
  LinkPostInput,
  PostStatus,
  SocialGoal,
  SocialPlatform,
  SocialPost,
  SocialPostWithContext,
  UpdatePostStatusInput,
} from './types';

export async function createPost(input: CreatePostInput): Promise<SocialPost> {
  const { data, error } = await db
    .from('social_posts')
    .insert({
      platform: input.platform,
      content: input.content ?? null,
      status: input.status ?? 'idea',
      tags: input.tags ?? [],
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create post');
    throw new HawkError(`Failed to create post: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as SocialPost;
}

export async function listPosts(
  platform?: SocialPlatform,
  status?: PostStatus,
  limit = 20,
  offset = 0,
): Promise<SocialPost[]> {
  let query = db
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (platform) query = query.eq('platform', platform);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list posts');
    throw new HawkError(`Failed to list posts: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SocialPost[];
}

export async function publishPost(id: string, url?: string): Promise<SocialPost> {
  const { data, error } = await db
    .from('social_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      url: url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to publish post');
    throw new HawkError(`Failed to publish post: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as SocialPost;
}

export async function listGoals(): Promise<SocialGoal[]> {
  const { data, error } = await db
    .from('social_goals')
    .select('*')
    .order('platform', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to list goals');
    throw new HawkError(`Failed to list goals: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SocialGoal[];
}

export async function getPostStats(): Promise<
  { platform: string; ideas: number; drafts: number; published: number }[]
> {
  const { data, error } = await db.from('social_posts').select('platform, status');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get post stats');
    throw new HawkError(`Failed to get post stats: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const map = new Map<string, { ideas: number; drafts: number; published: number }>();
  for (const row of data ?? []) {
    const entry = map.get(row.platform) ?? { ideas: 0, drafts: 0, published: 0 };
    if (row.status === 'idea') entry.ideas++;
    else if (row.status === 'draft' || row.status === 'scheduled') entry.drafts++;
    else if (row.status === 'published') entry.published++;
    map.set(row.platform, entry);
  }

  return [...map.entries()].map(([platform, stats]) => ({ platform, ...stats }));
}

// Cross-module context functions moved to apps/web/lib/actions/social.ts
// (server actions are the correct orchestration layer for cross-module queries)

export async function getSocialStats(): Promise<{
  totalPublished: number;
  totalPending: number;
  currentStreak: number;
  byPlatform: { platform: string; count: number }[];
}> {
  const { data: posts } = await db.from('social_posts').select('platform, status, published_at');

  const published = posts?.filter((p) => p.status === 'published') ?? [];
  const pending = posts?.filter((p) => p.status !== 'published') ?? [];

  const platformCounts = new Map<string, number>();
  for (const p of published) {
    platformCounts.set(p.platform, (platformCounts.get(p.platform) ?? 0) + 1);
  }

  // Calculate streak (consecutive days with published post)
  const publishedDates = new Set(
    published
      .filter((p) => p.published_at)
      .map((p) => p.published_at?.split('T')[0])
      .filter(Boolean) as string[],
  );

  let streak = 0;
  const checkDate = new Date();
  while (publishedDates.has(checkDate.toISOString().split('T')[0] as string)) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalPublished: published.length,
    totalPending: pending.length,
    currentStreak: streak,
    byPlatform: [...platformCounts.entries()].map(([platform, count]) => ({
      platform,
      count,
    })),
  };
}

export async function getPostsWithContext(
  platform?: SocialPlatform,
  status?: PostStatus,
  objectiveId?: string,
): Promise<SocialPostWithContext[]> {
  let query = db
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (platform) query = query.eq('platform', platform);
  if (status) query = query.eq('status', status);
  if (objectiveId) query = query.eq('objective_id', objectiveId);

  const { data: posts, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list posts');
    throw new HawkError(`Failed to list posts: ${error.message}`, 'DB_QUERY_FAILED');
  }

  // Fetch related data
  const objectiveIds = [...new Set(posts?.map((p) => p.objective_id).filter(Boolean))] as string[];
  const taskIds = [...new Set(posts?.map((p) => p.task_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(posts?.map((p) => p.project_id).filter(Boolean))] as string[];
  const personIds = [...new Set(posts?.map((p) => p.person_id).filter(Boolean))] as string[];

  const [objectives, tasks, projects, people] = await Promise.all([
    objectiveIds.length > 0
      ? db.from('objectives').select('id, title').in('id', objectiveIds)
      : Promise.resolve({ data: [] }),
    taskIds.length > 0
      ? db.from('tasks').select('id, title').in('id', taskIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? db.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [] }),
    personIds.length > 0
      ? db.from('people').select('id, name').in('id', personIds)
      : Promise.resolve({ data: [] }),
  ]);

  const objectiveMap = new Map(objectives.data?.map((o) => [o.id, o.title]) ?? []);
  const taskMap = new Map(tasks.data?.map((t) => [t.id, t.title]) ?? []);
  const projectMap = new Map(projects.data?.map((p) => [p.id, p.name]) ?? []);
  const personMap = new Map(people.data?.map((p) => [p.id, p.name]) ?? []);

  return (posts ?? []).map((p) => ({
    ...p,
    objective_title: p.objective_id ? (objectiveMap.get(p.objective_id) ?? null) : null,
    task_title: p.task_id ? (taskMap.get(p.task_id) ?? null) : null,
    project_name: p.project_id ? (projectMap.get(p.project_id) ?? null) : null,
    person_name: p.person_id ? (personMap.get(p.person_id) ?? null) : null,
  })) as SocialPostWithContext[];
}

export async function listPostsByStatus(): Promise<{
  idea: SocialPostWithContext[];
  draft: SocialPostWithContext[];
  scheduled: SocialPostWithContext[];
  published: SocialPostWithContext[];
}> {
  const posts = await getPostsWithContext();

  return {
    idea: posts.filter((p) => p.status === 'idea'),
    draft: posts.filter((p) => p.status === 'draft'),
    scheduled: posts.filter((p) => p.status === 'scheduled'),
    published: posts.filter((p) => p.status === 'published'),
  };
}

export async function updatePostStatus(input: UpdatePostStatusInput): Promise<SocialPost> {
  const updateData: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.status === 'published') {
    updateData.published_at = new Date().toISOString();
  }
  if (input.url) {
    updateData.url = input.url;
  }
  if (input.scheduled_at) {
    updateData.scheduled_at = input.scheduled_at;
  }

  const { data, error } = await db
    .from('social_posts')
    .update(updateData)
    .eq('id', input.id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update post status');
    throw new HawkError(`Failed to update post status: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as SocialPost;
}

export async function linkPostToEntity(input: LinkPostInput): Promise<SocialPost> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.objective_id) updateData.objective_id = input.objective_id;
  if (input.task_id) updateData.task_id = input.task_id;
  if (input.project_id) updateData.project_id = input.project_id;
  if (input.person_id) updateData.person_id = input.person_id;

  const { data, error } = await db
    .from('social_posts')
    .update(updateData)
    .eq('id', input.post_id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to link post');
    throw new HawkError(`Failed to link post: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as SocialPost;
}

// ForLinking functions moved to apps/web/lib/actions/social.ts
