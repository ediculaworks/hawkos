/**
 * Machine-readable error codes for all Hawk OS modules.
 * Inspired by Onyx's HawkErrorCode enum pattern.
 *
 * Convention: CATEGORY_SPECIFIC_ERROR
 * Use with HawkError: `throw new HawkError('message', HawkErrorCode.DB_QUERY_FAILED)`
 */

export enum HawkErrorCode {
  // ── Database Operations ─────────────────────────────────────────────
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_INSERT_FAILED = 'DB_INSERT_FAILED',
  DB_UPDATE_FAILED = 'DB_UPDATE_FAILED',
  DB_DELETE_FAILED = 'DB_DELETE_FAILED',
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_MIGRATION_FAILED = 'DB_MIGRATION_FAILED',
  DB_TRANSACTION_FAILED = 'DB_TRANSACTION_FAILED',

  // ── Resource Resolution ─────────────────────────────────────────────
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',

  // ── Input Validation ────────────────────────────────────────────────
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // ── Auth & Access ───────────────────────────────────────────────────
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // ── External Integrations ───────────────────────────────────────────
  EXTERNAL_API_FAILED = 'EXTERNAL_API_FAILED',
  EXTERNAL_TIMEOUT = 'EXTERNAL_TIMEOUT',
  EMBEDDING_FAILED = 'EMBEDDING_FAILED',
  LLM_CALL_FAILED = 'LLM_CALL_FAILED',
  LLM_EMPTY_RESPONSE = 'LLM_EMPTY_RESPONSE',
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',
  LLM_CONTEXT_OVERFLOW = 'LLM_CONTEXT_OVERFLOW',

  // ── Budget & Cost ───────────────────────────────────────────────────
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_WARNING = 'BUDGET_WARNING',

  // ── Agent Operations ────────────────────────────────────────────────
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  TOOL_VALIDATION_FAILED = 'TOOL_VALIDATION_FAILED',
  SESSION_ERROR = 'SESSION_ERROR',
  CONTEXT_LOAD_FAILED = 'CONTEXT_LOAD_FAILED',
  MEMORY_OPERATION_FAILED = 'MEMORY_OPERATION_FAILED',

  // ── Security ────────────────────────────────────────────────────────
  SECRET_DETECTED = 'SECRET_DETECTED',
  INJECTION_DETECTED = 'INJECTION_DETECTED',
  SSRF_BLOCKED = 'SSRF_BLOCKED',

  // ── Automation ──────────────────────────────────────────────────────
  AUTOMATION_FAILED = 'AUTOMATION_FAILED',
  AUTOMATION_SKIPPED = 'AUTOMATION_SKIPPED',
  CRON_EXECUTION_FAILED = 'CRON_EXECUTION_FAILED',

  // ── Module Operations ───────────────────────────────────────────────
  MODULE_LOAD_FAILED = 'MODULE_LOAD_FAILED',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',

  // ── Channel / IO ────────────────────────────────────────────────────
  CHANNEL_SEND_FAILED = 'CHANNEL_SEND_FAILED',
  CHANNEL_CONNECT_FAILED = 'CHANNEL_CONNECT_FAILED',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',

  // ── Generic ─────────────────────────────────────────────────────────
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  FEATURE_DISABLED = 'FEATURE_DISABLED',
}

/** Error code category for grouping in dashboards and log analysis */
export type ErrorCategory =
  | 'database'
  | 'validation'
  | 'auth'
  | 'external'
  | 'budget'
  | 'agent'
  | 'security'
  | 'automation'
  | 'module'
  | 'channel'
  | 'generic';

const CODE_CATEGORY_MAP: Record<string, ErrorCategory> = {
  DB_: 'database',
  VALIDATION_: 'validation',
  INVALID_: 'validation',
  MISSING_: 'validation',
  UNAUTHORIZED: 'auth',
  FORBIDDEN: 'auth',
  RATE_LIMITED: 'auth',
  SESSION_EXPIRED: 'auth',
  EXTERNAL_: 'external',
  EMBEDDING_: 'external',
  LLM_: 'external',
  BUDGET_: 'budget',
  TOOL_: 'agent',
  SESSION_: 'agent',
  CONTEXT_: 'agent',
  MEMORY_: 'agent',
  SECRET_: 'security',
  INJECTION_: 'security',
  SSRF_: 'security',
  AUTOMATION_: 'automation',
  CRON_: 'automation',
  MODULE_: 'module',
  CHANNEL_: 'channel',
  MESSAGE_: 'channel',
};

/**
 * Get the category for a given error code (for dashboard grouping).
 */
export function getErrorCategory(code: string): ErrorCategory {
  for (const [prefix, category] of Object.entries(CODE_CATEGORY_MAP)) {
    if (code.startsWith(prefix) || code === prefix) {
      return category;
    }
  }
  return 'generic';
}

/**
 * Check if an error code indicates a retriable operation.
 */
export function isRetriable(code: HawkErrorCode): boolean {
  return [
    HawkErrorCode.DB_QUERY_FAILED,
    HawkErrorCode.DB_CONNECTION_FAILED,
    HawkErrorCode.EXTERNAL_API_FAILED,
    HawkErrorCode.EXTERNAL_TIMEOUT,
    HawkErrorCode.LLM_CALL_FAILED,
    HawkErrorCode.LLM_RATE_LIMITED,
    HawkErrorCode.EMBEDDING_FAILED,
    HawkErrorCode.CHANNEL_SEND_FAILED,
  ].includes(code);
}

// ── Backward Compatibility ───────────────────────────────────────────────────
// Keep the old `ErrorCodes` object so existing imports don't break.
// New code should use `HawkErrorCode` enum directly.

export const ErrorCodes = HawkErrorCode;
export type ErrorCode = HawkErrorCode;
