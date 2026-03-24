import { type NextRequest, NextResponse } from 'next/server';

// Lazy-import to avoid pulling in @hawk/db at edge
async function getExtensionDefinition(id: string) {
  const { extensionRegistry } = await import('@hawk/extensions/core/registry');
  // Ensure extensions are registered
  await import('@hawk/extensions/setup');
  return extensionRegistry.get(id as Parameters<typeof extensionRegistry.get>[0]);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ext = await getExtensionDefinition(id);

  if (!ext) {
    return NextResponse.json({ error: `Unknown extension: ${id}` }, { status: 404 });
  }

  if (!ext.getAuthorizationUrl) {
    return NextResponse.json({ error: `Extension ${id} does not support OAuth` }, { status: 400 });
  }

  // Generate a CSRF state token
  const state = crypto.randomUUID();

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/extensions/${id}/callback`;
  const authUrl = ext.getAuthorizationUrl(redirectUri, state);

  // Store state in a cookie for verification on callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(`ext_oauth_state_${id}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
