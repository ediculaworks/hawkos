import { createAdminClientFromEnv } from '@hawk/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const admin = createAdminClientFromEnv();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const metrics = await admin.getTenantMetrics(tenantId, 30);
    const audit = await admin.getTenantAudit(tenantId, 50);

    return NextResponse.json({ metrics, audit });
  } catch (error) {
    console.error('[admin/tenant-details] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 },
    );
  }
}
