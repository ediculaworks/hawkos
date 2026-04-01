/**
 * Centralized error codes for all Hawk OS modules.
 * Use with HawkError: `throw new HawkError('message', ErrorCodes.DB_QUERY_FAILED)`
 */
export const ErrorCodes = {
  // Database operations
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_INSERT_FAILED: 'DB_INSERT_FAILED',
  DB_UPDATE_FAILED: 'DB_UPDATE_FAILED',
  DB_DELETE_FAILED: 'DB_DELETE_FAILED',

  // Resource resolution
  NOT_FOUND: 'NOT_FOUND',

  // Input validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // Auth & access
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',

  // External integrations
  EXTERNAL_API_FAILED: 'EXTERNAL_API_FAILED',
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  LLM_CALL_FAILED: 'LLM_CALL_FAILED',

  // Budget
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',

  // Agent operations
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  SESSION_ERROR: 'SESSION_ERROR',
  CONTEXT_LOAD_FAILED: 'CONTEXT_LOAD_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
