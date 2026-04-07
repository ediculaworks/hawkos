/**
 * Custom Automations — S3.2 Natural Language Cron
 *
 * Manages per-tenant custom cron jobs that run a message through the full agent pipeline.
 * Cron expressions are set by the LLM when the user says e.g. "lembra-me toda segunda às 9h".
 */

import { db, getCurrentSchema } from '@hawk/db';
import cron, { type ScheduledTask } from 'node-cron';
import type { CronTenantCtx } from './resolve-channel.js';
import { resolveChannel } from './resolve-channel.js';

export interface CustomAutomation {
  id: string;
  name: string;
  message: string;
  cron_expr: string;
  description: string | null;
  enabled: boolean;
}

/** Per-schema tenant context — needed for cron runner to scope DB calls. */
const tenantContexts = new Map<string, CronTenantCtx>();

/** Active cron tasks keyed by `${schemaName}:${automationId}`. */
const activeTasks = new Map<string, ScheduledTask>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a tenant context so its custom automations can start crons.
 * Called once at tenant startup.
 */
export function registerTenantForCustomCrons(ctx: CronTenantCtx): void {
  tenantContexts.set(ctx.schemaName, ctx);
}

/**
 * Load all enabled custom automations from DB and start their crons.
 * Must be called within a withSchema() context for the tenant.
 */
export async function loadAndStartCustomAutomations(ctx: CronTenantCtx): Promise<void> {
  const { data } = await db
    .from('custom_automations')
    .select('id, name, message, cron_expr, description, enabled')
    .eq('enabled', true);

  for (const row of (data ?? []) as CustomAutomation[]) {
    startCustomCron(row, ctx);
  }

  if ((data?.length ?? 0) > 0) {
    console.log(`[custom-cron] Loaded ${data?.length} automation(s) for tenant '${ctx.slug}'`);
  }
}

/**
 * Register a single custom automation as a cron job.
 * Validates the cron expression before registering.
 */
export function startCustomCron(automation: CustomAutomation, ctx: CronTenantCtx): void {
  if (!cron.validate(automation.cron_expr)) {
    console.warn(
      `[custom-cron] Invalid cron expr for '${automation.name}': ${automation.cron_expr}`,
    );
    return;
  }

  const key = `${ctx.schemaName}:${automation.id}`;
  activeTasks.get(key)?.stop();

  const task = cron.schedule(
    automation.cron_expr,
    () => {
      runCustomAutomation(automation, ctx).catch((err) =>
        console.error(`[custom-cron] '${automation.name}' failed:`, err),
      );
    },
    { timezone: 'America/Sao_Paulo' },
  );

  activeTasks.set(key, task);
}

/**
 * Stop and unregister a custom cron job.
 */
export function stopCustomCron(id: string, schemaName: string): void {
  const key = `${schemaName}:${id}`;
  activeTasks.get(key)?.stop();
  activeTasks.delete(key);
}

/**
 * Create a new custom automation: insert to DB + start cron.
 * Must be called within a withSchema() context.
 * Returns a human-readable confirmation string.
 */
export async function createCustomAutomation(args: {
  name: string;
  message: string;
  cron_expr: string;
  description?: string;
}): Promise<string> {
  if (!cron.validate(args.cron_expr)) {
    throw new Error(`Expressão cron inválida: "${args.cron_expr}"`);
  }

  const { data, error } = await db
    .from('custom_automations')
    .insert({
      name: args.name,
      message: args.message,
      cron_expr: args.cron_expr,
      description: args.description ?? null,
    })
    .select('id, name, message, cron_expr, description, enabled')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to insert automation');

  const automation = data as CustomAutomation;
  const schemaName = getCurrentSchema();
  const ctx = tenantContexts.get(schemaName);
  if (ctx) startCustomCron(automation, ctx);

  return `✅ Lembrete **${args.name}** criado${args.description ? ` — ${args.description}` : ''}.`;
}

/**
 * List all custom automations for the current tenant.
 * Must be called within a withSchema() context.
 */
export async function listCustomAutomations(): Promise<string> {
  const { data } = await db
    .from('custom_automations')
    .select('id, name, description, cron_expr, enabled')
    .order('created_at');

  if (!data || data.length === 0) return 'Nenhum lembrete ou automação configurado.';

  const rows = (data as (Omit<CustomAutomation, 'message'> & { id: string })[]).map((r) => {
    const status = r.enabled ? '✅' : '⏸';
    const label = r.description ?? r.cron_expr;
    return `${status} **${r.name}** — ${label} \`(id: ${r.id.slice(0, 8)})\``;
  });

  return `**Lembretes e automações (${data.length}):**\n${rows.join('\n')}`;
}

/**
 * Disable a custom automation by ID (soft-delete).
 * Must be called within a withSchema() context.
 */
export async function removeCustomAutomation(id: string): Promise<string> {
  const { error } = await db.from('custom_automations').update({ enabled: false }).eq('id', id);
  if (error) throw new Error(error.message);

  const schemaName = getCurrentSchema();
  stopCustomCron(id, schemaName);
  return '✅ Lembrete removido.';
}

// ── Internal runner ────────────────────────────────────────────────────────────

async function runCustomAutomation(
  automation: CustomAutomation,
  ctx: CronTenantCtx,
): Promise<void> {
  const { withSchema } = await import('@hawk/db');
  const { handleStreamingMessage } = await import('../handler.js');
  const { sendToChannel } = await import('../channels/discord.js');

  const channelId = resolveChannel(ctx.slug);
  if (!channelId) {
    console.warn(`[custom-cron] No channel for tenant '${ctx.slug}', skipping`);
    return;
  }

  await withSchema(ctx.schemaName, async () => {
    const response = await handleStreamingMessage(automation.message, channelId);
    if (response) {
      await sendToChannel(channelId, response, ctx.slug);
    }
  });
}
