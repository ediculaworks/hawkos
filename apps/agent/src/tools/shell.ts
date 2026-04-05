import { z } from 'zod';
import type { ToolDefinition } from './types.js';

// ── Security: Allowlist / Blocklist (OpenClaw-inspired) ──────────────

const ALLOWED_BINARIES = new Set([
  // System info
  'ls',
  'dir',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'find',
  'which',
  'whoami',
  'date',
  'df',
  'du',
  'ps',
  'uptime',
  'uname',
  'hostname',
  'env',
  'echo',
  'pwd',
  'sort',
  'uniq',
  'tr',
  'cut',
  'awk',
  'sed',
  'tee',
  'xargs',
  'diff',
  // Dev tools
  'git',
  'bun',
  'node',
  'npm',
  'npx',
  'pnpm',
  'tsc',
  'biome',
  // Network (read-only)
  'curl',
  'wget',
  'ping',
  'dig',
  'nslookup',
  // Data processing
  'jq',
  'base64',
  // Docker
  'docker',
  'docker-compose',
  // Misc
  'tar',
  'gzip',
  'gunzip',
  'zip',
  'unzip',
  'file',
  'stat',
  'touch',
  'mkdir',
  'cp',
  'mv',
  // Windows-compatible
  'cmd',
  'powershell',
]);

const BLOCKED_PATTERNS = [
  /\brm\s+(-[a-z]*f|-[a-z]*r){2}\s+\//i, // rm -rf /
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  />\s*\/etc\//, // write to /etc
  /\beval\b/,
  /\bkill\s+-9\s+1\b/, // kill init
  /\bnc\s+-[a-z]*l/, // nc listener
  /\bmkfs\b/,
  /\bdd\s+.*of=\/dev/, // dd to device
  /\bformat\b.*[A-Z]:/i, // Windows format drive
  /\breg\s+(delete|add)\b/i, // Windows registry modification
];

const SENSITIVE_ENV_PATTERN = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i;

const MAX_OUTPUT_BYTES = 30_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

function sanitizeEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (SENSITIVE_ENV_PATTERN.test(key)) continue;
    env[key] = value;
  }
  return env;
}

function extractBinary(command: string): string | null {
  // Handle common patterns: binary, env binary, /usr/bin/binary
  const stripped = command.trim();
  // Skip env vars assignments at start
  const withoutEnvVars = stripped.replace(/^(\w+=\S+\s+)+/, '');
  const firstWord = withoutEnvVars.split(/\s+/)[0] ?? '';
  // Get basename (handles /usr/bin/git, C:\Program Files\git)
  const basename = firstWord.replace(/^.*[/\\]/, '').replace(/\.exe$/i, '');
  return basename || null;
}

function isCommandBlocked(command: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return `Comando bloqueado por segurança (padrão: ${pattern.source})`;
    }
  }

  const binary = extractBinary(command);
  if (!binary) return 'Não foi possível identificar o binário do comando.';

  // Allow piped commands if first binary is allowed
  // For pipes, we check the main binary
  if (!ALLOWED_BINARIES.has(binary)) {
    return `Binário "${binary}" não está na allowlist. Binários permitidos: ${[...ALLOWED_BINARIES].slice(0, 20).join(', ')}...`;
  }

  return null; // not blocked
}

function truncateOutput(output: string): string {
  if (Buffer.byteLength(output, 'utf-8') <= MAX_OUTPUT_BYTES) return output;
  const truncated = Buffer.from(output, 'utf-8').subarray(0, MAX_OUTPUT_BYTES).toString('utf-8');
  return `${truncated}\n\n... [output truncado em ${MAX_OUTPUT_BYTES} bytes]`;
}

export const shellTools: Record<string, ToolDefinition> = {
  execute_command: {
    name: 'execute_command',
    modules: [],
    dangerous: true,
    description:
      'Executa um comando shell no servidor. Binários permitidos incluem: git, bun, node, curl, docker, ls, grep, cat, etc. Comandos destrutivos (rm -rf /, sudo, etc) são bloqueados.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando shell a executar' },
        cwd: {
          type: 'string',
          description: 'Diretório de trabalho (opcional, default: project root)',
        },
        timeout_ms: {
          type: 'number',
          description: `Timeout em ms (default: ${DEFAULT_TIMEOUT_MS}, max: ${MAX_TIMEOUT_MS})`,
        },
      },
      required: ['command'],
    },
    schema: z.object({
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeout_ms: z.number().int().positive().max(60000).optional(),
    }),
    handler: async (args: { command: string; cwd?: string; timeout_ms?: number }) => {
      // 1. Security check
      const blocked = isCommandBlocked(args.command);
      if (blocked) return `⛔ ${blocked}`;

      // 2. Resolve cwd
      const projectRoot = process.cwd();
      const cwd = args.cwd ?? projectRoot;

      // 3. Timeout
      const timeout = Math.min(args.timeout_ms ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

      // 4. Execute via Bun.spawn
      try {
        const proc = Bun.spawn(['bash', '-c', args.command], {
          cwd,
          env: sanitizeEnv(),
          stdout: 'pipe',
          stderr: 'pipe',
        });

        // Timeout handling
        const timeoutId = setTimeout(() => proc.kill(), timeout);

        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);

        clearTimeout(timeoutId);
        const exitCode = await proc.exited;

        const parts: string[] = [];
        if (stdout.trim()) parts.push(truncateOutput(stdout.trim()));
        if (stderr.trim()) parts.push(`[stderr] ${truncateOutput(stderr.trim())}`);
        parts.push(`[exit: ${exitCode}]`);

        return parts.join('\n');
      } catch (err) {
        return `Erro ao executar comando: ${err}`;
      }
    },
  },
};
