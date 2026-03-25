import { NextResponse } from 'next/server';

/**
 * Validates admin API requests.
 *
 * Allows requests if any of:
 * 1. X-Admin-Secret header matches ADMIN_SUPABASE_SERVICE_KEY
 * 2. Same-origin: Referer host matches Host header (browser onboarding wizard)
 * 3. NODE_ENV === 'development'
 */
export function requireAdminAuth(request: Request): NextResponse | null {
  const secret = request.headers.get('x-admin-secret');
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;

  // Check X-Admin-Secret header
  if (secret && adminKey && secret === adminKey) {
    return null;
  }

  // Same-origin check: compare Referer host with Host header
  const host = request.headers.get('host');
  const referer = request.headers.get('referer');
  const origin = request.headers.get('origin');

  if (host) {
    if (referer) {
      try {
        if (new URL(referer).host === host) return null;
      } catch {}
    }
    if (origin) {
      try {
        if (new URL(origin).host === host) return null;
      } catch {}
    }
  }

  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
