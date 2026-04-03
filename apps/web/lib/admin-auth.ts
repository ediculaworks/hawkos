import { NextResponse } from 'next/server';

function extractHost(value: string): string {
  try {
    return new URL(value).hostname; // hostname strips port
  } catch {
    return value.split(':')[0] ?? value; // fallback: strip port manually
  }
}

/**
 * Validates admin API requests.
 *
 * Allows requests if any of:
 * 1. X-Admin-Secret header matches ADMIN_SUPABASE_SERVICE_KEY
 * 2. Same-origin: Referer/Origin hostname matches Host header hostname
 */
export function requireAdminAuth(request: Request): NextResponse | null {
  const secret = request.headers.get('x-admin-secret');
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;

  if (secret && adminKey && secret === adminKey) {
    return null;
  }

  const hostHeader = request.headers.get('host') || '';
  // Fallback: derive hostname from request URL itself when host header is absent
  const serverHostname = hostHeader
    ? extractHost(hostHeader.includes('://') ? hostHeader : `http://${hostHeader}`)
    : extractHost(request.url);

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).hostname === serverHostname) return null;
    } catch {}
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).hostname === serverHostname) return null;
    } catch {}
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
