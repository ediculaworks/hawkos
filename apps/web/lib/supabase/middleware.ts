import { getTenantBySlug } from '@/lib/tenants/cache';
import { verifyToken } from '@hawk/auth/jwt';
import { getPool } from '@hawk/db';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const tenantSlug = request.cookies.get('hawk_tenant')?.value;
  const sessionToken = request.cookies.get('hawk_session')?.value;
  const path = request.nextUrl.pathname;
  const isAuthRoute = path === '/login' || path.startsWith('/auth/');
  const isProtectedRoute = path.startsWith('/dashboard');

  // ── Resolve tenant ──────────────────────────────────────────────────
  let tenant: { slug: string; label: string; schemaName: string } | null = null;

  if (tenantSlug) {
    tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      // Invalid tenant slug — clear cookie, redirect to login
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      const redirect = NextResponse.redirect(loginUrl);
      redirect.cookies.delete('hawk_tenant');
      return redirect;
    }
  }

  // No tenant selected and trying to access protected route → login
  if (!tenant && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // ── Verify JWT session ──────────────────────────────────────────────
  let user: { sub: string; email: string; tenant: string } | null = null;

  if (sessionToken) {
    const payload = await verifyToken(sessionToken);
    if (payload) {
      user = {
        sub: payload.sub,
        email: payload.email,
        tenant: payload.tenant,
      };
    }
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
    // Clear stale cookies
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

  // Check onboarding status for authenticated users accessing dashboard
  if (user && isProtectedRoute && tenant) {
    const isOnboardingRoute = path === '/onboarding';
    const onboardingCookie = request.cookies.get('hawk_onboarding')?.value;

    if (onboardingCookie === 'complete' && !isOnboardingRoute) {
      // Fast path: cookie still valid
    } else {
      // Check profile in DB
      try {
        const sql = getPool();
        const rows = await sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL search_path TO "${tenant!.schemaName}", public`);
          return tx.unsafe('SELECT onboarding_complete FROM profile WHERE id = $1 LIMIT 1', [
            user!.sub,
          ]);
        });

        const profile = rows[0] as Record<string, unknown> | undefined;
        const onboardingComplete = profile?.onboarding_complete ?? false;

        if (onboardingComplete) {
          response.cookies.set('hawk_onboarding', 'complete', {
            path: '/',
            maxAge: 86400,
            httpOnly: true,
            sameSite: 'strict',
          });
        } else if (!isOnboardingRoute) {
          const onboardingUrl = request.nextUrl.clone();
          onboardingUrl.pathname = '/onboarding';
          return NextResponse.redirect(onboardingUrl);
        }

        if (onboardingComplete && isOnboardingRoute) {
          const dashboardUrl = request.nextUrl.clone();
          dashboardUrl.pathname = '/dashboard';
          return NextResponse.redirect(dashboardUrl);
        }
      } catch {
        // DB error — allow through, page will handle gracefully
      }
    }
  }

  return response;
}
