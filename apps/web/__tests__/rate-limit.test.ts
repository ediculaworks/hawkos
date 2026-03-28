import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '../lib/rate-limit';

describe('Rate Limiter', () => {
  it('should allow first request', () => {
    expect(checkRateLimit('test-ip-1', 10, 60_000)).toBe(true);
  });

  it('should allow requests within limit', () => {
    const key = 'test-ip-2';
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const key = 'test-ip-3';
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 60_000);
    }
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('should allow new key after different key is exhausted', () => {
    const key1 = 'test-ip-4a';
    const key2 = 'test-ip-4b';
    // Exhaust key1
    checkRateLimit(key1, 1, 60_000);
    expect(checkRateLimit(key1, 1, 60_000)).toBe(false);
    // key2 should still work
    expect(checkRateLimit(key2, 1, 60_000)).toBe(true);
  });

  it('should track different keys independently', () => {
    expect(checkRateLimit('key-a', 1, 60_000)).toBe(true);
    expect(checkRateLimit('key-b', 1, 60_000)).toBe(true);
    // key-a is now at limit
    expect(checkRateLimit('key-a', 1, 60_000)).toBe(false);
    // key-b still has room (since it was a separate first call)
    // Actually key-b is also at limit now (1 call max)
    expect(checkRateLimit('key-b', 1, 60_000)).toBe(false);
  });
});
