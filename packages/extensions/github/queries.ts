import { db as typedDb } from '@hawk/db';

// biome-ignore lint/suspicious/noExplicitAny: pending type generation
const db = typedDb as any;

export async function getRepos(limit = 20) {
  const { data } = await db
    .from('github_repos')
    .select(
      'id, github_id, name, full_name, description, url, language, stars, is_private, is_fork, last_pushed_at, synced_at',
    )
    .order('last_pushed_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRecentPRs(limit = 20) {
  const { data } = await db
    .from('github_pull_requests')
    .select(
      'id, github_id, repo_full_name, number, title, state, url, author, created_at_gh, merged_at, synced_at',
    )
    .order('created_at_gh', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRepoCount() {
  const { count } = await db.from('github_repos').select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function getPRCount() {
  const { count } = await db
    .from('github_pull_requests')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}
