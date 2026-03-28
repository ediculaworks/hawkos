/**
 * Simple in-memory rate limiter for middleware.
 * Resets on deploy (acceptable for single-instance).
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStale() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

/**
 * Check if a request is within rate limits.
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  cleanupStale();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= limit;
}

/** Per-route rate limit configurations */
export const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  factoryReset: { limit: 1, windowMs: 60 * 60 * 1000 },   // 1/hour
  agentApi: { limit: 60, windowMs: 60 * 1000 },            // 60/min
  default: { limit: 100, windowMs: 60 * 1000 },            // 100/min
};
