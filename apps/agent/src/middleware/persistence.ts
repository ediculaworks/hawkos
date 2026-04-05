/**
 * Persistence middleware — saves messages and logs activity.
 * Runs as post-processing after LLM response.
 */

import { saveMessage } from '@hawk/module-memory/queries';
import { logActivity } from '../activity-logger.js';
import { hookRegistry } from '../hooks/index.js';
import { persistUsage } from '../model-router.js';
import type { HandlerContext, Middleware } from './types.js';

export const persistenceMiddleware: Middleware = {
  name: 'persistence',
  execute: async (ctx: HandlerContext, next) => {
    // Save user message
    await saveMessage({
      session_id: ctx.sessionId,
      role: 'user',
      content: ctx.originalMessage,
      channel: ctx.channel,
    }).catch((err) => console.error('[persistence] Failed to save user message:', err));

    // Emit hooks
    if (ctx.isNewSession) {
      hookRegistry
        .emit('session:start', { sessionId: ctx.sessionId, channel: ctx.channel })
        .catch(() => {});
    }
    hookRegistry
      .emit('message:received', {
        sessionId: ctx.sessionId,
        channel: ctx.channel,
        message: ctx.originalMessage,
      })
      .catch(() => {});

    // Run the rest of the pipeline (context, routing, LLM, etc.)
    await next();

    // ── Post-processing (after LLM response) ─────────────────

    if (!ctx.response) return;

    // Save assistant response
    await saveMessage({
      session_id: ctx.sessionId,
      role: 'assistant',
      content: ctx.response,
      channel: ctx.channel,
      ...(ctx.totalTokens > 0 ? { tokens_used: ctx.totalTokens } : {}),
    }).catch((err) =>
      console.error('[middleware:persistence] Failed to save assistant message:', err),
    );

    // Log tools used
    if (ctx.toolsUsed.length > 0) {
      logActivity('module_detection', `Tools used: ${ctx.toolsUsed.join(', ')}`, undefined, {
        phase: 'post_session',
        detected_modules: ctx.allowedModules,
        tools_used: ctx.toolsUsed,
        session_id: ctx.sessionId,
      }).catch((err) => console.warn('[middleware:persistence] Failed to log tools:', err));
    }

    // Log session cost
    if (ctx.sessionCost) {
      logActivity(
        'session_cost',
        `tokens=${ctx.sessionCost.totalTokens} calls=${ctx.sessionCost.llmCalls} tools=${ctx.sessionCost.toolCalls}`,
        undefined,
        {
          ...ctx.sessionCost,
          session_id: ctx.sessionId,
          is_complex: ctx.isComplexQuery,
        },
      ).catch((err) => console.warn('[middleware:persistence] Failed to log session cost:', err));
      persistUsage().catch((err) =>
        console.warn('[middleware:persistence] Failed to persist usage:', err),
      );
    }

    // Persist trace spans for observability
    if (ctx.spans.length > 0) {
      logActivity('session_cost', `trace=${ctx.traceId} spans=${ctx.spans.length}`, undefined, {
        trace_id: ctx.traceId,
        spans: ctx.spans.map((s) => ({
          name: s.name,
          duration_ms: Math.round(s.endMs - s.startMs),
          ...(s.metadata ? { metadata: s.metadata } : {}),
        })),
        session_id: ctx.sessionId,
      }).catch(() => {});
    }

    // Emit hook
    hookRegistry
      .emit('message:sent', {
        sessionId: ctx.sessionId,
        channel: ctx.channel,
        message: ctx.response,
      })
      .catch(() => {});
  },
};
