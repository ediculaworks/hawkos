/**
 * Session management — in-memory sessions with TTL, rate limiting, and GC.
 * Extracted from handler.ts for separation of concerns.
 */

// ── Session Management (NanoClaw-inspired) ─────────────────
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_GC_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 min

const activeSessions = new Map<string, { sessionId: string; lastActivity: number }>();
const webSessions = new Map<string, { lastActivity: number }>();

// ── Rate Limiting ──────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max 20 messages per minute per channel
const rateLimiter = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(channelId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(channelId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimiter.set(channelId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Session GC ─────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of activeSessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      activeSessions.delete(key);
    }
  }
  for (const [key, session] of webSessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      webSessions.delete(key);
    }
  }
  for (const [key, entry] of rateLimiter) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimiter.delete(key);
    }
  }
}, SESSION_GC_INTERVAL_MS);

export function getOrCreateSession(channelId: string): { sessionId: string; isNew: boolean } {
  const existing = activeSessions.get(channelId);
  const now = Date.now();

  if (existing && now - existing.lastActivity < SESSION_TTL_MS) {
    existing.lastActivity = now;
    return { sessionId: existing.sessionId, isNew: false };
  }

  const sessionId = crypto.randomUUID();
  activeSessions.set(channelId, { sessionId, lastActivity: now });
  return { sessionId, isNew: true };
}

export function touchWebSession(sessionId: string): void {
  webSessions.set(sessionId, { lastActivity: Date.now() });
}
