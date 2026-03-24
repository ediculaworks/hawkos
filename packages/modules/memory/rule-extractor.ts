import type { MemoryCandidate } from './deduplicator';

/**
 * C4: Rule-Based Memory Extraction
 *
 * Extracts memory candidates from conversation text using pattern
 * matching instead of LLM calls. Covers ~60% of common cases:
 *
 * - Profile: "eu sou X", "meu nome é X", "tenho X anos"
 * - Preference: "prefiro X", "gosto de X", "não gosto de X"
 * - Event: temporal markers + facts ("comecei X", "mudei para X")
 * - Procedure: corrections ("não faça X", "sempre use Y", "da próxima vez")
 *
 * For complex/ambiguous cases, falls back to LLM extraction.
 * The extracted candidates go through the same dedup pipeline.
 */

// ── Pattern Definitions ────────────────────────────────────

type ExtractionRule = {
  pattern: RegExp;
  memoryType: MemoryCandidate['memory_type'];
  module: string | null;
  importance: number;
  transform?: (match: RegExpMatchArray, fullText: string) => string;
};

// Profile patterns — identity, attributes, roles
const PROFILE_RULES: ExtractionRule[] = [
  {
    pattern: /\b(?:eu\s+)?sou\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'profile',
    module: null,
    importance: 7,
    transform: (m) => `Usuário é ${m[1]?.trim()}`,
  },
  {
    pattern: /\bmeu\s+nome\s+(?:é|eh)\s+(.{2,40}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'profile',
    module: null,
    importance: 8,
    transform: (m) => `Nome do usuário: ${m[1]?.trim()}`,
  },
  {
    pattern: /\btenho\s+(\d{1,3})\s+anos\b/i,
    memoryType: 'profile',
    module: null,
    importance: 6,
    transform: (m) => `Usuário tem ${m[1]} anos`,
  },
  {
    pattern: /\btrabalho\s+(?:com|como|na|no|em)\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'profile',
    module: 'career',
    importance: 7,
    transform: (m) => `Trabalha com/como ${m[1]?.trim()}`,
  },
  {
    pattern: /\bmoro\s+(?:em|no|na)\s+(.{3,50}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'profile',
    module: 'housing',
    importance: 6,
    transform: (m) => `Mora em ${m[1]?.trim()}`,
  },
];

// Preference patterns — likes, dislikes, preferences
const PREFERENCE_RULES: ExtractionRule[] = [
  {
    pattern: /\b(?:eu\s+)?prefiro\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'preference',
    module: null,
    importance: 5,
    transform: (m) => `Preferência: ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:eu\s+)?gosto\s+(?:muito\s+)?de\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'preference',
    module: null,
    importance: 5,
    transform: (m) => `Gosta de ${m[1]?.trim()}`,
  },
  {
    pattern: /\bnão\s+gosto\s+de\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'preference',
    module: null,
    importance: 5,
    transform: (m) => `Não gosta de ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:eu\s+)?(?:odeio|detesto)\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'preference',
    module: null,
    importance: 6,
    transform: (m) => `Detesta ${m[1]?.trim()}`,
  },
  {
    pattern: /\bsempre\s+(?:uso|faço|como|bebo|tomo)\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'preference',
    module: null,
    importance: 5,
    transform: (m) => `Sempre ${m[0]?.trim()}`,
  },
];

// Event patterns — things that happened, decisions, milestones
const EVENT_RULES: ExtractionRule[] = [
  {
    pattern: /\b(?:comecei|iniciei)\s+(?:a\s+)?(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'event',
    module: null,
    importance: 6,
    transform: (m) => `Começou: ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:parei|larguei|desisti)\s+(?:de\s+)?(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'event',
    module: null,
    importance: 6,
    transform: (m) => `Parou de: ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:mudei|troquei)\s+(?:de|para)\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'event',
    module: null,
    importance: 6,
    transform: (m) => `Mudou para: ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:comprei|adquiri)\s+(.{3,60}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'event',
    module: 'assets',
    importance: 5,
    transform: (m) => `Comprou: ${m[1]?.trim()}`,
  },
  {
    pattern: /\b(?:fui\s+(?:promovido|demitido|contratado))\b(.{0,40}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'event',
    module: 'career',
    importance: 8,
    transform: (m) => `Carreira: ${m[0]?.trim()}`,
  },
];

// Procedure patterns — corrections, learned rules
const PROCEDURE_RULES: ExtractionRule[] = [
  {
    pattern: /\bnão\s+(?:faça|faz|use|manda|envia)\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'procedure',
    module: null,
    importance: 8,
    transform: (m) => `REGRA: Não ${m[0]?.trim().replace(/^não\s+/i, '')}`,
  },
  {
    pattern: /\bda\s+próxima\s+vez\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'procedure',
    module: null,
    importance: 8,
    transform: (m) => `REGRA: Da próxima vez ${m[1]?.trim()}`,
  },
  {
    pattern: /\bsempre\s+(?:que|quando)\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'procedure',
    module: null,
    importance: 7,
    transform: (m) => `REGRA: Sempre que ${m[1]?.trim()}`,
  },
  {
    pattern: /\blembra\s+(?:que|de)\s+(.{3,80}?)(?:\.|,|!|\?|$)/i,
    memoryType: 'procedure',
    module: null,
    importance: 7,
    transform: (m) => `Lembrar: ${m[1]?.trim()}`,
  },
];

// Module detection from content
const MODULE_KEYWORDS: Record<string, string> = {
  treino: 'health',
  academia: 'health',
  sono: 'health',
  remédio: 'health',
  medicação: 'health',
  gasto: 'finances',
  salário: 'finances',
  investimento: 'finances',
  hábito: 'routine',
  rotina: 'routine',
  streak: 'routine',
  meta: 'objectives',
  objetivo: 'objectives',
  projeto: 'objectives',
  contato: 'people',
  amigo: 'people',
  família: 'people',
};

// ── Extraction Engine ──────────────────────────────────────

const ALL_RULES = [...PROFILE_RULES, ...PREFERENCE_RULES, ...EVENT_RULES, ...PROCEDURE_RULES];

/**
 * Detect module from content keywords.
 */
function detectModule(content: string, ruleModule: string | null): string | null {
  if (ruleModule) return ruleModule;
  const lower = content.toLowerCase();
  for (const [keyword, module] of Object.entries(MODULE_KEYWORDS)) {
    if (lower.includes(keyword)) return module;
  }
  return null;
}

/**
 * Extract memory candidates from user messages using rule-based patterns.
 *
 * Process:
 * 1. Extract only user messages from transcript
 * 2. Apply each pattern rule against each user message
 * 3. Deduplicate by content similarity (simple string overlap)
 * 4. Return candidates ready for the dedup pipeline
 *
 * Returns: candidates extracted by rules + boolean indicating if
 * LLM fallback should still be used (for complex conversations).
 */
export function extractMemoriesByRules(transcript: string): {
  candidates: MemoryCandidate[];
  needsLlmFallback: boolean;
} {
  // Extract user messages only
  const userMessages = transcript
    .split('\n\n')
    .filter((block) => block.startsWith('[User]:'))
    .map((block) => block.replace(/^\[User\]:\s*/, ''));

  if (userMessages.length === 0) {
    return { candidates: [], needsLlmFallback: false };
  }

  const candidates: MemoryCandidate[] = [];
  const seenContent = new Set<string>();

  for (const message of userMessages) {
    // Skip very short messages (commands, greetings)
    if (message.length < 15) continue;

    for (const rule of ALL_RULES) {
      const match = message.match(rule.pattern);
      if (!match) continue;

      const content = rule.transform
        ? rule.transform(match, message)
        : (match[1]?.trim() ?? match[0]?.trim() ?? '');

      if (!content || content.length < 5) continue;

      // Simple dedup: skip if we've seen very similar content
      const contentKey = content.toLowerCase().slice(0, 40);
      if (seenContent.has(contentKey)) continue;
      seenContent.add(contentKey);

      const module = detectModule(content, rule.module);

      candidates.push({
        content,
        memory_type: rule.memoryType,
        module,
        importance: rule.importance,
      });
    }
  }

  // Determine if LLM fallback is needed:
  // If conversation is long and we extracted few memories, LLM might find more
  const messageCount = userMessages.length;
  const needsLlmFallback = messageCount >= 5 && candidates.length < 2;

  return { candidates, needsLlmFallback };
}
