import { db as typedDb } from '@hawk/db';
import type { ExtensionConnection, SyncResult } from '../core/types';

// Cast to any — extension tables aren't in generated types until migration + db:types
// biome-ignore lint/suspicious/noExplicitAny: pending type generation
const db = typedDb as any;

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  private: boolean;
  fork: boolean;
  pushed_at: string | null;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: { login: string } | null;
  created_at: string;
  merged_at: string | null;
}

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function syncGitHub(connection: ExtensionConnection): Promise<SyncResult> {
  const token = connection.access_token;
  if (!token) return { synced: 0, errors: ['No access token'] };

  const errors: string[] = [];
  let synced = 0;

  // Sync repos
  try {
    const repos = await ghFetch<GitHubRepo[]>('/user/repos?sort=pushed&per_page=50', token);
    for (const repo of repos) {
      await db.from('github_repos').upsert(
        {
          github_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          language: repo.language,
          stars: repo.stargazers_count,
          is_private: repo.private,
          is_fork: repo.fork,
          last_pushed_at: repo.pushed_at,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'github_id' },
      );
      synced++;
    }
  } catch (e) {
    errors.push(`Repos sync failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync recent PRs from top repos
  try {
    const repos = await ghFetch<GitHubRepo[]>(
      '/user/repos?sort=pushed&per_page=10&type=owner',
      token,
    );
    for (const repo of repos) {
      try {
        const prs = await ghFetch<GitHubPR[]>(
          `/repos/${repo.full_name}/pulls?state=all&sort=updated&per_page=10`,
          token,
        );
        for (const pr of prs) {
          await db.from('github_pull_requests').upsert(
            {
              github_id: pr.id,
              repo_full_name: repo.full_name,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              url: pr.html_url,
              author: pr.user?.login ?? null,
              created_at_gh: pr.created_at,
              merged_at: pr.merged_at,
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'github_id' },
          );
          synced++;
        }
      } catch {
        // skip individual repo PR fetch failures
      }
    }
  } catch (e) {
    errors.push(`PRs sync failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { synced, errors };
}
