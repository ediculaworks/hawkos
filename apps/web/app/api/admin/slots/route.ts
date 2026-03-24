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

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('tenant_availability')
      .select('*')
      .order('slot_number');

    if (error) throw error;

    return NextResponse.json({
      slots: data || [],
      available: (data || []).filter((s: { status: string }) => s.status === 'available').length,
      occupied: (data || []).filter((s: { status: string }) => s.status === 'occupied').length,
    });
  } catch (error) {
    console.error('[admin/slots] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch slots' },
      { status: 500 },
    );
  }
}
