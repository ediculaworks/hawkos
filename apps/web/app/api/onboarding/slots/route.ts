import type { TenantSlot } from '@/lib/onboarding/types';
import { NextResponse } from 'next/server';

const MAX_SLOTS = 6;

export async function GET() {
  const slots: TenantSlot[] = [];

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const slotName = `TEN${i}` as const;
    const url = process.env[`SUPABASE_URL_${slotName}`];
    const anonKey = process.env[`SUPABASE_ANON_KEY_${slotName}`];
    const serviceRoleKey = process.env[`SUPABASE_SERVICE_ROLE_KEY_${slotName}`];

    if (url && anonKey && serviceRoleKey) {
      slots.push({
        name: slotName,
        configured: true,
        occupied: false,
        supabaseUrl: url,
      });
    } else {
      slots.push({
        name: slotName,
        configured: false,
        occupied: false,
      });
    }
  }

  const configuredCount = slots.filter((s) => s.configured).length;
  const availableCount = slots.filter((s) => !s.occupied).length;

  return NextResponse.json({
    slots,
    configured: configuredCount,
    available: availableCount,
  });
}
