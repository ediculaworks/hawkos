import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminClient() {
  const url = process.env.ADMIN_SUPABASE_URL;
  const key = process.env.ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Admin Supabase not configured');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('id');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const { data: metrics, error } = await supabase
      .from('tenant_metrics')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(30);

    if (error) throw error;

    const { data: audit } = await supabase
      .from('tenant_audit')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ metrics: metrics || [], audit: audit || [] });
  } catch (error) {
    console.error('[admin/tenant-details] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 },
    );
  }
}
