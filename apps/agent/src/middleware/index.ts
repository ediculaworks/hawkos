/**
 * Agent handler middleware pipeline.
 * Decomposes the monolithic handler into composable, testable stages.
 *
 * Pipeline order:
 * 1. persistence (pre: save user msg + hooks) →
 * 2. security (sanitize input) →
 * 3. context (load L0/L1/L2, memories, previous session) →
 * 4. history (load session messages) →
 * 5. routing (module detection, tool filtering, model selection) →
 * 6. message-builder (assemble messages array, compression) →
 * 7. llm (LLM call + tool loop) →
 * 8. persistence (post: save response, log activity)
 */

import { metrics } from '../metrics.js';
import { contextMiddleware } from './context.js';
import { historyMiddleware } from './history.js';
import { llmMiddleware } from './llm.js';
import { messageBuilderMiddleware } from './message-builder.js';
import { persistenceMiddleware } from './persistence.js';
import { routingMiddleware } from './routing.js';
import { securityMiddleware } from './security.js';
import { createHandlerContext, createPipeline } from './types.js';
import type { Middleware } from './types.js';

export { createHandlerContext } from './types.js';
export type { HandlerContext, Middleware, MiddlewareFn } from './types.js';

/**
 * Wraps a middleware with Prometheus timing, error counting, and span recording.
 */
function instrument(name: string, mw: Middleware): Middleware {
  return {
    name: mw.name,
    execute: async (ctx, next) => {
      const startMs = performance.now();
      try {
        await mw.execute(ctx, next);
        const endMs = performance.now();
        const durationSeconds = (endMs - startMs) / 1000;
        metrics.observeHistogram('hawk_pipeline_latency_seconds', durationSeconds, { stage: name });
        ctx.spans.push({ name, startMs, endMs });
      } catch (err) {
        const endMs = performance.now();
        ctx.spans.push({ name, startMs, endMs, metadata: { error: String(err) } });
        metrics.incCounter('hawk_errors_total', { component: name, code: 'middleware_error' });
        throw err;
      }
    },
  };
}

/**
 * The default middleware pipeline for the agent handler.
 * persistence wraps the entire chain (pre/post processing via next()).
 */
export const defaultPipeline = createPipeline([
  instrument('persistence', persistenceMiddleware),
  instrument('security', securityMiddleware),
  instrument('context', contextMiddleware),
  instrument('history', historyMiddleware),
  instrument('routing', routingMiddleware),
  instrument('message_builder', messageBuilderMiddleware),
  instrument('llm', llmMiddleware),
]);

export interface PipelineResult {
  response: string;
  totalTokens: number;
  selectedModel: string;
}

/**
 * Run the handler pipeline for a given set of params.
 * Returns the LLM response along with token usage and selected model.
 */
export async function runPipeline(params: {
  sessionId: string;
  userMessage: string;
  channel: 'discord' | 'web';
  agent: import('../agent-resolver.js').ResolvedAgent;
  isNewSession: boolean;
  onChunk?: (chunk: string) => void;
  attachments?: import('../handler.js').Attachment[];
  tenantApiKey?: string;
  tenantLLMChain?: import('../providers.js').ChainEntry[];
  tenantProviderKeys?: Map<string, string>;
}): Promise<PipelineResult> {
  metrics.incCounter('hawk_messages_total', { channel: params.channel });
  metrics.incGauge('hawk_active_sessions');

  const ctx = createHandlerContext(params);
  try {
    await defaultPipeline(ctx);
  } finally {
    metrics.decGauge('hawk_active_sessions');
  }

  if (!ctx.response) {
    throw new Error('Pipeline completed without generating a response');
  }

  return { response: ctx.response, totalTokens: ctx.totalTokens, selectedModel: ctx.selectedModel };
}
