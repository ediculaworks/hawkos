/**
 * GitHub integration tools — free tier (60 req/h without token, 5000/h with token).
 * Uses GitHub REST API v3.
 */

import type { ToolDefinition } from './types.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USERNAME;

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'HawkOS/1.0',
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const githubTools: Record<string, ToolDefinition> = {
  github_activity: {
    name: 'github_activity',
    modules: ['career'],
    description: 'Mostra atividade recente no GitHub (commits, PRs, issues)',
    parameters: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: `Username do GitHub (default: ${GITHUB_USER ?? 'configurar GITHUB_USERNAME'})`,
        },
        count: { type: 'number', description: 'Número de eventos (default: 10, max 30)' },
      },
    },
    handler: async (args: { username?: string; count?: number }) => {
      const user = args.username ?? GITHUB_USER;
      if (!user) return 'Erro: Configure GITHUB_USERNAME no .env';

      const events = (await githubFetch(
        `/users/${user}/events?per_page=${Math.min(args.count ?? 10, 30)}`,
      )) as Array<{
        type: string;
        repo: { name: string };
        created_at: string;
        payload: Record<string, unknown>;
      }>;

      if (events.length === 0) return 'Nenhuma atividade recente.';

      const lines = events.map((e) => {
        const date = new Date(e.created_at).toLocaleDateString('pt-BR');
        const repo = e.repo.name;
        switch (e.type) {
          case 'PushEvent': {
            const commits = (e.payload.commits as Array<{ message: string }>) ?? [];
            return `📝 Push em **${repo}** (${commits.length} commits) — ${date}`;
          }
          case 'PullRequestEvent':
            return `🔀 PR ${e.payload.action} em **${repo}** — ${date}`;
          case 'IssuesEvent':
            return `🐛 Issue ${e.payload.action} em **${repo}** — ${date}`;
          case 'CreateEvent':
            return `🆕 ${e.payload.ref_type} criado em **${repo}** — ${date}`;
          case 'WatchEvent':
            return `⭐ Star em **${repo}** — ${date}`;
          default:
            return `${e.type} em **${repo}** — ${date}`;
        }
      });

      return [`**GitHub Activity** (@${user}):`, ...lines].join('\n');
    },
  },

  github_repos: {
    name: 'github_repos',
    modules: ['career'],
    description: 'Lista repositórios do GitHub do usuário',
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username (default: GITHUB_USERNAME)' },
        sort: {
          type: 'string',
          enum: ['updated', 'stars', 'name'],
          description: 'Ordenar por (default: updated)',
        },
      },
    },
    handler: async (args: { username?: string; sort?: string }) => {
      const user = args.username ?? GITHUB_USER;
      if (!user) return 'Erro: Configure GITHUB_USERNAME no .env';

      const sortParam = args.sort === 'stars' ? 'stargazers_count' : (args.sort ?? 'updated');
      const repos = (await githubFetch(
        `/users/${user}/repos?sort=${sortParam}&direction=desc&per_page=10`,
      )) as Array<{
        name: string;
        description: string | null;
        language: string | null;
        stargazers_count: number;
        updated_at: string;
        html_url: string;
        fork: boolean;
      }>;

      if (repos.length === 0) return 'Nenhum repositório encontrado.';

      const lines = repos
        .filter((r) => !r.fork)
        .map((r) => {
          const lang = r.language ? ` [${r.language}]` : '';
          const stars = r.stargazers_count > 0 ? ` ⭐${r.stargazers_count}` : '';
          const desc = r.description ? ` — ${r.description.slice(0, 60)}` : '';
          return `• **${r.name}**${lang}${stars}${desc}`;
        });

      return [`**Repos** (@${user}):`, ...lines].join('\n');
    },
  },

  github_create_issue: {
    name: 'github_create_issue',
    modules: ['career'],
    description: 'Cria uma issue em um repositório GitHub',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repositório no formato owner/repo' },
        title: { type: 'string', description: 'Título da issue' },
        body: { type: 'string', description: 'Corpo/descrição da issue (markdown)' },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels (opcional)',
        },
      },
      required: ['repo', 'title'],
    },
    handler: async (args: { repo: string; title: string; body?: string; labels?: string[] }) => {
      if (!GITHUB_TOKEN) return 'Erro: GITHUB_TOKEN necessário para criar issues.';

      const res = await fetch(`https://api.github.com/repos/${args.repo}/issues`, {
        method: 'POST',
        headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: args.title,
          body: args.body,
          labels: args.labels,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return `Erro ao criar issue: ${res.status} ${error.slice(0, 200)}`;
      }

      const issue = (await res.json()) as { html_url: string; number: number };
      return `Issue #${issue.number} criada: ${issue.html_url}`;
    },
  },
};
