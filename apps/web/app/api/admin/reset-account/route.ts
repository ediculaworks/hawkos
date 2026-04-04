import { timingSafeEqual } from 'node:crypto';
import { getTenantBySlug } from '@/lib/tenants/cache';
import { deleteUser, listUsers, signIn } from '@hawk/auth';
import { getPool } from '@hawk/db';
import { NextResponse } from 'next/server';

interface ResetAccountRequest {
  email: string;
  password: string;
  tenantSlug: string;
}

export async function POST(request: Request) {
  try {
    const body: ResetAccountRequest = await request.json();
    const { email, password, tenantSlug } = body;

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const schemaName = tenant.schemaName;

    // 1. Verify credentials — master password bypasses normal auth (timing-safe)
    const masterPassword = process.env.ONBOARDING_MASTER_PASSWORD;
    let isMaster = false;
    if (masterPassword && password.length === masterPassword.length) {
      const a = Buffer.from(password, 'utf8');
      const b = Buffer.from(masterPassword, 'utf8');
      isMaster = timingSafeEqual(a, b);
    }

    if (!isMaster) {
      const { error: signInError } = await signIn(email, password, tenantSlug, schemaName);
      if (signInError) {
        return NextResponse.json(
          { error: 'Senha incorreta — verifique e tente novamente' },
          { status: 401 },
        );
      }
    }

    // 2. Find user by email
    const { data: users } = await listUsers(schemaName);
    const existingUser = users?.find((u) => u.email === email);
    if (!existingUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    const userId = existingUser.id;

    // 3. Delete profile data (CASCADE handles related tables)
    const sql = getPool();
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}", public`);
      await tx.unsafe('DELETE FROM profile WHERE id = $1', [userId]);
    });

    // 4. Delete auth user
    const { error: deleteError } = await deleteUser(userId, schemaName);
    if (deleteError) throw new Error(deleteError);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reset-account] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
