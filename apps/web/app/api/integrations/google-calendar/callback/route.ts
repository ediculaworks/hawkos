import { createHmac } from 'node:crypto';
import { getTenantPrivateBySlug } from '@/lib/tenants/cache-server';
import { getPool } from '@hawk/db';
import { type NextRequest, NextResponse } from 'next/server';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { searchParams } = req.nextUrl;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=google_denied`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=invalid_callback`,
    );
  }

  // Verify state HMAC to prevent CSRF
  const [slug, sig] = state.split('.');
  if (!slug || !sig) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=invalid_state`,
    );
  }

  const secret = process.env.JWT_SECRET ?? 'dev-fallback';
  const expectedSig = createHmac('sha256', secret).update(slug).digest('hex').slice(0, 16);
  if (sig !== expectedSig) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=invalid_state`,
    );
  }

  // Resolve tenant schema from slug
  const tenant = await getTenantPrivateBySlug(slug);
  if (!tenant) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=tenant_not_found`,
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/integrations/google-calendar/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('[google-calendar] Token exchange failed:', tokenRes.status);
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=token_exchange`,
    );
  }

  const tokens = (await tokenRes.json()) as TokenResponse;
  if (tokens.error) {
    console.error('[google-calendar] Token error:', tokens.error, tokens.error_description);
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?section=integrations&error=token_exchange`,
    );
  }

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Fetch the user's primary calendar ID
  let googleCalendarId = 'primary';
  try {
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );
    if (calRes.ok) {
      const calData = (await calRes.json()) as { id?: string };
      googleCalendarId = calData.id ?? 'primary';
    }
  } catch {
    // Non-fatal — use 'primary'
  }

  // Store in calendar_sync_config (upsert by calendar_id)
  const sql = getPool();
  const calendarId = `google:${slug}`;

  await sql.unsafe(
    `INSERT INTO "${tenant.schemaName}".calendar_sync_config
       (calendar_id, calendar_name, google_calendar_id, access_token, refresh_token,
        token_expiry, sync_enabled, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, true, '{}')
     ON CONFLICT (calendar_id) DO UPDATE SET
       google_calendar_id = EXCLUDED.google_calendar_id,
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_sync_config.refresh_token),
       token_expiry = EXCLUDED.token_expiry,
       sync_enabled = true,
       updated_at = now()`,
    [
      calendarId,
      'Google Calendar',
      googleCalendarId,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokenExpiry,
    ],
  );

  return NextResponse.redirect(
    `${appUrl}/dashboard/settings?section=integrations&connected=google`,
  );
}
