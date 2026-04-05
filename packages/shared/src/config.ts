/**
 * Centralized environment configuration with Zod validation.
 *
 * Usage:
 *   import { getConfig } from '@hawk/shared';
 *   const { DATABASE_URL, JWT_SECRET } = getConfig();
 *
 * Call loadConfig() once at startup (before anything else).
 * All subsequent calls to getConfig() return the cached result.
 */

import { z } from 'zod';

const envSchema = z.object({
  // ── Database ───────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_URL: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),

  // ── Auth ───────────────────────────────────────────────────
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ADMIN_MASTER_KEY: z.string().min(1, 'ADMIN_MASTER_KEY is required'),

  // ── Discord ────────────────────────────────────────────────
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_CHANNEL_ID: z.string().optional(),
  DISCORD_AUTHORIZED_USER_ID: z.string().optional(),

  // ── AI / LLM ───────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('qwen/qwen3.6-plus:free'),
  OPENROUTER_MAX_TOKENS: z.coerce.number().default(4096),

  // ── Model Tiers ────────────────────────────────────────────
  MODEL_TIER_SIMPLE: z.string().optional(),
  MODEL_TIER_DEFAULT: z.string().optional(),
  MODEL_TIER_COMPLEX: z.string().optional(),
  MODEL_DAILY_BUDGET_USD: z.coerce.number().default(1.0),

  // ── Ollama (local inference) ───────────────────────────────
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_WORKER_MODEL: z.string().default('qwen3:4b'),

  // ── Worker Models ──────────────────────────────────────────
  MEMORY_WORKER_MODEL: z.string().optional(),
  DEDUP_WORKER_MODEL: z.string().optional(),

  // ── Agent API ──────────────────────────────────────────────
  AGENT_API_PORT: z.coerce.number().default(3001),
  AGENT_API_SECRET: z.string().min(1, 'AGENT_API_SECRET is required'),
  NEXT_PUBLIC_AGENT_API_TOKEN: z.string().optional(),

  // ── App ────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  DOMAIN: z.string().optional(),

  // ── Storage (Cloudflare R2) ────────────────────────────────
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // ── Integrations ───────────────────────────────────────────
  GROQ_API_KEY: z.string().optional(),
  GITHUB_USERNAME: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  CLICKUP_CLIENT_ID: z.string().optional(),
  CLICKUP_CLIENT_SECRET: z.string().optional(),

  // ── Agent Behaviour ────────────────────────────────────────
  HEARTBEAT_PROFILE: z.string().default('companion'),
  HEARTBEAT_ACTIVE_HOURS: z.string().default('08:00-22:00'),
  AGENT_SLOT: z.string().optional(),
  TENANT_SCHEMA: z.string().optional(),

  // ── Onboarding ─────────────────────────────────────────────
  ONBOARDING_MASTER_PASSWORD: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

/**
 * Validate and load environment variables. Exits the process on failure.
 * Should be called once at application startup, before any other imports
 * that depend on env vars.
 */
export function loadConfig(): EnvConfig {
  if (_config) return _config;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n');
    process.stderr.write(`[config] ENV VALIDATION FAILED:\n${messages}\n`);
    process.exit(1);
  }
  _config = result.data;
  return _config;
}

/**
 * Get the validated config. Calls loadConfig() if not yet loaded.
 * Safe to call anywhere after startup.
 */
export function getConfig(): EnvConfig {
  if (!_config) return loadConfig();
  return _config;
}

/** Reset cached config (for tests only) */
export function _resetConfig(): void {
  _config = null;
}
