import { type NextRequest, NextResponse } from 'next/server';

/**
 * Edge-safe session guard.
 * Only checks cookie existence — JWT validation happens in API routes/server components
 * where Node.js runtime + process.env are available.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const tenantSlug = request.cookies.get('hawk_tenant')?.value;
  const sessionToken = request.cookies.get('hawk_session')?.value;
  const path = request.nextUrl.pathname;
  const isAuthRoute = path === '/login' || path.startsWith('/auth/');
  const isProtectedRoute = path.startsWith('/dashboard');

  // No session → redirect to login (for protected routes)
  if (!sessionToken && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // No tenant cookie → redirect to login (for protected routes)
  if (!tenantSlug && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Has session + on login page → redirect to dashboard
  if (sessionToken && tenantSlug && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
