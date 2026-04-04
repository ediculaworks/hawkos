/**
 * Context References — @file and @url with token budgets.
 *
 * Parses user messages for @file:path and @url:endpoint references,
 * fetches content, and injects into context with hard/soft token limits.
 *
 * Inspired by Hermes Agent's context references pattern.
 *
 * Syntax:
 *   @file:path/to/file.txt         — inject file contents
 *   @url:https://example.com/api   — fetch and inject URL content
 *   @memory:search query            — inject matching memories
 *
 * Budget enforcement:
 *   - Soft limit: truncate content with "[truncated]" marker
 *   - Hard limit: reject reference entirely with warning
 */

import { createLogger } from '@hawk/shared';

const logger = createLogger('context-refs');

// ── Types ────────────────────────────────────────────────────────────────────

export type ReferenceType = 'file' | 'url' | 'memory';

export interface ContextReference {
  type: ReferenceType;
  target: string; // file path, URL, or search query
  raw: string; // original @ref string from message
}

export interface ResolvedReference {
  ref: ContextReference;
  content: string;
  tokenEstimate: number;
  truncated: boolean;
  error?: string;
}

export interface TokenBudget {
  /** Max tokens for all references combined */
  totalBudget: number;
  /** Max tokens per individual reference (soft limit — truncates) */
  perRefSoftLimit: number;
  /** Hard limit per reference (rejects entirely if exceeded before truncation) */
  perRefHardLimit: number;
}

const DEFAULT_BUDGET: TokenBudget = {
  totalBudget: 4000, // ~16K chars
  perRefSoftLimit: 2000, // ~8K chars per ref
  perRefHardLimit: 8000, // ~32K chars — reject raw content this large
};

// ── Reference Parsing ────────────────────────────────────────────────────────

const REF_PATTERN = /@(file|url|memory):([^\s]+)/g;

/**
 * Extract @references from a user message.
 * Returns the cleaned message (refs removed) and list of references.
 */
export function extractReferences(message: string): {
  cleanedMessage: string;
  references: ContextReference[];
} {
  const references: ContextReference[] = [];
  const cleanedMessage = message
    .replace(REF_PATTERN, (match, type, target) => {
      references.push({ type: type as ReferenceType, target, raw: match });
      return ''; // remove ref from message
    })
    .trim();

  return { cleanedMessage, references };
}

// ── Reference Resolution ─────────────────────────────────────────────────────

/**
 * Resolve all references and enforce token budgets.
 * Returns resolved content ready for injection into LLM context.
 */
export async function resolveReferences(
  references: ContextReference[],
  budget: TokenBudget = DEFAULT_BUDGET,
  resolvers?: {
    readFile?: (path: string) => Promise<string>;
    fetchUrl?: (url: string) => Promise<string>;
    searchMemories?: (query: string) => Promise<string>;
  },
): Promise<ResolvedReference[]> {
  const results: ResolvedReference[] = [];
  let totalTokensUsed = 0;

  for (const ref of references) {
    // Check if we've exceeded total budget
    if (totalTokensUsed >= budget.totalBudget) {
      results.push({
        ref,
        content: `[Budget exceeded — reference @${ref.type}:${ref.target} skipped]`,
        tokenEstimate: 0,
        truncated: false,
        error: 'Total token budget exceeded',
      });
      continue;
    }

    try {
      let rawContent = '';

      switch (ref.type) {
        case 'file':
          rawContent = resolvers?.readFile
            ? await resolvers.readFile(ref.target)
            : `[File reading not available: ${ref.target}]`;
          break;
        case 'url':
          rawContent = resolvers?.fetchUrl
            ? await resolvers.fetchUrl(ref.target)
            : `[URL fetching not available: ${ref.target}]`;
          break;
        case 'memory':
          rawContent = resolvers?.searchMemories
            ? await resolvers.searchMemories(ref.target)
            : '[Memory search not available]';
          break;
      }

      const rawTokens = estimateTokens(rawContent);

      // Hard limit: reject if raw content is way too large
      if (rawTokens > budget.perRefHardLimit) {
        results.push({
          ref,
          content: `[Reference @${ref.type}:${ref.target} too large (${rawTokens} tokens, limit ${budget.perRefHardLimit})]`,
          tokenEstimate: 20,
          truncated: false,
          error: `Content exceeds hard limit: ${rawTokens} > ${budget.perRefHardLimit}`,
        });
        totalTokensUsed += 20;
        continue;
      }

      // Soft limit: truncate if needed
      const remainingBudget = budget.totalBudget - totalTokensUsed;
      const effectiveLimit = Math.min(budget.perRefSoftLimit, remainingBudget);
      let content = rawContent;
      let truncated = false;

      if (rawTokens > effectiveLimit) {
        const charLimit = effectiveLimit * 4; // ~4 chars per token
        content = `${rawContent.slice(0, charLimit)}\n\n[... truncated, ${rawTokens - effectiveLimit} tokens omitted]`;
        truncated = true;
      }

      const tokenEstimate = estimateTokens(content);
      totalTokensUsed += tokenEstimate;

      results.push({ ref, content, tokenEstimate, truncated });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.warn({ ref: ref.raw, err: errorMsg }, 'Failed to resolve context reference');
      results.push({
        ref,
        content: `[Error loading @${ref.type}:${ref.target}: ${errorMsg}]`,
        tokenEstimate: 15,
        truncated: false,
        error: errorMsg,
      });
      totalTokensUsed += 15;
    }
  }

  return results;
}

/**
 * Format resolved references as a context section for the LLM.
 */
export function formatReferencesAsContext(resolved: ResolvedReference[]): string {
  if (resolved.length === 0) return '';

  const parts = resolved.map((r) => {
    const header = `### @${r.ref.type}:${r.ref.target}${r.truncated ? ' [truncated]' : ''}`;
    return `${header}\n${r.content}`;
  });

  return `## Referências do contexto\n\n${parts.join('\n\n---\n\n')}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
