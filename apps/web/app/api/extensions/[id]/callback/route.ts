import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(
      new URL(`/dashboard/extensions?error=no_code&ext=${id}`, request.url),
    );
  }

  // Verify CSRF state
  const savedState = request.cookies.get(`ext_oauth_state_${id}`)?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL(`/dashboard/extensions?error=invalid_state&ext=${id}`, request.url),
    );
  }

  try {
    // Import extension and credentials
    const { extensionRegistry } = await import('@hawk/extensions/core/registry');
    await import('@hawk/extensions/setup');
    const { upsertConnection } = await import('@hawk/extensions/core/credentials');

    const ext = extensionRegistry.get(id as Parameters<typeof extensionRegistry.get>[0]);
    if (!ext?.handleCallback) {
      return NextResponse.redirect(
        new URL(`/dashboard/extensions?error=no_oauth&ext=${id}`, request.url),
      );
    }

    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/extensions/${id}/callback`;
    const tokens = await ext.handleCallback(code, redirectUri);

    // Store tokens in DB
    await upsertConnection(ext.id, {
      status: 'connected',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
    });

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL(`/dashboard/extensions?connected=${id}`, request.url),
    );
    response.cookies.delete(`ext_oauth_state_${id}`);
    return response;
  } catch (_e) {
    return NextResponse.redirect(
      new URL(`/dashboard/extensions?error=callback_failed&ext=${id}`, request.url),
    );
  }
}
