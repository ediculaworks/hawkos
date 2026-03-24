#!/usr/bin/env bun
/**
 * 🦅 Hawk OS — Interactive Setup Wizard
 *
 * Collects all required environment variables and writes .env
 * Run: bun scripts/setup.ts
 */

import * as readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HAWK_DIR = process.env.HAWK_DIR ?? process.cwd();
const ENV_PATH = join(HAWK_DIR, '.env');

// ─── ANSI colors ──────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
};

// ─── Readline setup ───────────────────────────────────────────

// On Unix, prefer /dev/tty so we work even when piped from install.sh
let inputStream: NodeJS.ReadableStream = process.stdin;
if (process.platform !== 'win32' && existsSync('/dev/tty')) {
  try {
    const { createReadStream } = await import('node:fs');
    inputStream = createReadStream('/dev/tty');
  } catch {
    // fall back to stdin
  }
}

const rl = readline.createInterface({
  input: inputStream as NodeJS.ReadableStream,
  output: process.stdout,
  terminal: true,
});

rl.on('SIGINT', () => {
  print(`\n\n${c.yellow}Setup cancelado.${c.reset}`);
  rl.close();
  process.exit(0);
});

// ─── Helpers ──────────────────────────────────────────────────

function print(msg: string) {
  process.stdout.write(msg + '\n');
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

function step(n: number, total: number, title: string) {
  print(`\n${c.bold}[${n}/${total}] ${title}${c.reset}`);
}

function hint(msg: string) {
  print(`${c.dim}  → ${msg}${c.reset}`);
}

async function ask(label: string, defaultVal = '', required = true): Promise<string> {
  const defStr = defaultVal ? ` ${c.dim}[${defaultVal}]${c.reset}` : '';
  const reqStr = required ? ` ${c.yellow}*${c.reset}` : ` ${c.dim}(opcional)${c.reset}`;
  const answer = await prompt(`  ${label}${reqStr}${defStr}: `);
  const value = answer.trim() || defaultVal;
  if (required && !value) {
    print(`  ${c.red}Campo obrigatório. Tente novamente.${c.reset}`);
    return ask(label, defaultVal, required);
  }
  return value;
}

async function confirm(question: string, defaultNo = true): Promise<boolean> {
  const choices = defaultNo ? `${c.dim}(s/N)${c.reset}` : `${c.dim}(S/n)${c.reset}`;
  const answer = await prompt(`  ${question} ${choices}: `);
  const t = answer.trim().toLowerCase();
  if (defaultNo) return t === 's' || t === 'sim' || t === 'y' || t === 'yes';
  return !(t === 'n' || t === 'não' || t === 'nao' || t === 'no');
}

// ─── Main wizard ──────────────────────────────────────────────

async function main() {
  print('');
  print(`${c.cyan}${c.bold}═══════════════════════════════════════${c.reset}`);
  print(`${c.cyan}${c.bold}  🦅 Hawk OS — Setup Inicial${c.reset}`);
  print(`${c.cyan}${c.bold}═══════════════════════════════════════${c.reset}`);
  print(`${c.dim}  Pressione Ctrl+C a qualquer momento para cancelar${c.reset}`);

  // Check existing .env
  if (existsSync(ENV_PATH)) {
    print(`\n${c.yellow}⚠ Arquivo .env já existe em ${ENV_PATH}${c.reset}`);
    const overwrite = await confirm('Reconfigurar do zero?', true);
    if (!overwrite) {
      print(`\n${c.green}✓ Configuração existente mantida.${c.reset}`);
      rl.close();
      return;
    }
  }

  const env: Record<string, string> = {};
  const optionalSections: string[] = [];

  // ─── 1. Supabase ──────────────────────────────────────────────
  step(1, 5, 'Supabase');
  hint('Acesse app.supabase.com → seu projeto → Settings → API');

  env.SUPABASE_URL             = await ask('Project URL');
  env.SUPABASE_ANON_KEY        = await ask('Anon Key (public)');
  env.SUPABASE_SERVICE_ROLE_KEY = await ask('Service Role Key (secret)');

  // Mirror public Next.js vars — same values
  env.NEXT_PUBLIC_SUPABASE_URL      = env.SUPABASE_URL;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

  // ─── 2. Discord ───────────────────────────────────────────────
  step(2, 5, 'Discord Bot');
  hint('Acesse discord.com/developers/applications → seu bot → Bot');

  env.DISCORD_BOT_TOKEN          = await ask('Bot Token');
  env.DISCORD_CLIENT_ID          = await ask('Client ID (Application ID)');
  env.DISCORD_GUILD_ID           = await ask('Server ID (Guild ID)');
  hint('Ative Modo Desenvolvedor: Configurações Discord → Avançado → Modo Desenvolvedor');
  hint('Depois clique direito no seu usuário → Copiar ID do usuário');
  env.DISCORD_AUTHORIZED_USER_ID = await ask('Seu Discord User ID');
  env.DISCORD_CHANNEL_ID         = await ask('Channel ID específico', '', false);

  // ─── 3. OpenRouter ────────────────────────────────────────────
  step(3, 5, 'OpenRouter (IA)');
  hint('Acesse openrouter.ai/keys → Create Key');

  env.OPENROUTER_API_KEY   = await ask('API Key');
  env.OPENROUTER_MODEL     = await ask('Modelo', 'openrouter/free');
  env.OPENROUTER_MAX_TOKENS = await ask('Max tokens', '4096');

  // ─── 4. Agent API Secret ──────────────────────────────────────
  step(4, 5, 'Agent API Secret');
  hint('Chave secreta para comunicação entre dashboard e agent.');
  hint('Pressione Enter para gerar automaticamente (recomendado).');

  const generatedSecret = randomUUID().replace(/-/g, '');
  const secret = await ask('Secret', generatedSecret);

  env.AGENT_API_SECRET            = secret;
  env.NEXT_PUBLIC_AGENT_API_TOKEN = secret;
  env.AGENT_API_PORT              = '3001';

  // ─── 5. Integrações Opcionais ─────────────────────────────────
  step(5, 5, 'Integrações Opcionais');

  const configGoogle = await confirm('Configurar Google Calendar?');
  if (configGoogle) {
    hint('Acesse console.cloud.google.com → APIs → Calendar API → Credentials');
    env.GOOGLE_CLIENT_ID     = await ask('Client ID');
    env.GOOGLE_CLIENT_SECRET = await ask('Client Secret');
    env.GOOGLE_REDIRECT_URI  = await ask('Redirect URI', 'http://localhost:3000/auth/google/callback');
    optionalSections.push('google');
  }

  const configR2 = await confirm('Configurar Cloudflare R2 (backups)?');
  if (configR2) {
    hint('Acesse dash.cloudflare.com → R2 → Manage R2 API Tokens');
    env.R2_ACCOUNT_ID      = await ask('Account ID');
    env.R2_ACCESS_KEY_ID   = await ask('Access Key ID');
    env.R2_SECRET_ACCESS_KEY = await ask('Secret Access Key');
    env.R2_BUCKET          = await ask('Bucket name', 'hawk-os-backups');
    optionalSections.push('r2');
  }

  // ─── Defaults ─────────────────────────────────────────────────
  env.NODE_ENV             = 'production';
  env.APP_URL              = 'http://localhost:3000';
  env.NEXT_PUBLIC_APP_URL  = 'http://localhost:3000';

  // ─── Build .env content ───────────────────────────────────────
  const lines: string[] = [
    '# Hawk OS — Environment Variables',
    `# Gerado em ${new Date().toISOString()} pelo setup wizard`,
    '',
    '# ── Supabase ─────────────────────────────────────────────',
    `SUPABASE_URL=${env.SUPABASE_URL}`,
    `SUPABASE_ANON_KEY=${env.SUPABASE_ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${env.SUPABASE_SERVICE_ROLE_KEY}`,
    `NEXT_PUBLIC_SUPABASE_URL=${env.NEXT_PUBLIC_SUPABASE_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    '',
    '# ── Discord ──────────────────────────────────────────────',
    `DISCORD_BOT_TOKEN=${env.DISCORD_BOT_TOKEN}`,
    `DISCORD_CLIENT_ID=${env.DISCORD_CLIENT_ID}`,
    `DISCORD_GUILD_ID=${env.DISCORD_GUILD_ID}`,
    `DISCORD_AUTHORIZED_USER_ID=${env.DISCORD_AUTHORIZED_USER_ID}`,
    ...(env.DISCORD_CHANNEL_ID ? [`DISCORD_CHANNEL_ID=${env.DISCORD_CHANNEL_ID}`] : []),
    '',
    '# ── OpenRouter ───────────────────────────────────────────',
    `OPENROUTER_API_KEY=${env.OPENROUTER_API_KEY}`,
    `OPENROUTER_MODEL=${env.OPENROUTER_MODEL}`,
    `OPENROUTER_MAX_TOKENS=${env.OPENROUTER_MAX_TOKENS}`,
    '',
    '# ── Agent API ────────────────────────────────────────────',
    `AGENT_API_SECRET=${env.AGENT_API_SECRET}`,
    `NEXT_PUBLIC_AGENT_API_TOKEN=${env.NEXT_PUBLIC_AGENT_API_TOKEN}`,
    `AGENT_API_PORT=${env.AGENT_API_PORT}`,
    '',
    '# ── App ──────────────────────────────────────────────────',
    `NODE_ENV=${env.NODE_ENV}`,
    `APP_URL=${env.APP_URL}`,
    `NEXT_PUBLIC_APP_URL=${env.NEXT_PUBLIC_APP_URL}`,
  ];

  if (optionalSections.includes('google')) {
    lines.push(
      '',
      '# ── Google Calendar ─────────────────────────────────────',
      `GOOGLE_CLIENT_ID=${env.GOOGLE_CLIENT_ID}`,
      `GOOGLE_CLIENT_SECRET=${env.GOOGLE_CLIENT_SECRET}`,
      `GOOGLE_REDIRECT_URI=${env.GOOGLE_REDIRECT_URI}`,
    );
  }

  if (optionalSections.includes('r2')) {
    lines.push(
      '',
      '# ── Cloudflare R2 ───────────────────────────────────────',
      `R2_ACCOUNT_ID=${env.R2_ACCOUNT_ID}`,
      `R2_ACCESS_KEY_ID=${env.R2_ACCESS_KEY_ID}`,
      `R2_SECRET_ACCESS_KEY=${env.R2_SECRET_ACCESS_KEY}`,
      `R2_BUCKET=${env.R2_BUCKET}`,
    );
  }

  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');

  print('');
  print(`${c.green}${c.bold}✅ .env gravado em ${ENV_PATH}${c.reset}`);
  print('');

  rl.close();
}

main().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
