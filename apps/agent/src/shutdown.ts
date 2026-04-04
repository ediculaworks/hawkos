/**
 * Graceful Shutdown Manager
 *
 * Provides AbortController-based cancellation signal that all long-running
 * operations can listen to. Supports registering cleanup handlers with
 * priority ordering.
 *
 * Inspired by Hermes Agent's graceful shutdown pattern.
 */

import { createLogger } from '@hawk/shared';

const logger = createLogger('shutdown');

// ── Global Abort Signal ──────────────────────────────────────────────────────

const _controller = new AbortController();

/**
 * Global abort signal — pass to fetch(), setTimeout, or any cancellable operation.
 * Triggers on SIGTERM/SIGINT/uncaughtException.
 */
export const shutdownSignal: AbortSignal = _controller.signal;

/**
 * Check if shutdown has been requested.
 */
export function isShuttingDown(): boolean {
  return _controller.signal.aborted;
}

// ── Cleanup Hook Registry ────────────────────────────────────────────────────

interface CleanupHook {
  name: string;
  priority: number; // Lower = runs first (0 = cron, 10 = connections, 20 = DB, 30 = final)
  handler: () => Promise<void> | void;
  timeoutMs: number;
}

const _hooks: CleanupHook[] = [];

/**
 * Register a cleanup handler to run during shutdown.
 * Handlers run in priority order (lower = earlier).
 */
export function onShutdown(
  name: string,
  handler: () => Promise<void> | void,
  opts?: { priority?: number; timeoutMs?: number },
): void {
  _hooks.push({
    name,
    handler,
    priority: opts?.priority ?? 10,
    timeoutMs: opts?.timeoutMs ?? 5000,
  });
}

/**
 * Execute all registered cleanup handlers in priority order.
 * Each handler has its own timeout to prevent blocking.
 */
export async function runCleanupHooks(): Promise<void> {
  // Trigger abort signal
  _controller.abort();

  // Sort by priority (lower first)
  const sorted = [..._hooks].sort((a, b) => a.priority - b.priority);

  for (const hook of sorted) {
    try {
      logger.info({ hook: hook.name }, `Running cleanup: ${hook.name}`);
      await Promise.race([
        Promise.resolve(hook.handler()),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`Cleanup timeout: ${hook.name}`)), hook.timeoutMs),
        ),
      ]);
      logger.info({ hook: hook.name }, `Cleanup done: ${hook.name}`);
    } catch (err) {
      logger.error({ hook: hook.name, err }, `Cleanup failed: ${hook.name}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a setTimeout that respects shutdown signal.
 * Resolves with false if aborted, true if timeout completes.
 */
export function cancellableDelay(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (_controller.signal.aborted) {
      resolve(false);
      return;
    }

    const timer = setTimeout(() => resolve(true), ms);

    _controller.signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });
}

/**
 * Wrap a fetch call with the shutdown abort signal.
 */
export function cancellableFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: _controller.signal });
}
