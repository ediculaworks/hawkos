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

import { contextMiddleware } from './context.js';
import { historyMiddleware } from './history.js';
import { llmMiddleware } from './llm.js';
import { messageBuilderMiddleware } from './message-builder.js';
import { persistenceMiddleware } from './persistence.js';
import { routingMiddleware } from './routing.js';
import { securityMiddleware } from './security.js';
import { createHandlerContext, createPipeline } from './types.js';

export { createHandlerContext } from './types.js';
export type { HandlerContext, Middleware, MiddlewareFn } from './types.js';

/**
 * The default middleware pipeline for the agent handler.
 * persistence wraps the entire chain (pre/post processing via next()).
 */
export const defaultPipeline = createPipeline([
  persistenceMiddleware,
  securityMiddleware,
  contextMiddleware,
  historyMiddleware,
  routingMiddleware,
  messageBuilderMiddleware,
  llmMiddleware,
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
}): Promise<PipelineResult> {
  const ctx = createHandlerContext(params);
  await defaultPipeline(ctx);

  if (!ctx.response) {
    throw new Error('Pipeline completed without generating a response');
  }

  return { response: ctx.response, totalTokens: ctx.totalTokens, selectedModel: ctx.selectedModel };
}
