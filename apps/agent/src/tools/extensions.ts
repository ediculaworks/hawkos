/**
 * Extension-powered tools — query synced data from extension_connections.
 * These complement the existing direct-API tools (github.ts etc.)
 */

import type { ToolDefinition } from './types.js';

export const extensionTools: Record<string, ToolDefinition> = {
  ext_github_synced_repos: {
    name: 'ext_github_synced_repos',
    modules: ['career'],
    description: 'Lista repos sincronizados do GitHub (dados locais, sem API call)',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número de repos (default: 15)' },
      },
    },
    handler: async (args: { limit?: number }) => {
      const { getRepos } = await import('@hawk/extensions/github/queries');
      const repos = await getRepos(args.limit ?? 15);
      if (repos.length === 0) return 'Nenhum repo sincronizado. Conecte GitHub em Extensões.';
      const lines = repos.map(
        (r: { name: string; language?: string; stars: number; full_name: string }) => {
          const lang = r.language ? ` [${r.language}]` : '';
          const stars = r.stars > 0 ? ` ⭐${r.stars}` : '';
          return `• **${r.name}**${lang}${stars} — ${r.full_name}`;
        },
      );
      return [`**Repos sincronizados** (${repos.length}):`, ...lines].join('\n');
    },
  },

  ext_github_synced_prs: {
    name: 'ext_github_synced_prs',
    modules: ['career'],
    description: 'Lista PRs recentes sincronizados do GitHub',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número de PRs (default: 15)' },
      },
    },
    handler: async (args: { limit?: number }) => {
      const { getRecentPRs } = await import('@hawk/extensions/github/queries');
      const prs = await getRecentPRs(args.limit ?? 15);
      if (prs.length === 0) return 'Nenhuma PR sincronizada. Conecte GitHub em Extensões.';
      const lines = prs.map(
        (pr: {
          state: string;
          merged_at?: string;
          number: number;
          title: string;
          repo_full_name: string;
          author: string;
        }) => {
          const state = pr.state === 'open' ? '🟢' : pr.merged_at ? '🟣' : '🔴';
          return `${state} #${pr.number} **${pr.title}** (${pr.repo_full_name}) — ${pr.author}`;
        },
      );
      return [`**PRs recentes** (${prs.length}):`, ...lines].join('\n');
    },
  },

  ext_clickup_tasks: {
    name: 'ext_clickup_tasks',
    modules: ['objectives'],
    description: 'Lista tasks sincronizadas do ClickUp',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número de tasks (default: 20)' },
        status: {
          type: 'string',
          description: 'Filtrar por status (open, closed, in progress, etc.)',
        },
      },
    },
    handler: async (args: { limit?: number; status?: string }) => {
      const { getTasks, getTasksByStatus } = await import('@hawk/extensions/clickup/queries');
      const tasks = args.status
        ? await getTasksByStatus(args.status, args.limit ?? 20)
        : await getTasks(args.limit ?? 20);
      if (tasks.length === 0) return 'Nenhuma task sincronizada. Conecte ClickUp em Extensões.';
      const lines = tasks.map(
        (t: {
          priority?: number;
          due_date?: string;
          status: string;
          name: string;
          space_name: string;
          list_name: string;
        }) => {
          const priority = t.priority ? `P${t.priority}` : '';
          const due = t.due_date
            ? ` (vence: ${new Date(t.due_date).toLocaleDateString('pt-BR')})`
            : '';
          return `• [${t.status}] ${priority} **${t.name}** — ${t.space_name}/${t.list_name}${due}`;
        },
      );
      return [`**ClickUp Tasks** (${tasks.length}):`, ...lines].join('\n');
    },
  },

  ext_sync_extension: {
    name: 'ext_sync_extension',
    modules: [],
    description: 'Sincroniza manualmente uma extensão conectada (github, clickup)',
    parameters: {
      type: 'object',
      properties: {
        extension: {
          type: 'string',
          enum: ['github', 'clickup'],
          description: 'Qual extensão sincronizar',
        },
      },
      required: ['extension'],
    },
    handler: async (args: { extension: string }) => {
      const { extensionRegistry } = await import('@hawk/extensions/core/registry');
      const { getConnection, upsertConnection } = await import('@hawk/extensions/core/credentials');
      await import('@hawk/extensions/setup');

      const ext = extensionRegistry.get(
        args.extension as Parameters<typeof extensionRegistry.get>[0],
      );
      if (!ext?.sync) return `Extensão "${args.extension}" não encontrada ou não suporta sync.`;

      const conn = await getConnection(ext.id);
      if (!conn || conn.status !== 'connected') return `Extensão "${ext.name}" não está conectada.`;

      const result = await ext.sync(conn);

      await upsertConnection(ext.id, {
        last_sync_at: new Date().toISOString(),
        last_error: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      if (result.errors.length > 0) {
        return `Sync de ${ext.name} parcial: ${result.synced} itens sincronizados, erros: ${result.errors.join('; ')}`;
      }
      return `Sync de ${ext.name} completo: ${result.synced} itens sincronizados.`;
    },
  },
};
