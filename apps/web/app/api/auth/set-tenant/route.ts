import { getTenantBySlug } from '@/lib/tenants/cache';
import { verifyToken } from '@hawk/auth/jwt';
import { NextResponse } from 'next/server';

interface SetTenantBody {
  tenantSlug: string;
  sessionToken?: string;
}

/**
 * Sets the hawk_tenant cookie server-side with HttpOnly + Secure flags.
 * Called by the login page and onboarding wizard after successful auth.
 */
export async function POST(request: Request): Promise<Response> {
  let body: SetTenantBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tenantSlug, sessionToken } = body;

  if (!tenantSlug || typeof tenantSlug !== 'string') {
    return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
  }

  // Validate tenant exists
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Require valid JWT — prevents tenant switching without proof of ownership
  if (!sessionToken) {
    return NextResponse.json({ error: 'sessionToken is required' }, { status: 401 });
  }
  const payload = await verifyToken(sessionToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
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
