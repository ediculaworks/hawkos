import { checkRateLimit } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest, NextResponse } from 'next/server';

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `${ip}:${pathname}`;

    let limit = 100;
    let windowMs = 60_000;
    if (pathname.startsWith('/api/factory-reset')) {
      limit = 1;
      windowMs = 60 * 60 * 1000; // 1 per hour
    } else if (pathname.startsWith('/api/agent')) {
      limit = 60;
      windowMs = 60_000; // 60 per minute
    }

    if (!checkRateLimit(key, limit, windowMs)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    return applySecurityHeaders(NextResponse.next());
  }

  // Page routes — session management + security headers
  const response = await updateSession(request);
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    // API routes (for rate limiting)
    '/api/:path*',
    // Page routes — exclude static files and assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)',
  ],
};
