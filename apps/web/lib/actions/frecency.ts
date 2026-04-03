'use server';

import { withTenant } from '@/lib/supabase/with-tenant';
import { db } from '@hawk/db';

export interface ModuleFrecency {
  module_id: string;
  frecency_score: number;
  access_7d: number;
  last_accessed: string | null;
}

/**
 * Log a module page view for frecency tracking.
 */
export async function trackModuleAccess(
  moduleId: string,
  accessType: 'page_view' | 'widget_interact' | 'tool_call' | 'search' = 'page_view',
): Promise<void> {
  return withTenant(async () => {
    await db.from('module_access_log').insert({
      module_id: moduleId,
      access_type: accessType,
    });
  });
}

/**
 * Fetch frecency scores for all modules.
 * Uses the materialized view for fast reads.
 */
export async function fetchModuleFrecency(): Promise<ModuleFrecency[]> {
  return withTenant(async () => {
    const { data, error } = await db
      .from('module_frecency')
      .select('module_id, frecency_score, access_7d, last_accessed')
      .order('frecency_score', { ascending: false });

    if (error) {
      // Fallback: query access_log directly if materialized view doesn't exist
      const { data: fallbackData } = await db
        .from('module_access_log')
        .select('module_id')
        .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString());

      if (!fallbackData) return [];

      const counts = new Map<string, number>();
      for (const row of fallbackData) {
        counts.set(row.module_id, (counts.get(row.module_id) ?? 0) + 1);
      }

      return [...counts.entries()]
        .map(([module_id, count]) => ({
          module_id,
          frecency_score: count,
          access_7d: count,
          last_accessed: null,
        }))
        .sort((a, b) => b.frecency_score - a.frecency_score);
    }

    return (data ?? []) as ModuleFrecency[];
  });
}

/**
 * Refresh the materialized view (call from cron or admin).
 */
export async function refreshFrecency(): Promise<void> {
  return withTenant(async () => {
    await db.rpc('refresh_module_frecency');
  });
}
