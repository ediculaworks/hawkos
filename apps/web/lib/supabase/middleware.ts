import { type NextRequest, NextResponse } from 'next/server';

// Edge-safe JWT verification using jose (no Node.js modules)
async function verifyTokenEdge(
  token: string,
): Promise<{ sub: string; email: string; tenant: string } | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    // Use Web Crypto API (edge-compatible)
    const { jwtVerify } = await import('jose');
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      issuer: 'hawk-os',
      audience: 'hawk-os',
    });

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      tenant: payload.tenant as string,
    };
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const tenantSlug = request.cookies.get('hawk_tenant')?.value;
  const sessionToken = request.cookies.get('hawk_session')?.value;
  const path = request.nextUrl.pathname;
  const isAuthRoute = path === '/login' || path.startsWith('/auth/');
  const isProtectedRoute = path.startsWith('/dashboard');

  // No tenant cookie and trying to access protected route → login
  if (!tenantSlug && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Verify JWT session ──────────────────────────────────────────────
  let user: { sub: string; email: string; tenant: string } | null = null;

  if (sessionToken) {
    user = await verifyTokenEdge(sessionToken);
  }

  // Validate that the authenticated user's tenant matches the cookie
  if (user && tenantSlug && user.tenant !== tenantSlug) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.delete('hawk_tenant');
    redirect.cookies.delete('hawk_session');
    return redirect;
  }

  // Not authenticated and trying to access protected route → login
  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name === 'hawk_session' || cookie.name === 'hawk_onboarding') {
        redirect.cookies.delete(cookie.name);
      }
    }
    return redirect;
  }

  // Authenticated and on login page → dashboard
  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
