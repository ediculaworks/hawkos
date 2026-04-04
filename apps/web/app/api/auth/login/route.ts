import { getTenantBySlug } from '@/lib/tenants/cache';
import { signIn } from '@hawk/auth';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

// Simple in-memory rate limiter: 5 attempts per IP per 60s
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde 1 minuto.' }, { status: 429 });
    }

    const { email, password, tenantSlug } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Resolve tenant schema
    let schemaName = process.env.TENANT_SCHEMA || 'public';
    let slug = tenantSlug || 'default';

    if (tenantSlug) {
      const tenant = await getTenantBySlug(tenantSlug);
      if (!tenant) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      schemaName = tenant.schemaName;
      slug = tenant.slug;
    }

    // Authenticate
    const result = await signIn(email, password, slug, schemaName);

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || 'Authentication failed' }, { status: 401 });
    }

    // Set cookies
    const cookieStore = await cookies();

    cookieStore.set('hawk_session', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 86400, // 24h
    });

    if (tenantSlug) {
      cookieStore.set('hawk_tenant', slug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 86400 * 30, // 30 days
      });
    }

    return NextResponse.json({
      user: result.data.user,
    });
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
