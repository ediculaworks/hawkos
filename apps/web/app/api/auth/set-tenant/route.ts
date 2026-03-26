import { getTenantBySlug } from '@/lib/tenants/cache';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

interface SetTenantBody {
  tenantSlug: string;
  accessToken: string;
}

/**
 * Sets the hawk_tenant cookie server-side with HttpOnly + Secure flags.
 * Called by the login page and onboarding wizard after successful Supabase auth.
 *
 * Validates that the provided access token is actually valid for the given tenant
 * before setting the cookie.
 */
export async function POST(request: Request): Promise<Response> {
  let body: SetTenantBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tenantSlug, accessToken } = body;

  if (!tenantSlug || typeof tenantSlug !== 'string') {
    return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
  }
  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
  }

  // Validate tenant exists
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Validate the access token is genuine for this tenant's Supabase
  const supabase = createServerClient(tenant.supabaseUrl, tenant.supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid or expired access token' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set('hawk_tenant', tenantSlug, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
  });

  return response;
}
