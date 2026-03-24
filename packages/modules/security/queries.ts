import { db } from '@hawk/db';
import type {
  SecurityCategory,
  SecurityItem,
  SecurityStatus,
  UpdateSecurityItemInput,
} from './types';

export async function listSecurityItems(category?: SecurityCategory): Promise<SecurityItem[]> {
  let query = db
    .from('security_items')
    .select('*')
    .order('status', { ascending: true })
    .order('type', { ascending: true });
  if (category) query = query.eq('type', category);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list security items: ${error.message}`);
  return (data ?? []) as SecurityItem[];
}

export async function getPendingItems(): Promise<SecurityItem[]> {
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .in('status', ['needs_attention', 'critical'])
    .order('status', { ascending: true });
  if (error) throw new Error(`Failed to get pending items: ${error.message}`);
  return (data ?? []) as SecurityItem[];
}

export async function updateSecurityItem(
  id: string,
  input: UpdateSecurityItemInput,
): Promise<SecurityItem> {
  const updates: Record<string, unknown> = {};
  if (input.status) {
    updates.status = input.status;
    if (input.status === 'ok') updates.last_verified = new Date().toISOString().split('T')[0];
  }
  if (input.notes) updates.notes = input.notes;
  if (input.next_review) updates.next_review = input.next_review;

  const { data, error } = await db
    .from('security_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update security item: ${error.message}`);
  return data as SecurityItem;
}

export async function getSecuritySummary(): Promise<{
  ok: number;
  pendente: number;
  critico: number;
}> {
  const { data, error } = await db.from('security_items').select('status');
  if (error) throw new Error(`Failed to get security summary: ${error.message}`);
  const counts = { ok: 0, pendente: 0, critico: 0 };
  for (const row of data ?? []) {
    const s = row.status as SecurityStatus;
    if (s === 'ok') counts.ok++;
    else if (s === 'needs_attention') counts.pendente++;
    else if (s === 'critical') counts.critico++;
  }
  return counts;
}

export async function getDueForReview(): Promise<SecurityItem[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .not('next_review', 'is', null)
    .lte('next_review', today)
    .order('next_review', { ascending: true });
  if (error) throw new Error(`Failed to get items due for review: ${error.message}`);
  return (data ?? []) as SecurityItem[];
}
