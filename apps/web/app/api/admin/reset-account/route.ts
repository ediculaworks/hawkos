import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface ResetAccountRequest {
  email: string;
  password: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
}

export async function POST(request: Request) {

  try {
    const body: ResetAccountRequest = await request.json();
    const { email, password, supabaseUrl, supabaseAnonKey, supabaseServiceKey } = body;

    // 1. Verify credentials — master password bypasses normal auth
    const masterPassword = process.env.ONBOARDING_MASTER_PASSWORD;
    const isMaster = masterPassword && password === masterPassword;

    if (!isMaster) {
      const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { error: signInError } = await anonSupabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        return NextResponse.json(
          { error: 'Senha incorreta — verifique e tente novamente' },
          { status: 401 },
        );
      }
    }

    // 2. Find user by email using admin client
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const { data: listData } = await adminSupabase.auth.admin.listUsers();
    const existingUser = listData?.users.find((u) => u.email === email);
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const userId = existingUser.id;

    // 3. Delete profile data (CASCADE handles related tables)
    await adminSupabase.from('profile').delete().eq('id', userId);

    // 4. Delete auth user
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reset-account] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
