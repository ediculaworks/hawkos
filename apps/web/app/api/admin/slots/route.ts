import { createAdminClientFromEnv } from '@hawk/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const admin = createAdminClientFromEnv();
    const slots = await admin.getAvailableSlots();

    return NextResponse.json({
      slots,
      available: slots.filter((s) => s.status === 'available').length,
      occupied: slots.filter((s) => s.status === 'occupied').length,
    });
  } catch (error) {
    console.error('[admin/slots] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch slots' },
      { status: 500 },
    );
  }
}
