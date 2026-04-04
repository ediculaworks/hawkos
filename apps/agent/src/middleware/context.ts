/**
 * Context middleware — loads L0/L1/L2 context, memories, and previous session.
 * Each component fails independently (fault isolation).
 */

import { assembleContext } from '@hawk/context-engine';
import { retrieveMemories, trackMemoryAccess } from '@hawk/module-memory/retrieval';
import { getLastSessionArchive } from '@hawk/module-memory/session-commit';
import { HawkErrorCode, createLogger, getFeatureFlag, redactSecrets } from '@hawk/shared';
import { logActivity } from '../activity-logger.js';
import type { HandlerContext, Middleware } from './types.js';

const logger = createLogger('middleware:context');

export const contextMiddleware: Middleware = {
  name: 'context',
  execute: async (ctx: HandlerContext, next) => {
    // Load all context sources in parallel with fault isolation
    const [contextResult, memoriesResult, previousSessionResult] = await Promise.allSettled([
      assembleContext(ctx.sanitizedMessage),
      retrieveMemories(ctx.sanitizedMessage, 5),
      ctx.isNewSession ? getLastSessionArchive(ctx.channel) : Promise.resolve(null),
    ]);

    // Extract results with defaults on failure
    ctx.context =
      contextResult.status === 'fulfilled'
        ? contextResult.value
        : { l0: '', l1: '', l2: '', modulesLoaded: [], relevanceScores: [] };

    ctx.memories = memoriesResult.status === 'fulfilled' ? memoriesResult.value : [];

    ctx.previousSession =
      previousSessionResult.status === 'fulfilled' ? previousSessionResult.value : null;

    // Log failures
    if (contextResult.status === 'rejected') {
      logger.error(
        { err: contextResult.reason, sessionId: ctx.sessionId },
        'Context assembly failed',
      );
      logActivity('error', `Context assembly failed: ${contextResult.reason}`, undefined, {
        component: 'context-engine',
        error_code: HawkErrorCode.CONTEXT_LOAD_FAILED,
        session_id: ctx.sessionId,
      }).catch(() => {});
    }
    if (memoriesResult.status === 'rejected') {
      logger.error(
        { err: memoriesResult.reason, sessionId: ctx.sessionId },
        'Memory retrieval failed',
      );
      logActivity('error', `Memory retrieval failed: ${memoriesResult.reason}`, undefined, {
        component: 'memory-retrieval',
        error_code: HawkErrorCode.MEMORY_OPERATION_FAILED,
        session_id: ctx.sessionId,
      }).catch(() => {});
    }
    if (previousSessionResult.status === 'rejected') {
      logger.warn(
        { err: previousSessionResult.reason, sessionId: ctx.sessionId },
        'Previous session loading failed',
      );
    }

    // Track memory access (hotness)
    const memoryIds = ctx.memories.map((m) => m.id).filter(Boolean);
    trackMemoryAccess(memoryIds).catch((err) =>
      console.error('[middleware:context] Failed to track memory access:', err),
    );

    // Build context section
    const proceduralMemories = ctx.memories.filter((m) => m.memory_type === 'procedure');
    const regularMemories = ctx.memories.filter((m) => m.memory_type !== 'procedure');

    ctx.contextSection = [
      ctx.context.l0 ? `## Contexto dos módulos\n${ctx.context.l0}` : '',
      proceduralMemories.length > 0
        ? `## Regras aprendidas (SEMPRE seguir)\n${proceduralMemories.map((m) => `- ${m.content}`).join('\n')}`
        : '',
      regularMemories.length > 0
        ? `## Memórias sobre o usuário\n${regularMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
        : '',
      ctx.previousSession
        ? `## Sessão anterior\n${ctx.previousSession.abstract}\n\n### Detalhes\n${ctx.previousSession.overview}`
        : '',
      ctx.context.l1 ? `## Detalhes\n${ctx.context.l1}` : '',
      ctx.context.l2 ? `## Dados específicos\n${ctx.context.l2}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Redact secrets from context section
    if (getFeatureFlag('secret-redaction')) {
      const contextRedaction = redactSecrets(ctx.contextSection);
      if (contextRedaction.redactedCount > 0) {
        ctx.contextSection = contextRedaction.text;
        logger.warn(
          { count: contextRedaction.redactedCount },
          'Secrets redacted from context section',
        );
      }
    }

    await next();
  },
};
