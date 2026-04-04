/**
 * History middleware — loads session history and compresses if needed.
 */

import { getSessionMessages } from '@hawk/module-memory/queries';
import { HawkErrorCode, createLogger } from '@hawk/shared';
import { logActivity } from '../activity-logger.js';
import type { HandlerContext, Middleware } from './types.js';

const logger = createLogger('middleware:history');

export const historyMiddleware: Middleware = {
  name: 'history',
  execute: async (ctx: HandlerContext, next) => {
    // Load session history
    try {
      const messages = await getSessionMessages(ctx.sessionId, 20);
      ctx.history = messages;
    } catch (err) {
      logger.error({ err, sessionId: ctx.sessionId }, 'History loading failed');
      logActivity('error', `History loading failed: ${err}`, undefined, {
        component: 'session-history',
        error_code: HawkErrorCode.DB_QUERY_FAILED,
        session_id: ctx.sessionId,
      }).catch(() => {});
      ctx.history = [];
    }

    await next();
  },
};
