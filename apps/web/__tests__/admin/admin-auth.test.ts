import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for admin-auth.ts guard.
 * Tests the requireAdminAuth() function in isolation.
 */

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

// Import after mock
const { requireAdminAuth } = await import('../../lib/admin-auth');

function makeRequest(
  options: {
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers = new Headers(options.headers || {});
  return new Request('http://localhost:3000/api/admin/tenants', {
    method: 'POST',
    headers,
  });
}

describe('requireAdminAuth', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_SUPABASE_SERVICE_KEY = 'test-admin-key';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('should allow request with correct X-Admin-Secret', () => {
    const req = makeRequest({ headers: { 'x-admin-secret': 'test-admin-key' } });
    const result = requireAdminAuth(req);
    expect(result).toBeNull();
  });

  it('should allow same-origin request (matching origin header)', () => {
    const req = makeRequest({ headers: { origin: 'http://localhost:3000' } });
    const result = requireAdminAuth(req);
    expect(result).toBeNull();
  });

  it('should allow same-origin request (matching referer header)', () => {
    const req = makeRequest({ headers: { referer: 'http://localhost:3000/onboarding' } });
    const result = requireAdminAuth(req);
    expect(result).toBeNull();
  });

  it('should block request without auth headers in production', () => {
    const req = makeRequest();
    const result = requireAdminAuth(req);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(401);
  });

  it('should block request with wrong X-Admin-Secret', () => {
    const req = makeRequest({ headers: { 'x-admin-secret': 'wrong-key' } });
    const result = requireAdminAuth(req);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(401);
  });

  it('should block request from different origin', () => {
    const req = makeRequest({ headers: { origin: 'https://evil.com' } });
    const result = requireAdminAuth(req);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(401);
  });

  it('should block unauthenticated requests even in development mode', () => {
    process.env.NODE_ENV = 'development';
    const req = makeRequest();
    const result = requireAdminAuth(req);
    expect(result).not.toBeNull();
    expect((result as { status: number }).status).toBe(401);
  });
});
