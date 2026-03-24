import type { ToolDefinition } from './types.js';

/** Helper to run git commands and return output */
async function runGit(args: string[], cwd?: string): Promise<string> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    return `[git error, exit ${exitCode}]\n${stderr.trim() || stdout.trim()}`;
  }

  return stdout.trim() || stderr.trim() || '(sem output)';
}

export const gitTools: Record<string, ToolDefinition> = {
  git_status: {
    name: 'git_status',
    modules: [],
    description: 'Mostra o status do git (arquivos modificados, staged, untracked)',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { cwd?: string }) => {
      return runGit(['status', '--short', '--branch'], args.cwd);
    },
  },

  git_diff: {
    name: 'git_diff',
    modules: [],
    description: 'Mostra as diferenças no código (staged + unstaged)',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Arquivo específico (opcional)' },
        staged: { type: 'boolean', description: 'Mostrar apenas staged (default: false)' },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { file?: string; staged?: boolean; cwd?: string }) => {
      const gitArgs = ['diff'];
      if (args.staged) gitArgs.push('--cached');
      gitArgs.push('--stat');
      if (args.file) gitArgs.push('--', args.file);

      const stat = await runGit(gitArgs, args.cwd);

      // Also get the actual diff (limited)
      const diffArgs = ['diff'];
      if (args.staged) diffArgs.push('--cached');
      if (args.file) diffArgs.push('--', args.file);

      const diff = await runGit(diffArgs, args.cwd);
      const truncated =
        diff.length > 10_000 ? `${diff.slice(0, 10_000)}\n\n... [diff truncado]` : diff;

      return `${stat}\n\n${truncated}`;
    },
  },

  git_log: {
    name: 'git_log',
    modules: [],
    description: 'Mostra histórico recente de commits',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Número de commits (default 10)' },
        file: { type: 'string', description: 'Histórico de um arquivo específico (opcional)' },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { count?: number; file?: string; cwd?: string }) => {
      const gitArgs = ['log', '--oneline', `-${args.count ?? 10}`, '--format=%h %ar %s'];
      if (args.file) gitArgs.push('--', args.file);
      return runGit(gitArgs, args.cwd);
    },
  },

  git_commit: {
    name: 'git_commit',
    modules: [],
    dangerous: true,
    description: 'Faz stage e commit de arquivos',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem de commit' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arquivos para adicionar ao stage (default: todos modificados)',
        },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
      required: ['message'],
    },
    handler: async (args: { message: string; files?: string[]; cwd?: string }) => {
      // Stage files
      if (args.files && args.files.length > 0) {
        const stageResult = await runGit(['add', ...args.files], args.cwd);
        if (stageResult.includes('git error')) return stageResult;
      } else {
        const stageResult = await runGit(['add', '-A'], args.cwd);
        if (stageResult.includes('git error')) return stageResult;
      }

      // Commit
      const result = await runGit(['commit', '-m', args.message], args.cwd);
      return result;
    },
  },

  git_push: {
    name: 'git_push',
    modules: [],
    dangerous: true,
    description: 'Faz push para o repositório remoto',
    parameters: {
      type: 'object',
      properties: {
        branch: { type: 'string', description: 'Branch (default: branch atual)' },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { branch?: string; cwd?: string }) => {
      const gitArgs = ['push'];
      if (args.branch) gitArgs.push('origin', args.branch);
      return runGit(gitArgs, args.cwd);
    },
  },

  git_pull: {
    name: 'git_pull',
    modules: [],
    dangerous: true,
    description: 'Faz pull do repositório remoto',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { cwd?: string }) => {
      return runGit(['pull'], args.cwd);
    },
  },

  git_branch: {
    name: 'git_branch',
    modules: [],
    description: 'Lista, cria ou troca de branch',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'switch'],
          description: 'Ação: list, create, switch (default: list)',
        },
        name: { type: 'string', description: 'Nome da branch (obrigatório para create/switch)' },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { action?: string; name?: string; cwd?: string }) => {
      const action = args.action ?? 'list';

      if (action === 'list') {
        return runGit(['branch', '-a', '--sort=-committerdate'], args.cwd);
      }

      if (!args.name) return 'Erro: nome da branch é obrigatório para create/switch.';

      if (action === 'create') {
        return runGit(['checkout', '-b', args.name], args.cwd);
      }

      if (action === 'switch') {
        return runGit(['checkout', args.name], args.cwd);
      }

      return `Ação desconhecida: ${action}`;
    },
  },

  git_stash: {
    name: 'git_stash',
    modules: [],
    description: 'Gerencia o git stash (save, pop, list)',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['save', 'pop', 'list', 'drop'],
          description: 'Ação: save, pop, list, drop (default: save)',
        },
        message: { type: 'string', description: 'Mensagem para o stash (opcional, para save)' },
        cwd: { type: 'string', description: 'Diretório do repositório (opcional)' },
      },
    },
    handler: async (args: { action?: string; message?: string; cwd?: string }) => {
      const action = args.action ?? 'save';

      if (action === 'list') return runGit(['stash', 'list'], args.cwd);
      if (action === 'pop') return runGit(['stash', 'pop'], args.cwd);
      if (action === 'drop') return runGit(['stash', 'drop'], args.cwd);

      // save
      const stashArgs = ['stash', 'push'];
      if (args.message) stashArgs.push('-m', args.message);
      return runGit(stashArgs, args.cwd);
    },
  },
};
