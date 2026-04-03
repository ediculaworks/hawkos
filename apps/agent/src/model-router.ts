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
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'qwen/qwen3.6-plus:free': 1_000_000,
  'nvidia/nemotron-3-super-120b-a12b:free': 262_144,
  'qwen/qwen3-coder:free': 262_000,
  'stepfun/step-3.5-flash:free': 256_000,
  'nvidia/nemotron-3-nano-30b-a3b:free': 256_000,
  'openrouter/free': 200_000,
  'minimax/minimax-m2.5:free': 196_608,
  'openai/gpt-oss-120b:free': 131_072,
  'openai/gpt-oss-20b:free': 131_072,
  'z-ai/glm-4.5-air:free': 131_072,
  'nvidia/nemotron-nano-9b-v2:free': 128_000,
  'meta-llama/llama-3.3-70b-instruct:free': 65_536,
};

const MODELS_WITHOUT_TOOL_CHOICE = new Set([
  'stepfun/step-3.5-flash:free',
  'minimax/minimax-m2.5:free',
  'arcee-ai/trinity-large-preview:free',
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

const COMPLEX_PATTERNS =
  /\b(analis|compar|plan[ei]j|revis|resum|organiz|avali|otimiz|prioriz|estrat[ée]g|diagnostic|correlacion|impacto|tend[êe]ncia|previs[ãa]o)/i;

/**
 * Classify query complexity based on message content and detected modules.
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

  // Complex: long messages with questions (likely detailed requests)
  if (message.length > 300 && message.includes('?')) {
    return 'complex';
  }

  return 'moderate';
}

/**
 * Select model based on complexity and agent's base model.
 * Returns the agent's model if no tier-specific model is configured.
 */
export function selectModel(complexity: ComplexityLevel, agentModel: string): string {
  switch (complexity) {
    case 'simple':
      return process.env.MODEL_TIER_SIMPLE ?? agentModel;
    case 'complex':
      return process.env.MODEL_TIER_COMPLEX ?? agentModel;
    default:
      return process.env.MODEL_TIER_DEFAULT ?? agentModel;
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
  }
  return _budget;
}

/**
 * Record token usage and return true if daily budget is exceeded.
 * Budget limit configured via MODEL_DAILY_BUDGET_USD (default: no limit).
 */
export function trackUsage(tokens: number, costUsd: number): { overBudget: boolean } {
  const budget = getBudget();
  budget.tokens += tokens;
  budget.cost += costUsd;
  if (tokens > 0) budget.llmCalls++;

  const limit = Number(process.env.MODEL_DAILY_BUDGET_USD ?? '0');
  const overBudget = limit > 0 && budget.cost >= limit;

  return { overBudget };
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
