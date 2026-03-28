// Shared helper: check if an automation is enabled via automation_configs table
// This allows the web UI toggle at /dashboard/automations to control cron execution

import { db } from '@hawk/db';

/**
 * Check if an automation is enabled in the automation_configs table.
 * Returns true by default if the record doesn't exist (opt-out model).
 */
export async function isAutomationEnabled(automationId: string): Promise<boolean> {
  try {
    const { data } = await db
      .from('automation_configs')
      .select('enabled')
      .eq('id', automationId)
      .single();
    return data?.enabled ?? true;
  } catch {
    // Table/row missing — default to enabled
    return true;
  }
}

/**
 * Update last_run and status after an automation executes.
 */
export async function markAutomationRun(
  automationId: string,
  status: 'success' | 'failure',
  errorMessage?: string,
): Promise<void> {
  try {
    // First get current run_count to increment
    const { data: current } = await db
      .from('automation_configs')
      .select('run_count')
      .eq('id', automationId)
      .single();

    await db
      .from('automation_configs')
      .update({
        last_run: new Date().toISOString(),
        last_status: status,
        run_count: (current?.run_count ?? 0) + 1,
        error_message: errorMessage ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', automationId);
  } catch {
    // Non-critical — don't break the automation
  }
}
