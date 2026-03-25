import { requireAdminAuth } from '@/lib/admin-auth';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface VerifyRequest {
  tenantSlug: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
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
    const { tenantSlug, supabaseUrl, supabaseServiceKey, email } = body;

    const checks: CheckResult[] = [];

    // 1. Verify tenant exists in Admin Supabase
    const adminUrl = process.env.ADMIN_SUPABASE_URL;
    const adminKey = process.env.ADMIN_SUPABASE_SERVICE_KEY;
    if (adminUrl && adminKey) {
      const admin = createClient(adminUrl, adminKey, { auth: { persistSession: false } });
      const { data: tenant } = await admin
        .from('tenants')
        .select('slug, status, label')
        .eq('slug', tenantSlug)
        .maybeSingle();

      checks.push({
        ok: !!tenant,
        label: 'Tenant registrado no Admin',
        detail: tenant ? `slot ${tenant.slug} — ${tenant.label}` : 'não encontrado',
      });
    }

    // 2. Verify auth user exists in tenant Supabase
    const tenant = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: usersData, error: usersError } = await tenant.auth.admin.listUsers();
    const user = usersData?.users?.find((u) => u.email === email);

    checks.push({
      ok: !!user && !usersError,
      label: 'Conta criada no Supabase Auth',
      detail: user
        ? `id: ${user.id.slice(0, 8)}... confirmed: ${user.email_confirmed_at ? 'sim' : 'não'}`
        : usersError?.message || 'usuário não encontrado',
    });

    // 3. Verify profile exists
    if (user) {
      const { data: profile } = await tenant
        .from('profile')
        .select('id, name, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle();

      checks.push({
        ok: !!profile?.onboarding_complete,
        label: 'Perfil criado',
        detail: profile
          ? `${profile.name} — onboarding: ${profile.onboarding_complete ? 'completo' : 'incompleto'}`
          : 'perfil não encontrado',
      });
    }

    // 4. Verify key tables exist
    const { error: tableError } = await tenant.from('profile').select('id').limit(0);
    checks.push({
      ok: !tableError,
      label: 'Schema do banco aplicado',
      detail: tableError ? tableError.message : 'tabelas ok',
    });

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
