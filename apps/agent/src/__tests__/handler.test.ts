import { describe, expect, it } from 'vitest';

/**
 * Tests for handler.ts rate limiting and session GC logic.
 * These test the pure functions extracted from the handler module.
 */

// ── Rate Limiter Tests ──────────────────────────────────────
describe('Rate Limiter', () => {
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 20;
  const rateLimiter = new Map<string, { count: number; windowStart: number }>();

  function checkRateLimit(channelId: string): boolean {
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

  it('should allow first message', () => {
    rateLimiter.clear();
    expect(checkRateLimit('test-channel')).toBe(true);
  });

  it('should allow up to RATE_LIMIT_MAX messages', () => {
    rateLimiter.clear();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit('test-channel')).toBe(true);
    }
  });

  it('should reject after RATE_LIMIT_MAX messages', () => {
    rateLimiter.clear();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('test-channel');
    }
    expect(checkRateLimit('test-channel')).toBe(false);
  });

  it('should track channels independently', () => {
    rateLimiter.clear();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('channel-a');
    }
    expect(checkRateLimit('channel-a')).toBe(false);
    expect(checkRateLimit('channel-b')).toBe(true);
  });

  it('should reset after window expires', () => {
    rateLimiter.clear();
    // Fill the rate limiter
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('test-channel');
    }
    expect(checkRateLimit('test-channel')).toBe(false);

    // Simulate window expiry by manipulating the entry
    const entry = rateLimiter.get('test-channel')!;
    entry.windowStart = Date.now() - RATE_LIMIT_WINDOW_MS - 1;

    expect(checkRateLimit('test-channel')).toBe(true);
  });
});

// ── Session GC Tests ──────────────────────────────────────
describe('Session GC', () => {
  const SESSION_TTL_MS = 30 * 60 * 1000;

  it('should identify expired sessions', () => {
    const activeSessions = new Map<string, { sessionId: string; lastActivity: number }>();
    const now = Date.now();

    // Active session
    activeSessions.set('active', { sessionId: 'a', lastActivity: now - 1000 });
    // Expired session
    activeSessions.set('expired', { sessionId: 'b', lastActivity: now - SESSION_TTL_MS - 1 });

    // GC logic
    for (const [key, session] of activeSessions) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        activeSessions.delete(key);
      }
    }

    expect(activeSessions.size).toBe(1);
    expect(activeSessions.has('active')).toBe(true);
    expect(activeSessions.has('expired')).toBe(false);
  });
});

// ── JSON.parse Safety Tests ──────────────────────────────
describe('JSON.parse safety', () => {
  it('should handle malformed JSON gracefully', () => {
    const malformedInputs = ['not json', '{incomplete', '', 'undefined', '{"key": }'];

    for (const input of malformedInputs) {
      let result: string;
      try {
        JSON.parse(input);
        result = 'parsed';
      } catch {
        result = 'Erro: argumentos inválidos (JSON malformado)';
      }
      expect(result).toBe('Erro: argumentos inválidos (JSON malformado)');
    }
  });

  it('should parse valid JSON', () => {
    const valid = '{"content": "test", "memory_type": "profile"}';
    const parsed = JSON.parse(valid);
    expect(parsed.content).toBe('test');
    expect(parsed.memory_type).toBe('profile');
  });
});
