import { requireAdminAuth } from '@/lib/admin-auth';
import { invalidateTenantCache } from '@/lib/tenants/cache';
import { createAdminClientFromEnv } from '@hawk/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const admin = createAdminClientFromEnv();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');

    if (slug) {
      const tenant = await admin.getTenantBySlug(slug);
      return NextResponse.json({ tenants: tenant ? [tenant] : [] });
    }
    if (id) {
      const tenant = await admin.getTenantById(id);
      return NextResponse.json({ tenants: tenant ? [tenant] : [] });
    }

    const tenants = await admin.listTenants();
    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('[admin/tenants] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tenants' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const admin = createAdminClientFromEnv();

    const result = await admin.createTenant({
      label: body.label,
      discordConfig: body.discordConfig,
      openrouterConfig: body.openrouterConfig,
    });

    if (!result.success || !result.tenant) {
      return NextResponse.json(
        { error: result.error || 'Failed to create tenant' },
        { status: 400 },
      );
    }

    invalidateTenantCache(result.tenant.slug);

    // Notify agent to hot-load the new tenant (best-effort, non-blocking)
    const agentUrl = process.env.AGENT_INTERNAL_URL || 'http://localhost:3001';
    const agentSecret = process.env.AGENT_API_SECRET;
    fetch(`${agentUrl}/admin/tenants/${result.tenant.slug}/start`, {
      method: 'POST',
      headers: agentSecret ? { Authorization: `Bearer ${agentSecret}` } : {},
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Agent may not be running yet during initial onboarding — that's OK
      console.log(
        `[admin/tenants] Agent notification skipped for ${result.tenant!.slug} (agent may not be running)`,
      );
    });

    return NextResponse.json({ tenant: result.tenant, envContent: '' });
  } catch (error) {
    console.error('[admin/tenants] Error:', error);
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
