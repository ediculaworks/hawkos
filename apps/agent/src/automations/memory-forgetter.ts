/**
 * Memory Forgetter — auto-archives memories that haven't been accessed in a long time.
 * Runs weekly (Sunday 04:00, after adaptive half-lives at 03:00).
 *
 * Policy:
 * - Memories with access_count=0 older than 90 days → archive
 * - Memories with access_count>0 but last accessed >180 days ago → archive
 * - Never archive: memory_type='profile' or importance >= 9
 */

import { db } from '@hawk/db';
import { createLogger, HawkError } from '@hawk/shared';
import cron from 'node-cron';
import { logActivity } from '../activity-logger.js';
import { isAutomationEnabled, markAutomationRun } from './config.js';

const logger = createLogger('memory-forgetter');

export async function runMemoryForgetter(): Promise<void> {
  if (!(await isAutomationEnabled('memory-forgetter'))) {
    logger.info('Memory forgetter is disabled — skipping');
    return;
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneEightyDaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Archive never-accessed memories older than 90 days
    const { data: neverAccessed, error: err1 } = await db
      .from('agent_memories')
      .update({ status: 'archived' })
      .eq('status', 'active')
      .eq('access_count', 0)
      .lt('created_at', ninetyDaysAgo)
      .neq('memory_type', 'profile')
      .lt('importance', 9)
      .select('id');

    if (err1) {
      throw new HawkError(`Failed to archive never-accessed memories: ${err1.message}`, 'DB_UPDATE_FAILED');
    }

    const neverAccessedCount = neverAccessed?.length ?? 0;

    // Archive memories with access_count>0 but last accessed >180 days ago
    const { data: staleAccessed, error: err2 } = await db
      .from('agent_memories')
      .update({ status: 'archived' })
      .eq('status', 'active')
      .gt('access_count', 0)
      .lt('last_accessed', oneEightyDaysAgo)
      .neq('memory_type', 'profile')
      .lt('importance', 9)
      .select('id');

    if (err2) {
      throw new HawkError(`Failed to archive stale memories: ${err2.message}`, 'DB_UPDATE_FAILED');
    }

    const staleAccessedCount = staleAccessed?.length ?? 0;
    const totalArchived = neverAccessedCount + staleAccessedCount;

    logger.info(
      { neverAccessed: neverAccessedCount, staleAccessed: staleAccessedCount, total: totalArchived },
      'Memory forgetter completed',
    );

    await logActivity(
      'memory_forgetter',
      `Archived ${totalArchived} memories (${neverAccessedCount} never accessed >90d, ${staleAccessedCount} stale >180d)`,
      'memory',
      { never_accessed_count: neverAccessedCount, stale_accessed_count: staleAccessedCount, total_archived: totalArchived },
    );

    await markAutomationRun('memory-forgetter', 'success');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ error: message }, 'Memory forgetter failed');
    await markAutomationRun('memory-forgetter', 'failure', message);
    throw err;
  }
}

export function startMemoryForgetterCron(): void {
  cron.schedule('0 4 * * 0', () => {
    runMemoryForgetter().catch((err) => {
      console.error('[memory-forgetter] Failed:', err);
    });
  });
}
