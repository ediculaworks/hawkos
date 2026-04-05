import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
import type {
  CreateSecurityItemInput,
  SecurityAuditLog,
  SecurityCategory,
  SecurityItem,
  SecurityStatus,
  UpdateSecurityItemInput,
} from './types';
const logger = createLogger('security');

export async function listSecurityItems(category?: SecurityCategory): Promise<SecurityItem[]> {
  let query = db
    .from('security_items')
    .select('*')
    .order('status', { ascending: true })
    .order('type', { ascending: true });
  if (category) query = query.eq('type', category);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list security items');
    throw new HawkError(`Failed to list security items: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SecurityItem[];
}

export async function getPendingItems(): Promise<SecurityItem[]> {
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .in('status', ['needs_attention', 'critical'])
    .order('status', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get pending items');
    throw new HawkError(`Failed to get pending items: ${error.message}`, 'DB_QUERY_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to update security item');
    throw new HawkError(`Failed to update security item: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as SecurityItem;
}

export async function getSecuritySummary(): Promise<{
  ok: number;
  pendente: number;
  critico: number;
}> {
  const { data, error } = await db.from('security_items').select('status');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get security summary');
    throw new HawkError(`Failed to get security summary: ${error.message}`, 'DB_QUERY_FAILED');
  }
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
  if (error) {
    logger.error({ error: error.message }, 'Failed to get items due for review');
    throw new HawkError(`Failed to get items due for review: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SecurityItem[];
}

export async function createSecurityItem(input: CreateSecurityItemInput): Promise<SecurityItem> {
  const { data, error } = await db
    .from('security_items')
    .insert({
      name: input.name,
      type: input.type,
      status: input.status ?? 'needs_attention',
      notes: input.notes ?? null,
      next_review: input.next_review ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to create security item');
    throw new HawkError(`Failed to create security item: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as SecurityItem;
}

export async function deleteSecurityItem(id: string): Promise<void> {
  const { error } = await db.from('security_items').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete security item');
    throw new HawkError(`Failed to delete security item: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function getSecurityAuditLog(itemId: string, limit = 20): Promise<SecurityAuditLog[]> {
  const { data, error } = await db
    .from('security_audit_log')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to get security audit log');
    throw new HawkError(`Failed to get security audit log: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SecurityAuditLog[];
}

export async function getExpiringItems(days = 30): Promise<SecurityItem[]> {
  const today = new Date().toISOString().split('T')[0] as string;
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split('T')[0] as string;
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .gte('next_review', today)
    .lte('next_review', futureStr)
    .order('next_review', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get expiring items');
    throw new HawkError(`Failed to get expiring items: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SecurityItem[];
}

export async function getDetailedSecuritySummary(): Promise<{
  total: number;
  by_status: Record<SecurityStatus, number>;
  by_category: Record<string, number>;
  overdue_reviews: number;
}> {
  const today = new Date().toISOString().split('T')[0] as string;
  const { data, error } = await db.from('security_items').select('type, status, next_review');
  if (error) {
    logger.error({ error: error.message }, 'Failed to get detailed security summary');
    throw new HawkError(
      `Failed to get detailed security summary: ${error.message}`,
      'DB_QUERY_FAILED',
    );
  }
  const items = data ?? [];
  const by_status: Record<SecurityStatus, number> = { ok: 0, needs_attention: 0, critical: 0 };
  const by_category: Record<string, number> = {};
  let overdue_reviews = 0;
  for (const item of items) {
    by_status[item.status as SecurityStatus] = (by_status[item.status as SecurityStatus] ?? 0) + 1;
    by_category[item.type] = (by_category[item.type] ?? 0) + 1;
    if (item.next_review && item.next_review < today) overdue_reviews++;
  }
  return { total: items.length, by_status, by_category, overdue_reviews };
}

export async function getRecentItems(days = 7): Promise<SecurityItem[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get recent items');
    throw new HawkError(`Failed to get recent items: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as SecurityItem[];
}

export async function markReviewComplete(itemId: string, notes?: string): Promise<SecurityItem> {
  const today = new Date().toISOString().split('T')[0] as string;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + 90);
  const nextReviewStr = nextReview.toISOString().split('T')[0] as string;
  const { data, error } = await db
    .from('security_items')
    .update({
      status: 'ok',
      last_verified: today,
      next_review: nextReviewStr,
      ...(notes ? { notes } : {}),
    })
    .eq('id', itemId)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to mark review complete');
    throw new HawkError(`Failed to mark review complete: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  db.from('security_audit_log')
    .insert({
      item_id: itemId,
      action: 'review_completed',
      old_status: null,
      new_status: 'ok',
      notes: notes ?? null,
    })
    .then(() => {})
    .catch(() => {});
  return data as SecurityItem;
}

export async function listByCategory(category: SecurityCategory): Promise<SecurityItem[]> {
  return listSecurityItems(category);
}

export async function getComplianceStatus(): Promise<{
  compliant: boolean;
  critical_count: number;
  overdue_count: number;
  items_needing_attention: SecurityItem[];
}> {
  const today = new Date().toISOString().split('T')[0] as string;
  const { data, error } = await db
    .from('security_items')
    .select('*')
    .or('status.eq.critical,status.eq.needs_attention')
    .order('status', { ascending: true });
  if (error) {
    logger.error({ error: error.message }, 'Failed to get compliance status');
    throw new HawkError(`Failed to get compliance status: ${error.message}`, 'DB_QUERY_FAILED');
  }
  const items = (data ?? []) as SecurityItem[];
  const critical_count = items.filter((i) => i.status === 'critical').length;
  const overdue_count = items.filter((i) => i.next_review && i.next_review < today).length;
  return {
    compliant: critical_count === 0 && overdue_count === 0,
    critical_count,
    overdue_count,
    items_needing_attention: items,
  };
}
