/**
 * Smart Model Router — selects the best model based on query complexity.
 *
 * Complexity levels:
 * - simple: greetings, confirmations, single-fact lookups → fast/cheap model
 * - moderate: single-module queries, CRUD operations → default model
 * - complex: multi-module analysis, planning, comparison → powerful model
 *
 * Model tiers configurable via env vars:
 * - MODEL_TIER_SIMPLE: fast model for simple queries
 * - MODEL_TIER_DEFAULT: standard model for most queries
 * - MODEL_TIER_COMPLEX: powerful model for complex reasoning
 */

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

// ── Model capability metadata ────────────────────────────────────────────────
// All free models available on OpenRouter (openrouter.ai/collections/free-models)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Ollama local models
  'qwen3:4b': 256_000,
  'qwen3:1.7b': 40_000,
  'qwen3:8b': 256_000,
  'qwen2.5:3b': 32_768, // legacy fallback
  'ministral-3:3b': 256_000,
  'phi4-mini': 131_072,
  // Qwen family
  'qwen/qwen3.6-plus:free': 1_000_000,
  'qwen/qwen3-coder:free': 262_000,
  'qwen/qwen3-next-80b-a3b-instruct:free': 131_072,
  'qwen/qwen2.5-vl-72b-instruct:free': 32_768,
  // NVIDIA
  'nvidia/nemotron-3-super-120b-a12b:free': 262_144,
  'nvidia/nemotron-3-nano-30b-a3b:free': 256_000,
  'nvidia/nemotron-nano-9b-v2:free': 128_000,
  // OpenAI OSS
  'openai/gpt-oss-120b:free': 131_072,
  'openai/gpt-oss-20b:free': 131_072,
  // Google Gemma
  'google/gemma-3-27b-it:free': 131_072,
  'google/gemma-3-12b-it:free': 131_072,
  'google/gemma-3-4b-it:free': 131_072,
  'google/gemma-3n-e4b-it:free': 131_072,
  // Gemma 4 (local Ollama)
  'gemma4:e2b': 131_072,
  'gemma4:e4b': 131_072,
  // Mistral
  'mistralai/mistral-small-3.2-24b-instruct:free': 131_072,
  'mistralai/mistral-7b-instruct:free': 32_768,
  // Microsoft Phi
  'microsoft/phi-4-reasoning-plus:free': 32_768,
  'microsoft/phi-4-reasoning:free': 32_768,
  // DeepSeek
  'deepseek/deepseek-r1-0528:free': 163_840,
  'deepseek/deepseek-r1-0528-qwen3-8b:free': 32_768,
  'deepseek/deepseek-prover-v2:free': 131_072,
  'tngtech/deepseek-r1t-chimera:free': 163_840,
  // Z-AI / GLM
  'z-ai/glm-4.5-air:free': 131_072,
  // Meta Llama
  'meta-llama/llama-3.3-70b-instruct:free': 65_536,
  // NousResearch / Cognitive
  'nousresearch/hermes-3-llama-3.1-405b:free': 131_072,
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free': 32_768,
  // Stepfun / MiniMax (no tool_choice)
  'stepfun/step-3.5-flash:free': 256_000,
  'minimax/minimax-m2.5:free': 196_608,
  // Generic free route
  'openrouter/free': 200_000,
};

// Models that do not support the `tool_choice` parameter
const MODELS_WITHOUT_TOOL_CHOICE = new Set([
  'stepfun/step-3.5-flash:free',
  'minimax/minimax-m2.5:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'microsoft/phi-4-reasoning-plus:free',
  'microsoft/phi-4-reasoning:free',
  'deepseek/deepseek-r1-0528:free',
  'deepseek/deepseek-r1-0528-qwen3-8b:free',
  'deepseek/deepseek-prover-v2:free',
  'tngtech/deepseek-r1t-chimera:free',
]);

/**
 * Get context window limit (in tokens) for a given model.
 * Returns a conservative 65K default for unknown models.
 */
export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? 65_536;
}

/**
 * Check if a model supports the `tool_choice` parameter.
 */
export function supportsToolChoice(model: string): boolean {
  return !MODELS_WITHOUT_TOOL_CHOICE.has(model);
}

/**
 * Estimate token count from text, adjusted for model tokenizer characteristics.
 * Multilingual models (Qwen, GLM) tend to use ~3 chars/token for Portuguese.
 */
export function estimateTokenCount(text: string, model?: string): number {
  const isMultilingual =
    model && (model.includes('qwen') || model.includes('glm') || model.includes('minimax'));
  const charsPerToken = isMultilingual ? 3 : 4;
  return Math.ceil(text.length / charsPerToken);
}

const SIMPLE_WORDS = new Set([
  'ola',
  'olá',
  'oi',
  'hey',
  'bom dia',
  'boa noite',
  'boa tarde',
  'obrigado',
  'obrigada',
  'valeu',
  'ok',
  'sim',
  'nao',
  'não',
  'tudo bem',
  'tchau',
  'bye',
]);

function isSimpleGreeting(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[!.,?]/g, '')
    .trim();
  return SIMPLE_WORDS.has(normalized);
}

/**
 * Fast pre-check: returns true if the message is almost certainly a simple
 * greeting or one-word confirmation — before any DB/embedding work is done.
 * Used by context and history middleware to skip expensive loads early.
 */
export function isLikelySimpleMessage(message: string): boolean {
  return message.length < 30 && isSimpleGreeting(message);
}

const COMPLEX_PATTERNS =
  /\b(analis|compar|plan[ei]j|revis|resum|organiz|avali|otimiz|prioriz|estrat[ée]g|diagnostic|correlacion|impacto|tend[êe]ncia|previs[ãa]o)/i;

/** Patterns that indicate tool-heavy requests (CRUD, data lookup) */
const TOOL_HEAVY_PATTERNS =
  /\b(cri[ae]|adiciona|registr|salv|delet|remov|atualiz|list[ae]|mostr|busc|consult)/i;

/**
 * Classify query complexity based on message content and detected modules.
 * Enhanced with token-estimated message length and tool-use prediction.
 */
export function classifyComplexity(message: string, moduleCount: number): ComplexityLevel {
  // Complex: multi-module takes priority (even if message is short)
  if (moduleCount >= 3 || COMPLEX_PATTERNS.test(message)) {
    return 'complex';
  }

  // Simple: short greetings or confirmations (only if not multi-module)
  if (message.length < 30 && isSimpleGreeting(message)) {
    return 'simple';
  }

  // Simple: short tool-heavy CRUD requests (create, list, delete)
  // These are fast, single-turn, and don't need reasoning
  if (message.length < 100 && moduleCount <= 1 && TOOL_HEAVY_PATTERNS.test(message)) {
    return 'simple';
  }

  // Complex: long messages with questions (likely detailed requests)
  if (message.length > 300 && message.includes('?')) {
    return 'complex';
  }

  // Complex: multiple questions in a single message
  const questionCount = (message.match(/\?/g) || []).length;
  if (questionCount >= 2 && moduleCount >= 2) {
    return 'complex';
  }

  return 'moderate';
}

/**
 * Select model based on complexity, agent's base model, and cost awareness.
 * Considers daily budget usage — downgrades to cheaper models when approaching limit.
 *
 * Enhanced with cost-aware routing (Hermes Agent pattern):
 * - When >80% of daily budget used: downgrade complex → moderate tier
 * - When >95%: downgrade all to simple tier
 */
/**
 * Get the effective daily budget limit.
 * Checks per-tenant feature_flags first, falls back to global env var.
 */
const _tenantBudgetCache = new Map<string, { value: number; expiresAt: number }>();

async function getTenantBudgetLimit(): Promise<number> {
  const globalLimit = Number(process.env.MODEL_DAILY_BUDGET_USD ?? '0');
  const slot = process.env.AGENT_SLOT;
  if (!slot) return globalLimit;

  // Cache per-tenant for 5 minutes to avoid DB hits on every message
  const cached = _tenantBudgetCache.get(slot);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  try {
    const sql = getPool();
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      return tx.unsafe(
        `SELECT feature_flags->>'daily_budget_usd' AS budget
         FROM tenants WHERE slug = $1 LIMIT 1`,
        [slot],
      );
    });
    const row = rows[0] as { budget: string | null } | undefined;
    const tenantBudget = row?.budget ? Number(row.budget) : 0;
    const effectiveLimit = tenantBudget > 0 ? tenantBudget : globalLimit;
    _tenantBudgetCache.set(slot, { value: effectiveLimit, expiresAt: Date.now() + 5 * 60_000 });
    return effectiveLimit;
  } catch {
    return globalLimit;
  }
}

export function selectModel(complexity: ComplexityLevel, _agentModel: string): string {
  const budget = getBudget();
  const slot = process.env.AGENT_SLOT ?? '';
  const cachedBudget = slot ? _tenantBudgetCache.get(slot) : undefined;
  const limit = cachedBudget?.value ?? Number(process.env.MODEL_DAILY_BUDGET_USD ?? '0');
  const budgetUsedPct = limit > 0 ? (budget.cost / limit) * 100 : 0;

  // Cost-aware downgrade when approaching budget limit
  let effectiveComplexity = complexity;
  if (budgetUsedPct > 95) {
    effectiveComplexity = 'simple'; // emergency: use cheapest model for everything
  } else if (budgetUsedPct > 80 && complexity === 'complex') {
    effectiveComplexity = 'moderate'; // save budget: don't use expensive model
  }

  // Free-model defaults — used when env vars not configured.
  // Override via MODEL_TIER_SIMPLE / MODEL_TIER_DEFAULT / MODEL_TIER_COMPLEX in .env
  // When OLLAMA_BASE_URL is set, simple tier uses local qwen2.5:3b (free, fast, multilingual).
  const FREE_DEFAULTS: Record<ComplexityLevel, string> = {
    simple: process.env.OLLAMA_BASE_URL ? 'gemma4:e2b' : 'nvidia/nemotron-3-nano-30b-a3b:free',
    moderate: 'qwen/qwen3.6-plus:free',
    complex: 'qwen/qwen3.6-plus:free',
  };

  // Tier env vars override everything; free defaults are fallback.
  // agentModel is the agent's configured base model and is NOT used for tier routing —
  // it exists for non-tiered agents (e.g. task agents with a specific model).
  switch (effectiveComplexity) {
    case 'simple':
      return process.env.MODEL_TIER_SIMPLE ?? FREE_DEFAULTS.simple;
    case 'complex':
      return process.env.MODEL_TIER_COMPLEX ?? FREE_DEFAULTS.complex;
    default:
      return process.env.MODEL_TIER_DEFAULT ?? FREE_DEFAULTS.moderate;
  }
}

// ── Daily budget guard ─────────────────────────────────────────────────────

import { getPool } from '@hawk/db';

interface BudgetState {
  date: string; // YYYY-MM-DD
  tokens: number;
  cost: number;
  llmCalls: number;
  loaded: boolean; // true after hydrating from DB
}

let _budget: BudgetState | null = null;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getBudget(): BudgetState {
  const today = todayDate();
  if (!_budget || _budget.date !== today) {
    _budget = { date: today, tokens: 0, cost: 0, llmCalls: 0, loaded: false };
    // Clear tenant budget cache on day change so it re-fetches
    _tenantBudgetCache.clear();
  }
  return _budget;
}

/**
 * Record token usage and return true if daily budget is exceeded.
 * Checks per-tenant budget from feature_flags, falls back to MODEL_DAILY_BUDGET_USD.
 */
export function trackUsage(tokens: number, costUsd: number): { overBudget: boolean } {
  const budget = getBudget();
  budget.tokens += tokens;
  budget.cost += costUsd;
  if (tokens > 0) budget.llmCalls++;

  // Use cached tenant budget if available, otherwise fall back to env var
  const trackSlot = process.env.AGENT_SLOT ?? '';
  const trackCached = trackSlot ? _tenantBudgetCache.get(trackSlot) : undefined;
  const limit = trackCached?.value ?? Number(process.env.MODEL_DAILY_BUDGET_USD ?? '0');
  const overBudget = limit > 0 && budget.cost >= limit;

  return { overBudget };
}

/**
 * Async version that loads tenant budget from DB before checking.
 * Use this at session start for accurate per-tenant enforcement.
 */
export async function checkBudgetAsync(): Promise<{
  overBudget: boolean;
  limit: number;
  used: number;
}> {
  const limit = await getTenantBudgetLimit();
  const budget = getBudget();
  return { overBudget: limit > 0 && budget.cost >= limit, limit, used: budget.cost };
}

/**
 * Get today's cumulative usage.
 */
export function getDailyUsage(): { tokens: number; cost: number } {
  const budget = getBudget();
  return { tokens: budget.tokens, cost: budget.cost };
}

// ── Persistent usage (admin.tenant_metrics) ────────────────────────────────

/**
 * Load today's usage from admin.tenant_metrics on startup.
 * Prevents losing accumulated cost data when the agent restarts.
 */
export async function loadDailyUsageFromDb(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) return;

  try {
    const sql = getPool();
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      return tx.unsafe(
        `SELECT tokens_used, tokens_cost_usd, api_calls
         FROM tenant_metrics
         WHERE tenant_id = (SELECT id FROM tenants WHERE slug = $1)
           AND date = CURRENT_DATE
         LIMIT 1`,
        [slot],
      );
    });

    const row = rows[0] as Record<string, unknown> | undefined;
    if (row) {
      const budget = getBudget();
      budget.tokens = Number(row.tokens_used ?? 0);
      budget.cost = Number(row.tokens_cost_usd ?? 0);
      budget.llmCalls = Number(row.api_calls ?? 0);
      budget.loaded = true;
      console.log(
        `[model-router] Loaded daily usage from DB: ${budget.tokens} tokens, $${budget.cost.toFixed(4)}`,
      );
    }

    // Pre-load tenant budget limit into cache so sync selectModel() works
    await getTenantBudgetLimit();
  } catch (err) {
    console.warn('[model-router] Could not load daily usage from DB:', err);
  }
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 30_000; // 30 seconds

/**
 * Debounced persist — batches rapid writes into a single DB update.
 */
export function debouncedPersistUsage(): void {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    persistUsage().catch((err) => console.warn('[model-router] Debounced persist failed:', err));
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Persist current daily usage to admin.tenant_metrics.
 * Prefer debouncedPersistUsage() for hot paths.
 */
export async function persistUsage(): Promise<void> {
  const slot = process.env.AGENT_SLOT;
  if (!slot) return;

  const budget = getBudget();
  if (budget.tokens === 0) return;

  try {
    const sql = getPool();
    await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      await tx.unsafe(
        `INSERT INTO tenant_metrics (tenant_id, date, tokens_used, tokens_cost_usd, api_calls)
         SELECT id, CURRENT_DATE, $2, $3, $4
         FROM tenants WHERE slug = $1
         ON CONFLICT (tenant_id, date) DO UPDATE SET
           tokens_used = $2,
           tokens_cost_usd = $3,
           api_calls = $4,
           updated_at = now()`,
        [slot, budget.tokens, budget.cost, budget.llmCalls],
      );
    });
  } catch (err) {
    console.warn('[model-router] Failed to persist usage:', err);
  }
}
