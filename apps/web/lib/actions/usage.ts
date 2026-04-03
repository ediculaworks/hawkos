'use server';

import { getPool } from '@hawk/db';

export interface DailyUsageEntry {
  date: string;
  tokens: number;
  cost: number;
  api_calls: number;
}

export interface ErrorSummaryEntry {
  event_type: string;
  component: string;
  count: number;
  last_seen: string;
}

/**
 * Fetch daily token usage history from admin.tenant_metrics.
 * Returns last N days of usage for the current tenant.
 */
export async function fetchUsageHistory(days = 7): Promise<DailyUsageEntry[]> {
  try {
    const sql = getPool();
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      return tx.unsafe(
        `SELECT
          date::text,
          COALESCE(tokens_used, 0) as tokens,
          COALESCE(tokens_cost_usd, 0) as cost,
          COALESCE(api_calls, 0) as api_calls
        FROM tenant_metrics
        WHERE date >= CURRENT_DATE - $1::int
        ORDER BY date ASC`,
        [days],
      );
    });
    return (rows as DailyUsageEntry[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch error summary from activity_log.
 * Groups errors by type/component and returns counts.
 */
export async function fetchErrorSummary(days = 7): Promise<ErrorSummaryEntry[]> {
  try {
    const sql = getPool();
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      return tx.unsafe(
        `SELECT
          event_type,
          COALESCE(metadata->>'component', 'system') as component,
          COUNT(*)::int as count,
          MAX(created_at)::text as last_seen
        FROM activity_log
        WHERE event_type IN ('error', 'client_error')
          AND created_at >= CURRENT_DATE - $1::int
        GROUP BY event_type, metadata->>'component'
        ORDER BY count DESC
        LIMIT 10`,
        [days],
      );
    });
    return (rows as ErrorSummaryEntry[]) ?? [];
  } catch {
    return [];
  }
}
