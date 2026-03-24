import { NextResponse } from 'next/server';

/**
 * Validates admin API requests.
 *
 * For mutation endpoints (POST/PUT/DELETE), requires one of:
 * - X-Admin-Secret header matching ADMIN_SUPABASE_SERVICE_KEY
 * - Origin header matching APP_URL (same-origin onboarding wizard)
 *
 * Returns null if authorized, or a NextResponse error if not.
 */
export function requireAdminAuth(request: Request): NextResponse | null {
  const secret = request.headers.get('x-admin-secret');
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;

  // Check X-Admin-Secret header
  if (secret && adminKey && secret === adminKey) {
    return null; // authorized
  }

  // Allow same-origin requests (onboarding wizard)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';

  if (appUrl && (origin?.startsWith(appUrl) || referer?.startsWith(appUrl))) {
    return null; // authorized (same-origin)
  }

  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
