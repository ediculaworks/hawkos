/**
 * Middleware chain types for the agent handler pipeline.
 * Inspired by DeerFlow's 10-middleware chain pattern.
 *
 * Each middleware receives a HandlerContext and a next() function.
 * It can modify the context before/after calling next().
 */

import type { AssembledContext } from '@hawk/context-engine';
import type OpenAI from 'openai';
import type { ResolvedAgent } from '../agent-resolver.js';
import type { SessionCost } from '../cost-tracker.js';
import type { Attachment } from '../handler.js';
import type { ComplexityLevel } from '../model-router.js';
import type { ToolDefinition } from '../tools/types.js';

// ── Handler Context ─────────────────────────────────────────────────

export interface HandlerContext {
  // ── Input (set by caller, immutable) ──────────────────────
  readonly sessionId: string;
  readonly originalMessage: string;
  readonly channel: 'discord' | 'web';
  readonly agent: ResolvedAgent;
  readonly isNewSession: boolean;
  readonly attachments?: Attachment[];
  readonly onChunk?: (chunk: string) => void;
  /** Per-tenant OpenRouter API key — overrides global env key when set */
  readonly tenantApiKey?: string;

  // ── Security (set by security middleware) ──────────────────
  sanitizedMessage: string;

  // ── Context (set by context middleware) ─────────────────────
  context: AssembledContext;
  memories: Array<{
    id: string;
    content: string;
    category: string;
    memory_type?: string;
  }>;
  previousSession: { abstract: string; overview: string } | null;
  contextSection: string;

  // ── History (set by history middleware) ──────────────────────
  history: Array<{ role: string; content: string }>;

  // ── Routing (set by routing middleware) ─────────────────────
  allowedModules: string[];
  filteredTools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, ToolDefinition>;
  complexity: ComplexityLevel;
  selectedModel: string;
  isComplexQuery: boolean;

  // ── Messages (set by message-builder middleware) ────────────
  messages: OpenAI.ChatCompletionMessageParam[];

  // ── LLM Result (set by llm middleware) ─────────────────────
  response: string | null;
  /** True when intent-classifier.ts short-circuited; LLM middleware skips */
  shortCircuited: boolean;
  toolsUsed: string[];
  totalTokens: number;

  // ── Cost (set by cost middleware) ──────────────────────────
  sessionCost: SessionCost | null;

  // ── Tracing (set by pipeline runner) ───────────────────────
  traceId: string;
  spans: Array<{
    name: string;
    startMs: number;
    endMs: number;
    metadata?: Record<string, unknown>;
  }>;
}

// ── Middleware Type ──────────────────────────────────────────────────

export type MiddlewareFn = (ctx: HandlerContext, next: () => Promise<void>) => Promise<void>;

export interface Middleware {
  name: string;
  execute: MiddlewareFn;
}

// ── Pipeline Runner ─────────────────────────────────────────────────

export function createPipeline(middlewares: Middleware[]): (ctx: HandlerContext) => Promise<void> {
  return async (ctx: HandlerContext) => {
    let index = 0;

    async function next(): Promise<void> {
      if (index >= middlewares.length) return;
      const mw = middlewares[index++]!;
      await mw.execute(ctx, next);
    }

    await next();
  };
}

// ── Context Factory ─────────────────────────────────────────────────

export function createHandlerContext(params: {
  sessionId: string;
  userMessage: string;
  channel: 'discord' | 'web';
  agent: ResolvedAgent;
  isNewSession: boolean;
  onChunk?: (chunk: string) => void;
  attachments?: Attachment[];
  tenantApiKey?: string;
}): HandlerContext {
  return {
    sessionId: params.sessionId,
    originalMessage: params.userMessage,
    channel: params.channel,
    agent: params.agent,
    isNewSession: params.isNewSession,
    attachments: params.attachments,
    onChunk: params.onChunk,
    tenantApiKey: params.tenantApiKey,

    sanitizedMessage: params.userMessage,

    context: { l0: '', l1: '', l2: '', modulesLoaded: [], relevanceScores: [] },
    memories: [],
    previousSession: null,
    contextSection: '',

    history: [],

    allowedModules: [],
    filteredTools: [],
    toolMap: new Map(),
    complexity: 'simple',
    selectedModel: params.agent.model,
    isComplexQuery: false,

    messages: [],

    response: null,
    shortCircuited: false,
    toolsUsed: [],
    totalTokens: 0,

    sessionCost: null,

    traceId: crypto.randomUUID(),
    spans: [],
  };
}
