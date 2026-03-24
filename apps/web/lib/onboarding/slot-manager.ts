import type { TenantSlot } from './types';

const MAX_SLOTS = 6;

export function getAvailableSlots(): TenantSlot[] {
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

  return slots;
}

export function getConfiguredSlots(): TenantSlot[] {
  return getAvailableSlots().filter((slot) => slot.configured);
}

export function isSlotConfigured(slot: string): boolean {
  const slotName = slot as `TEN${number}`;
  return !!(
    process.env[`SUPABASE_URL_${slotName}`] &&
    process.env[`SUPABASE_ANON_KEY_${slotName}`] &&
    process.env[`SUPABASE_SERVICE_ROLE_KEY_${slotName}`]
  );
}

export function getSlotConfig(slot: string): {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
} | null {
  const slotName = slot as `TEN${number}`;
  const url = process.env[`SUPABASE_URL_${slotName}`];
  const anonKey = process.env[`SUPABASE_ANON_KEY_${slotName}`];
  const serviceRoleKey = process.env[`SUPABASE_SERVICE_ROLE_KEY_${slotName}`];

  if (!url || !anonKey || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl: url, anonKey, serviceRoleKey };
}

export function generateAgentPort(slot: string): number {
  const slotNumber = Number.parseInt(slot.replace('TEN', ''), 10);
  return 3000 + slotNumber;
}

export function generateSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
