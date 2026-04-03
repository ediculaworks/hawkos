import { requireAdminAuth } from '@/lib/admin-auth';
import { createAdminClientFromEnv } from '@hawk/admin';
import { getPool } from '@hawk/db';
import { NextResponse } from 'next/server';

interface VerifyRequest {
  tenantSlug: string;
  schemaName: string;
  email: string;
}

interface CheckResult {
  ok: boolean;
  label: string;
  detail?: string;
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body: VerifyRequest = await request.json();
    const { tenantSlug, schemaName, email } = body;
    const sql = getPool();

    const checks: CheckResult[] = [];

    // 1. Verify tenant exists in admin schema
    const admin = createAdminClientFromEnv();
    const tenant = await admin.getTenantBySlug(tenantSlug);
    checks.push({
      ok: !!tenant,
      label: 'Tenant registrado',
      detail: tenant ? `slot ${tenant.slug} — ${tenant.label}` : 'não encontrado',
    });

    // 2. Verify auth user exists in tenant schema
    const schema = schemaName || tenant?.schema_name || 'public';
    const users = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
      return tx.unsafe('SELECT id, email FROM auth_users WHERE email = $1 LIMIT 1', [email]);
    });
    const user = users[0] as Record<string, unknown> | undefined;

    checks.push({
      ok: !!user,
      label: 'Conta criada',
      detail: user ? `id: ${String(user.id).slice(0, 8)}...` : 'usuário não encontrado',
    });

    // 3. Verify profile exists
    if (user) {
      const profiles = await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
        return tx.unsafe(
          'SELECT id, name, onboarding_complete FROM profile WHERE id = $1 LIMIT 1',
          [user.id as string],
        );
      });
      const profile = profiles[0] as Record<string, unknown> | undefined;

      checks.push({
        ok: !!profile?.onboarding_complete,
        label: 'Perfil criado',
        detail: profile
          ? `${profile.name} — onboarding: ${profile.onboarding_complete ? 'completo' : 'incompleto'}`
          : 'perfil não encontrado',
      });
    }

    // 4. Verify key tables exist
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO "${schema}", public`);
        await tx.unsafe('SELECT 1 FROM profile LIMIT 0');
      });
      checks.push({ ok: true, label: 'Schema do banco aplicado', detail: 'tabelas ok' });
    } catch (err) {
      checks.push({
        ok: false,
        label: 'Schema do banco aplicado',
        detail: err instanceof Error ? err.message : 'falhou',
      });
    }

    const allOk = checks.every((c) => c.ok);
    return NextResponse.json({ ok: allOk, checks });
  } catch (error) {
    console.error('[verify-install] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 },
    );
  }
}
