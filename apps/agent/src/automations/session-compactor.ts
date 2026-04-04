import { getCurrentSchema } from '@hawk/db';
import { archiveExpiredMemories } from '@hawk/module-memory/queries';
import { commitSession, findExpiredSessions } from '@hawk/module-memory/session-commit';

/**
 * Session Compactor Automation
 *
 * Runs hourly via node-cron. Finds expired sessions (no activity for 30+ min)
 * and commits them: archive messages, extract memories, deduplicate, persist.
 *
 * OpenViking-inspired session lifecycle management.
 */

/** Per-tenant lock — keyed by schema name from AsyncLocalStorage */
const activeRuns = new Set<string>();

export async function runSessionCompactor(): Promise<void> {
  const schema = getCurrentSchema();

  // Prevent overlapping runs per tenant (e.g. if compaction takes >1h)
  if (activeRuns.has(schema)) {
    return;
  }

  activeRuns.add(schema);
  try {
    // Cleanup expired memories on each compactor run
    const expiredCount = await archiveExpiredMemories().catch(() => 0);
    if (expiredCount > 0) {
      console.log(`[session-compactor] Archived ${expiredCount} expired memories`);
    }

    const expiredSessions = await findExpiredSessions();

    if (expiredSessions.length === 0) return;

    console.log(`[session-compactor] Processing ${expiredSessions.length} expired sessions`);

    for (const sessionId of expiredSessions) {
      try {
        const result = await commitSession(sessionId);

        if (result.archived) {
          console.log(
            `[session-compactor] Archived session ${sessionId}: ${result.memoriesExtracted ?? 0} memories extracted`,
          );
        }
      } catch (err) {
        console.error(`[session-compactor] Failed to commit session ${sessionId}:`, err);
      }
    }
  } catch (err) {
    console.error('[session-compactor] Failed to find expired sessions:', err);
  } finally {
    activeRuns.delete(schema);
  }
}
