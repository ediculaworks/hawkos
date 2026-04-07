import { createHmac } from 'node:crypto';
import { getTenantSlug } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET(): Promise<Response> {
  const slug = await getTenantSlug();
  if (!slug)
    return NextResponse.redirect(
      new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    );

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth não configurado (GOOGLE_CLIENT_ID em falta)' },
      { status: 501 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`;

  // Sign slug to prevent CSRF — state = slug.hmac(slug, JWT_SECRET)[:16]
  const secret = process.env.JWT_SECRET ?? 'dev-fallback';
  const sig = createHmac('sha256', secret).update(slug).digest('hex').slice(0, 16);
  const state = `${slug}.${sig}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
