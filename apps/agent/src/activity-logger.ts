/**
 * Activity logging — writes events to activity_log table.
 * Extracted from handler.ts for reuse across agent components.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const activityDb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export { activityDb };

export async function logActivity(
  eventType: string,
  summary: string,
  moduleName?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const logLine = `[activity] ${eventType} ${moduleName ?? '-'}: ${summary}`;
  if (eventType === 'error') {
    console.error(logLine);
  }

  if (!activityDb) return;

  try {
    await (
      activityDb as unknown as {
        from: (table: string) => {
          insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }>;
        };
      }
    )
      .from('activity_log')
      .insert({
        event_type: eventType,
        module: moduleName ?? undefined,
        summary,
        metadata: metadata ?? {},
      });
  } catch (err) {
    console.error('[activity-logger] Failed to write:', err);
  }
}
