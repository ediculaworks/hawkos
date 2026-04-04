import { checkRateLimit } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Build CSP with per-request nonce for inline script protection.
 * In dev mode, unsafe-eval is allowed for Next.js HMR/React Fast Refresh.
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ws: wss: https://openrouter.ai https://vitals.vercel-insights.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// Static security headers (CSP is dynamic, applied separately)
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate per-request nonce for CSP
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

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

    return applySecurityHeaders(NextResponse.next(), csp);
  }

  // Page routes — pass nonce via request header for layout.tsx to read
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = await updateSession(
    new NextRequest(request.url, { headers: requestHeaders, method: request.method }),
  );
  return applySecurityHeaders(response, csp);
}

export const config = {
  matcher: [
    // API routes (for rate limiting)
    '/api/:path*',
    // Page routes — exclude static files and assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)',
  ],
};
