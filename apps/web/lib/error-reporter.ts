/**
 * Lightweight error reporter for the web dashboard.
 * Logs errors to the agent API (which saves to activity_log).
 * No external dependencies (no Sentry).
 */

interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  url?: string;
  userAgent?: string;
}

const ERROR_ENDPOINT = '/api/agent/errors';
const RATE_LIMIT_MS = 10_000; // Max 1 error report per 10 seconds
let lastReportTime = 0;

/**
 * Report an error to the backend activity_log.
 */
export function reportError(error: Error | string, component?: string): void {
  const now = Date.now();
  if (now - lastReportTime < RATE_LIMIT_MS) return;
  lastReportTime = now;

  const report: ErrorReport = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack,
    component,
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  // Fire-and-forget — don't block the UI
  fetch(ERROR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }).catch(() => {
    // If error reporting fails, silently drop it
  });
}

/**
 * Setup global error listeners for uncaught errors.
 * Call once at app initialization.
 */
export function setupGlobalErrorReporting(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, 'global');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : String(event.reason);
    reportError(reason instanceof Error ? reason : new Error(String(reason)), 'promise');
  });
}
