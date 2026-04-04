/**
 * Security middleware — injection scanning + secret redaction.
 * Runs first in the pipeline to sanitize user input before any processing.
 */

import {
  createLogger,
  getFeatureFlag,
  redactSecrets,
  scanForInjection,
  stripSuspiciousUnicode,
} from '@hawk/shared';
import { logActivity } from '../activity-logger.js';
import type { HandlerContext, Middleware } from './types.js';

const logger = createLogger('middleware:security');

export const securityMiddleware: Middleware = {
  name: 'security',
  execute: async (ctx: HandlerContext, next) => {
    // Strip suspicious unicode
    ctx.sanitizedMessage = stripSuspiciousUnicode(ctx.originalMessage);

    // Scan for prompt injection
    if (getFeatureFlag('prompt-injection-scanning')) {
      const scanResult = scanForInjection(ctx.sanitizedMessage);
      if (scanResult.threatLevel === 'critical' || scanResult.threatLevel === 'high') {
        logActivity(
          'security',
          `Injection detected: ${scanResult.matchedPatterns.join(', ')}`,
          undefined,
          {
            threatLevel: scanResult.threatLevel,
            score: scanResult.score,
            patterns: scanResult.matchedPatterns,
            session_id: ctx.sessionId,
          },
        ).catch(() => {});
        logger.warn(
          {
            sessionId: ctx.sessionId,
            threatLevel: scanResult.threatLevel,
            score: scanResult.score,
            patterns: scanResult.matchedPatterns,
          },
          'Prompt injection detected',
        );
      }
    }

    // Redact secrets from user message before LLM context
    if (getFeatureFlag('secret-redaction')) {
      const redaction = redactSecrets(ctx.sanitizedMessage);
      if (redaction.redactedCount > 0) {
        ctx.sanitizedMessage = redaction.text;
        logActivity(
          'security',
          `Redacted ${redaction.redactedCount} secret(s): ${redaction.redactedPatterns.join(', ')}`,
          undefined,
          {
            redactedCount: redaction.redactedCount,
            patterns: redaction.redactedPatterns,
            session_id: ctx.sessionId,
          },
        ).catch(() => {});
        logger.warn(
          {
            sessionId: ctx.sessionId,
            count: redaction.redactedCount,
            patterns: redaction.redactedPatterns,
          },
          'Secrets redacted from user message',
        );
      }
    }

    await next();
  },
};
