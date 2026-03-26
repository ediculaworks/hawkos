import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * DEV ONLY: Simple password-based admin access for testing.
 * Sets a cookie that admin/page.tsx can verify.
 * Remove this before production deployment.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const password = body.password as string;

  const devPassword = process.env.ADMIN_DEV_PASSWORD;
  if (!devPassword || password !== devPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Create a simple token (hash of password + timestamp)
  const token = createHash('sha256').update(`${password}:${Date.now()}`).digest('hex');

  const response = NextResponse.json({
    success: true,
    redirectUrl: '/admin',
  });

  // Set admin token cookie
  response.cookies.set('admin_dev_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  console.log('[dev-login] Admin access granted with token:', `${token.substring(0, 20)}...`);

  return response;
}
