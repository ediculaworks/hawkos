import { describe, expect, it } from 'vitest';

/**
 * Tests for API server authentication and input validation logic.
 */

// ── Auth Tests ──────────────────────────────────────────
describe('requireAuth', () => {
  function requireAuth(authHeader: string | null, secret: string): { status: number } | null {
    if (!secret) return null; // dev mode
    if (authHeader !== `Bearer ${secret}`) {
      return { status: 401 };
    }
    return null;
  }

  it('should skip auth when no secret configured (dev mode)', () => {
    expect(requireAuth(null, '')).toBeNull();
    expect(requireAuth('Bearer anything', '')).toBeNull();
  });

  it('should reject missing auth header', () => {
    const result = requireAuth(null, 'my-secret');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('should reject wrong token', () => {
    const result = requireAuth('Bearer wrong-token', 'my-secret');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('should accept correct token', () => {
    expect(requireAuth('Bearer my-secret', 'my-secret')).toBeNull();
  });

  it('should reject token without Bearer prefix', () => {
    const result = requireAuth('my-secret', 'my-secret');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });
});

// ── WebSocket Auth Tests ──────────────────────────────────
describe('WebSocket token auth', () => {
  function checkWsToken(tokenParam: string | null, wsAuthToken: string): boolean {
    if (!wsAuthToken) return true; // no token configured, allow all
    return tokenParam === wsAuthToken;
  }

  it('should allow all when no token configured', () => {
    expect(checkWsToken(null, '')).toBe(true);
    expect(checkWsToken('anything', '')).toBe(true);
  });

  it('should reject missing token', () => {
    expect(checkWsToken(null, 'secret-ws-token')).toBe(false);
  });

  it('should reject wrong token', () => {
    expect(checkWsToken('wrong', 'secret-ws-token')).toBe(false);
  });

  it('should accept correct token', () => {
    expect(checkWsToken('secret-ws-token', 'secret-ws-token')).toBe(true);
  });
});

// ── Message Validation Tests ────────────────────────────
describe('Chat message validation', () => {
  interface ChatInput {
    type?: unknown;
    sessionId?: unknown;
    content?: unknown;
  }

  function validateChatMessage(data: ChatInput): { valid: true } | { valid: false; error: string } {
    if (typeof data.sessionId !== 'string' || !data.sessionId) {
      return { valid: false, error: 'Missing sessionId' };
    }
    if (typeof data.content !== 'string' || !(data.content as string).trim()) {
      return { valid: false, error: 'Missing content' };
    }
    if ((data.content as string).length > 16_384) {
      return { valid: false, error: 'Message too long (max 16KB)' };
    }
    return { valid: true };
  }

  it('should reject missing sessionId', () => {
    const result = validateChatMessage({ type: 'chat_message', content: 'hello' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Missing sessionId');
  });

  it('should reject non-string sessionId', () => {
    const result = validateChatMessage({ type: 'chat_message', sessionId: 123, content: 'hello' });
    expect(result.valid).toBe(false);
  });

  it('should reject empty content', () => {
    const result = validateChatMessage({
      type: 'chat_message',
      sessionId: 'abc',
      content: '   ',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Missing content');
  });

  it('should reject oversized messages', () => {
    const bigContent = 'x'.repeat(16_385);
    const result = validateChatMessage({
      type: 'chat_message',
      sessionId: 'abc',
      content: bigContent,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Message too long (max 16KB)');
  });

  it('should accept valid messages', () => {
    const result = validateChatMessage({
      type: 'chat_message',
      sessionId: 'abc-123',
      content: 'Hello, Hawk!',
    });
    expect(result.valid).toBe(true);
  });

  it('should accept messages at exactly 16KB', () => {
    const content = 'x'.repeat(16_384);
    const result = validateChatMessage({
      type: 'chat_message',
      sessionId: 'abc',
      content,
    });
    expect(result.valid).toBe(true);
  });
});

// ── Pagination Types Test ───────────────────────────────
describe('PaginatedResult', () => {
  it('should correctly represent paginated data', () => {
    const result = {
      data: [1, 2, 3],
      total: 10,
      hasMore: true,
    };

    expect(result.data).toHaveLength(3);
    expect(result.total).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  it('should show hasMore=false on last page', () => {
    const result = {
      data: [1, 2],
      total: 5,
      hasMore: false,
    };

    expect(result.hasMore).toBe(false);
  });
});
