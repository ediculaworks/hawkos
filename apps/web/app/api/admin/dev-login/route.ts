import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * DEV ONLY: Temporary endpoint to generate admin session for testing.
 * Remove this before production deployment.
 */
export async function POST(request: Request) {
  // Security: Check for dev password
  const body = await request.json();
  const password = body.password as string;

  const devPassword = process.env.ADMIN_DEV_PASSWORD;
  if (!devPassword || password !== devPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const adminUrl = process.env.ADMIN_SUPABASE_URL;
  const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;

  if (!adminUrl || !adminKey) {
    return NextResponse.json({ error: 'Admin Supabase not configured' }, { status: 500 });
  }

  const admin = createClient(adminUrl, adminKey, { auth: { persistSession: false } });

  try {
    // Create or find admin user
    const adminEmail = 'admin@hawkos.local';

    console.log('[dev-login] Attempting to create/find user:', adminEmail);

    // Try to create admin user
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: devPassword,
      email_confirm: true,
    });

    console.log('[dev-login] Create response:', { newUser: newUser?.user?.id, createError });

    let userId = newUser?.user?.id;

    // If user exists, get it
    if (createError) {
      console.log('[dev-login] Create error detected, checking if user exists...');
      const { data: users, error: listError } = await admin.auth.admin.listUsers();
      console.log('[dev-login] List users result:', { count: users?.users?.length, listError });
      const existing = users?.users?.find((u) => u.email === adminEmail);
      userId = existing?.id;
      console.log('[dev-login] Found existing user:', userId);

      // Update password just in case
      if (userId) {
        console.log('[dev-login] Updating password for:', userId);
        const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
          password: devPassword,
        });
        console.log('[dev-login] Password update result:', updateError);
      }
    }

    if (!userId) {
      throw new Error(`Failed to create/find admin user (createError: ${createError})`);
    }

    console.log('[dev-login] Using userId:', userId);

    // Sign in as the admin user to get a valid session
    const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
      email: adminEmail,
      password: devPassword,
    });

    if (signInError || !signInData.session) {
      throw signInError || new Error('Failed to create session');
    }

    const { session } = signInData;

    // Return session and set cookie
    const response = NextResponse.json({
      success: true,
      redirectUrl: '/admin',
    });

    // Set secure cookie with the access token
    response.cookies.set('admin_session', session.access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('[dev-login] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 },
    );
  }
}
