import { updateSession } from '@/lib/supabase/middleware';
import { checkRateLimit } from '@/lib/rate-limit';
import { type NextRequest, NextResponse } from 'next/server';

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

    return NextResponse.next();
  }

  // Page routes — session management
  return await updateSession(request);
}

export const config = {
  matcher: [
    // API routes (for rate limiting)
    '/api/:path*',
    // Page routes — exclude static files and assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)',
  ],
};
