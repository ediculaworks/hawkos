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

const SIMPLE_WORDS = new Set([
  'ola', 'olá', 'oi', 'hey', 'bom dia', 'boa noite', 'boa tarde',
  'obrigado', 'obrigada', 'valeu', 'ok', 'sim', 'nao', 'não',
  'tudo bem', 'tchau', 'bye',
]);

function isSimpleGreeting(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[!.,?]/g, '').trim();
  return SIMPLE_WORDS.has(normalized);
}

const COMPLEX_PATTERNS =
  /\b(analis|compar|plan[ei]j|revis|resum|organiz|avali|otimiz|prioriz|estrat[ée]g|diagnostic|correlacion|impacto|tend[êe]ncia|previs[ãa]o)/i;

/**
 * Classify query complexity based on message content and detected modules.
 */
export function classifyComplexity(
  message: string,
  moduleCount: number,
): ComplexityLevel {
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
export function selectModel(
  complexity: ComplexityLevel,
  agentModel: string,
): string {
  switch (complexity) {
    case 'simple':
      return process.env.MODEL_TIER_SIMPLE ?? agentModel;
    case 'complex':
      return process.env.MODEL_TIER_COMPLEX ?? agentModel;
    default:
      return process.env.MODEL_TIER_DEFAULT ?? agentModel;
  }
}
