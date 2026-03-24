import type { Hook } from './types.js';

/**
 * Built-in hook: Send tool calls to WebSocket chat client for visualization.
 */
export const toolCallWebSocketHook: Hook = {
  name: 'tool-call-ws',
  event: 'tool:after',
  priority: 5,
  handler: async (ctx) => {
    if (!ctx.sessionId || !ctx.toolName) return;
    try {
      const { sendToolCallToClient } = await import('../api/server.js');
      sendToolCallToClient(
        ctx.sessionId as string,
        ctx.toolName as string,
        (ctx.toolArgs as Record<string, unknown>) ?? {},
        (ctx.toolResult as string) ?? '',
        ctx.durationMs as number | undefined,
      );
    } catch {
      // server not available
    }
  },
};

/**
 * Built-in hook: Log tool execution to console for debugging.
 */
export const toolLoggerHook: Hook = {
  name: 'tool-logger',
  event: 'tool:after',
  priority: 99,
  handler: async (ctx) => {
    const duration = ctx.durationMs ? ` (${ctx.durationMs}ms)` : '';
    console.log(
      `[hook:tool-logger] ${ctx.toolName}${duration}: ${(ctx.toolResult as string)?.slice(0, 100)}`,
    );
  },
};

/**
 * Built-in hook: Track session start for analytics.
 */
export const sessionStartHook: Hook = {
  name: 'session-start-tracker',
  event: 'session:start',
  priority: 1,
  handler: async (ctx) => {
    console.log(`[hook:session-start] Session ${ctx.sessionId} started on ${ctx.channel}`);
  },
};

/**
 * Built-in hook: On session end, trigger memory extraction.
 */
export const sessionEndMemoryHook: Hook = {
  name: 'session-end-memory',
  event: 'session:end',
  priority: 5,
  handler: async (ctx) => {
    if (!ctx.sessionId) return;
    try {
      const { commitSession } = await import('@hawk/module-memory/session-commit');
      await commitSession(ctx.sessionId);
      console.log(`[hook:session-end-memory] Session ${ctx.sessionId} committed`);
    } catch (err) {
      console.error('[hook:session-end-memory] Failed to commit session:', err);
    }
  },
};
