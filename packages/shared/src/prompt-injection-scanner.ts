/**
 * Prompt Injection Scanner — 14 regex patterns + unicode detection
 * to detect prompt injection attempts in user messages and context files.
 *
 * Inspired by Hermes Agent's injection scanning system.
 * Scans for common prompt override techniques, role hijacking,
 * delimiter injection, and unicode-based obfuscation.
 */

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ScanResult {
  threatLevel: ThreatLevel;
  score: number; // 0-100
  matchedPatterns: string[];
  hasSuspiciousUnicode: boolean;
}

interface InjectionPattern {
  name: string;
  pattern: RegExp;
  weight: number; // 1-25 — how dangerous this pattern is
}

// ── Injection Patterns ───────────────────────────────────────────────────────

const INJECTION_PATTERNS: InjectionPattern[] = [
  // ── Role hijacking ──────────────────────────────────────────────────
  {
    name: 'system_role_override',
    pattern:
      /\b(?:you are now|you're now|from now on you are|act as if you were|pretend (?:to be|you're)|assume the role of|new instructions?:)\b/gi,
    weight: 20,
  },
  {
    name: 'ignore_previous',
    pattern:
      /\b(?:ignore (?:all |your )?(?:previous|prior|above|earlier) (?:instructions?|prompts?|rules?|context)|disregard (?:everything|all|your)|forget (?:everything|all|your (?:instructions?|rules?)))\b/gi,
    weight: 25,
  },
  {
    name: 'role_assertion',
    pattern: /\[(?:system|SYSTEM)\]|\{\{system\}\}|<\|?system\|?>|<<SYS>>|<\/?s(?:ys)?>/gi,
    weight: 25,
  },

  // ── Delimiter injection ─────────────────────────────────────────────
  {
    name: 'delimiter_injection',
    pattern:
      /---\s*(?:SYSTEM|END|BEGIN|NEW)\s*---|={3,}\s*(?:SYSTEM|INSTRUCTIONS?)\s*={3,}|###\s*(?:OVERRIDE|SYSTEM|NEW INSTRUCTIONS?)\s*###/gi,
    weight: 20,
  },
  {
    name: 'markdown_role_block',
    pattern: /```(?:system|instructions?|override|admin)[\s\S]*?```/gi,
    weight: 15,
  },

  // ── Data exfiltration ───────────────────────────────────────────────
  {
    name: 'data_exfiltration',
    pattern:
      /\b(?:output|print|show|display|reveal|tell me|repeat|echo)\b.*\b(?:system prompt|instructions?|api ?key|token|password|secret|credentials?)\b/gi,
    weight: 15,
  },
  {
    name: 'url_exfiltration',
    pattern: /!\[.*?\]\(https?:\/\/[^\s)]+\?(?:.*=)?(?:\{\{|%7B%7B)/gi,
    weight: 20,
  },

  // ── Jailbreak techniques ────────────────────────────────────────────
  {
    name: 'do_anything_now',
    pattern:
      /\b(?:DAN|do anything now|jailbreak|uncensored mode|developer mode|god mode|sudo mode|unrestricted mode)\b/gi,
    weight: 15,
  },
  {
    name: 'hypothetical_bypass',
    pattern:
      /\b(?:hypothetical(?:ly)?|in a fictional|imagine you (?:have no|don't have|aren't bound)|if you (?:had no|didn't have) (?:rules|restrictions|limits|guidelines))\b/gi,
    weight: 10,
  },

  // ── Encoding evasion ────────────────────────────────────────────────
  {
    name: 'base64_payload',
    pattern: /(?:decode|base64|atob|eval)\s*\(\s*['"`][A-Za-z0-9+/=]{40,}['"`]\s*\)/gi,
    weight: 20,
  },
  {
    name: 'hex_encoded_injection',
    pattern: /(?:\\x[0-9a-fA-F]{2}){8,}|(?:%[0-9a-fA-F]{2}){8,}/g,
    weight: 10,
  },

  // ── Prompt leaking ──────────────────────────────────────────────────
  {
    name: 'prompt_leaking',
    pattern:
      /\b(?:what (?:are|is) your (?:system )?(?:prompt|instructions?)|show (?:me )?your (?:system )?(?:prompt|instructions?|rules)|(?:full|complete|entire) (?:system )?prompt)\b/gi,
    weight: 10,
  },

  // ── Multi-turn manipulation ─────────────────────────────────────────
  {
    name: 'conversation_history_manipulation',
    pattern:
      /\b(?:the (?:previous|last) (?:assistant|AI|bot) (?:message|response) (?:was|said)|(?:earlier|before) you (?:said|told me|agreed))\b/gi,
    weight: 10,
  },
  {
    name: 'authority_claim',
    pattern:
      /\b(?:I am (?:the|an?) (?:admin|developer|owner|creator|operator)|admin override|maintenance mode|debug mode|authorized (?:user|admin))\b/gi,
    weight: 15,
  },
];

// ── Unicode Detection ────────────────────────────────────────────────────────

// Suspicious unicode categories that can be used for visual spoofing
const SUSPICIOUS_UNICODE_RANGES: [number, number, string][] = [
  [0x200b, 0x200f, 'zero-width characters'], // Zero-width space, joiner, non-joiner
  [0x2028, 0x2029, 'line/paragraph separators'], // Line/paragraph separators
  [0x202a, 0x202e, 'bidi override characters'], // Bidi overrides
  [0x2060, 0x2064, 'invisible operators'], // Word joiner, invisible operators
  [0x2066, 0x2069, 'bidi isolate characters'], // Bidi isolates
  [0xfeff, 0xfeff, 'byte order mark'], // BOM
  [0xfff9, 0xfffb, 'interlinear annotation'], // Annotation anchors
  [0xe0001, 0xe007f, 'tag characters'], // Tags
];

function detectSuspiciousUnicode(text: string): { found: boolean; categories: string[] } {
  const categories = new Set<string>();

  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i);
    if (code === undefined) continue;

    for (const [start, end, category] of SUSPICIOUS_UNICODE_RANGES) {
      if (code >= start && code <= end) {
        categories.add(category);
      }
    }

    // Skip surrogate pair second half
    if (code > 0xffff) i++;
  }

  return { found: categories.size > 0, categories: [...categories] };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan text for prompt injection attempts.
 * Returns threat level, score (0-100), and matched pattern names.
 */
export function scanForInjection(text: string): ScanResult {
  if (!text)
    return { threatLevel: 'none', score: 0, matchedPatterns: [], hasSuspiciousUnicode: false };

  let totalWeight = 0;
  const matchedPatterns: string[] = [];

  for (const { name, pattern, weight } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      totalWeight += weight;
      matchedPatterns.push(name);
    }
  }

  const unicode = detectSuspiciousUnicode(text);
  if (unicode.found) {
    totalWeight += 10;
    matchedPatterns.push(...unicode.categories.map((c) => `unicode:${c}`));
  }

  // Clamp score to 0-100
  const score = Math.min(100, totalWeight);

  let threatLevel: ThreatLevel;
  if (score === 0) threatLevel = 'none';
  else if (score <= 15) threatLevel = 'low';
  else if (score <= 35) threatLevel = 'medium';
  else if (score <= 60) threatLevel = 'high';
  else threatLevel = 'critical';

  return {
    threatLevel,
    score,
    matchedPatterns,
    hasSuspiciousUnicode: unicode.found,
  };
}

/**
 * Strip suspicious unicode characters from text (zero-width, bidi overrides, etc).
 * Use on user input before processing.
 */
export function stripSuspiciousUnicode(text: string): string {
  if (!text) return text;

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i);
    if (code === undefined) continue;

    let suspicious = false;
    for (const [start, end] of SUSPICIOUS_UNICODE_RANGES) {
      if (code >= start && code <= end) {
        suspicious = true;
        break;
      }
    }

    if (!suspicious) {
      result += String.fromCodePoint(code);
    }

    // Skip surrogate pair second half
    if (code > 0xffff) i++;
  }

  return result;
}
