'use server';

import { withTenant } from '@/lib/supabase/with-tenant';
import { db } from '@hawk/db';

export interface ActivityEntry {
  id: string;
  event_type: string;
  summary: string;
  module: string | null;
  created_at: string | null;
}

export interface ActivityStats {
  totalToday: number;
  byType: Record<string, number>;
  byModule: Record<string, number>;
  recentEntries: ActivityEntry[];
}

/**
 * Fetch activity log stats for the observability dashboard.
 */
export async function fetchActivityStats(): Promise<ActivityStats> {
  return withTenant(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch today's activity
    const { data, count } = await db
      .from('activity_log')
      .select('id, event_type, summary, module, created_at', { count: 'exact' })
      .gte('created_at', `${todayStr}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(50);

    const entries = (data ?? []) as ActivityEntry[];

    const byType: Record<string, number> = {};
    const byModule: Record<string, number> = {};

    for (const entry of entries) {
      byType[entry.event_type] = (byType[entry.event_type] ?? 0) + 1;
      if (entry.module) {
        byModule[entry.module] = (byModule[entry.module] ?? 0) + 1;
      }
    }

    return {
      totalToday: count ?? entries.length,
      byType,
      byModule,
      recentEntries: entries.slice(0, 10),
    };
  });
}

export interface DataExport {
  exportedAt: string;
  memories: unknown[];
  transactions: unknown[];
  people: unknown[];
  habits: unknown[];
  tasks: unknown[];
  events: unknown[];
}

/**
 * Export all user data for GDPR compliance.
 */
export async function exportAllData(): Promise<DataExport> {
  return withTenant(async () => {
    const [memories, transactions, people, habits, tasks, events] = await Promise.all([
      db.from('agent_memories').select('*').eq('status', 'active').limit(1000).then((r) => r.data ?? []),
      db.from('finance_transactions').select('*').order('date', { ascending: false }).limit(1000).then((r) => r.data ?? []),
      db.from('people').select('*').limit(500).then((r) => r.data ?? []),
      db.from('habits').select('*').limit(200).then((r) => r.data ?? []),
      db.from('tasks').select('*').limit(1000).then((r) => r.data ?? []),
      db.from('calendar_events').select('*').limit(1000).then((r) => r.data ?? []),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      memories,
      transactions,
      people,
      habits,
      tasks,
      events,
    };
  });
}
