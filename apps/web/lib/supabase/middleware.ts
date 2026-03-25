import { getTenantBySlug } from '@/lib/tenants/cache';
import type { Database } from '@hawk/db/types';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const tenantSlug = request.cookies.get('hawk_tenant')?.value;
  const path = request.nextUrl.pathname;
  const isAuthRoute = path === '/login' || path.startsWith('/auth/');
  const isProtectedRoute = path.startsWith('/dashboard');

  // ── Resolve Supabase credentials ──────────────────────────────────────
  let supabaseUrl: string | undefined;
  let supabaseAnonKey: string | undefined;

  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug);
    if (tenant) {
      supabaseUrl = tenant.supabaseUrl;
      supabaseAnonKey = tenant.supabaseAnonKey;
    } else {
      // Invalid tenant slug — clear cookie, redirect to login
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('hawk_tenant');
      return response;
    }
  } else {
    // No tenant cookie — fallback to env vars (single-tenant / backwards compat)
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  // No tenant selected and trying to access protected route → login
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // ── Create tenant-aware Supabase SSR client ───────────────────────────
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (
        cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>,
      ) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh session — this keeps the auth cookie alive
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Invalid/expired refresh token — treat as unauthenticated
  }

  // Not authenticated and trying to access protected route → login
  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated and on login page → dashboard
  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  // Check onboarding status for authenticated users accessing dashboard
  if (user && isProtectedRoute) {
    const isOnboardingRoute = path === '/onboarding';
    const onboardingCookie = request.cookies.get('hawk_onboarding')?.value;

    // Fast path: cookie says onboarding is complete — skip DB query
    if (onboardingCookie === 'complete') {
      if (isOnboardingRoute) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = '/dashboard';
        return NextResponse.redirect(dashboardUrl);
      }
    } else {
      // Slow path: check profile in DB (only until cookie is set)
      const { data: profile } = (await supabase
        .from('profile')
        .select('onboarding_complete')
        .eq('id', user.id)
        .maybeSingle()) as { data: { onboarding_complete?: boolean } | null };

      const onboardingComplete = profile?.onboarding_complete ?? false;

      if (onboardingComplete) {
        // Set cookie so we never query again
        supabaseResponse.cookies.set('hawk_onboarding', 'complete', {
          path: '/',
          maxAge: 86400 * 30,
          httpOnly: true,
          sameSite: 'lax',
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
    }
  }

  return supabaseResponse;
}
