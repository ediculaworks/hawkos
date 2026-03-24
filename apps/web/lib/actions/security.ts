'use server';

import {
  getPendingItems,
  getSecuritySummary,
  listSecurityItems,
  updateSecurityItem,
} from '@hawk/module-security/queries';
import { withTenant } from '../supabase/with-tenant';

import type { SecurityCategory, SecurityItem } from '@hawk/module-security/types';

export async function fetchSecurityItems(category?: SecurityCategory): Promise<SecurityItem[]> {
  return withTenant(async () => listSecurityItems(category));
}

export async function fetchPendingSecurityItems(): Promise<SecurityItem[]> {
  return withTenant(async () => getPendingItems());
}

export async function fetchSecuritySummary(): Promise<{
  ok: number;
  pendente: number;
  critico: number;
}> {
  return withTenant(async () => getSecuritySummary());
}

export async function updateSecurityItemAction(
  id: string,
  input: { status?: 'ok' | 'needs_attention' | 'critical'; notes?: string; next_review?: string },
): Promise<SecurityItem> {
  return withTenant(async () => updateSecurityItem(id, input));
}
