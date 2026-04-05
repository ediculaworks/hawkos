'use server';

import { createAdminClientFromEnv } from '@hawk/admin';
import { createUser } from '@hawk/auth';
import { getPool } from '@hawk/db';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/session';

export async function fetchAdminOverview() {
  await requireAdmin();
  const sql = getPool();

  // Query admin.tenants for total/active counts
  const tenants = await sql.unsafe(`
    SELECT count(*) as total,
           count(*) FILTER (WHERE status = 'active') as active
    FROM admin.tenants
  `);

  // Query today's metrics
  const metrics = await sql.unsafe(`
    SELECT COALESCE(SUM(messages_count), 0) as total_messages,
           COALESCE(SUM(tokens_used), 0) as total_tokens,
           COALESCE(SUM(cost_usd), 0) as total_cost
    FROM admin.tenant_metrics
    WHERE date = CURRENT_DATE
  `);

  return {
    totalTenants: Number(tenants[0]?.total ?? 0),
    activeTenants: Number(tenants[0]?.active ?? 0),
    todayMessages: Number(metrics[0]?.total_messages ?? 0),
    todayTokens: Number(metrics[0]?.total_tokens ?? 0),
    todayCost: Number(metrics[0]?.total_cost ?? 0),
  };
}

export async function fetchTenantList() {
  await requireAdmin();
  const sql = getPool();

  const rows = await sql.unsafe(`
    SELECT t.id, t.slug, t.label, t.status, t.schema_name, t.owner_email, t.created_at, t.updated_at,
           COALESCE(m.messages_count, 0) as today_messages,
           COALESCE(m.tokens_used, 0) as today_tokens,
           COALESCE(m.cost_usd, 0) as today_cost
    FROM admin.tenants t
    LEFT JOIN admin.tenant_metrics m ON m.tenant_id = t.id AND m.date = CURRENT_DATE
    ORDER BY t.slug
  `);

  // For each tenant, also get memory count and last activity
  const result = [];
  for (const row of rows) {
    let memoryCount = 0;
    let lastActivity: string | null = null;

    try {
      const memRows = await sql.unsafe(
        `SELECT count(*) as cnt FROM "${row.schema_name}".agent_memories`,
      );
      memoryCount = Number(memRows[0]?.cnt ?? 0);
    } catch {
      /* schema may not have memories table */
    }

    try {
      const actRows = await sql.unsafe(
        `SELECT created_at FROM "${row.schema_name}".activity_log ORDER BY created_at DESC LIMIT 1`,
      );
      lastActivity = actRows[0]?.created_at ? String(actRows[0].created_at) : null;
    } catch {
      /* no activity yet */
    }

    result.push({
      id: String(row.id),
      slug: String(row.slug),
      label: String(row.label ?? ''),
      status: String(row.status),
      schemaName: String(row.schema_name),
      ownerEmail: row.owner_email ? String(row.owner_email) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      todayMessages: Number(row.today_messages),
      todayTokens: Number(row.today_tokens),
      todayCost: Number(row.today_cost),
      memoryCount,
      lastActivity,
    });
  }

  return result;
}

export async function fetchActivityFeed(limit = 50) {
  await requireAdmin();
  const sql = getPool();

  const rows = await sql.unsafe(
    `
    SELECT a.id, a.action, a.details, a.performed_by, a.created_at,
           t.slug, t.label
    FROM admin.tenant_audit a
    LEFT JOIN admin.tenants t ON t.id = a.tenant_id
    ORDER BY a.created_at DESC
    LIMIT $1
  `,
    [limit],
  );

  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    action: String(r.action ?? ''),
    details: (r.details ?? {}) as Record<string, unknown>,
    performedBy: String(r.performed_by ?? ''),
    createdAt: String(r.created_at),
    tenantSlug: String(r.slug ?? ''),
    tenantLabel: String(r.label ?? ''),
  }));
}

export async function updateTenantStatus(tenantId: string, status: string) {
  await requireAdmin();
  const sql = getPool();

  const validStatuses = ['active', 'pending', 'inactive', 'suspended'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  await sql.unsafe('UPDATE admin.tenants SET status = $1, updated_at = now() WHERE id = $2', [
    status,
    tenantId,
  ]);

  return { success: true };
}

export async function createTenantAction(data: {
  label: string;
  email: string;
  password: string;
  discordConfig?: {
    bot_token?: string;
    client_id?: string;
    guild_id?: string;
    channel_id?: string;
    authorized_user_id?: string;
  };
  openrouterConfig?: {
    api_key?: string;
  };
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requireAdmin();

  const sql = getPool();

  try {
    // 1. Create the tenant schema + record
    const admin = createAdminClientFromEnv();
    const result = await admin.createTenant({
      label: data.label,
      discordConfig: data.discordConfig,
      openrouterConfig: data.openrouterConfig,
    });
    if (!result.success || !result.tenant) {
      return { ok: false, error: result.error ?? 'Erro ao criar tenant' };
    }

    const { slug, schema_name: schemaName, id: tenantId } = result.tenant;

    // 2. Create user account in the tenant schema
    const userResult = await createUser(data.email, data.password, schemaName);
    if (userResult.error) {
      // Rollback: delete the tenant record and schema we just created
      try {
        await sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await sql.unsafe('DELETE FROM admin.tenants WHERE id = $1', [tenantId]);
      } catch {
        /* best-effort rollback */
      }
      return { ok: false, error: `Erro ao criar utilizador: ${userResult.error}` };
    }

    // 3. Set owner_email on the tenant row
    await sql.unsafe('UPDATE admin.tenants SET owner_email = $1, status = $2 WHERE id = $3', [
      data.email,
      'active',
      tenantId,
    ]);

    // 4. Notify agent to apply full migrations + hot-load (best-effort)
    const agentUrl = process.env.AGENT_INTERNAL_URL ?? 'http://localhost:3001';
    const agentSecret = process.env.AGENT_API_SECRET;
    fetch(`${agentUrl}/admin/tenants/${slug}/start`, {
      method: 'POST',
      headers: agentSecret ? { Authorization: `Bearer ${agentSecret}` } : {},
      signal: AbortSignal.timeout(30_000),
    }).catch(() => {
      console.warn(`[admin] Agent notification skipped for ${slug}`);
    });

    revalidatePath('/dashboard/admin');
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao criar tenant' };
  }
}

const TABLES_TO_WIPE = [
  'session_memories',
  'agent_conversations',
  'conversation_summaries',
  'conversation_messages',
  'session_archives',
  'agent_messages',
  'agent_memories',
  'activity_log',
  'medication_logs',
  'medications',
  'conditions',
  'substance_logs',
  'lab_results',
  'body_measurements',
  'nutrition_logs',
  'workout_sets',
  'workout_sessions',
  'sleep_sessions',
  'health_observations',
  'finance_transactions',
  'finance_recurring',
  'finance_accounts',
  'finance_categories',
  'calendar_reminders',
  'calendar_attendees',
  'calendar_events',
  'calendar_sync_config',
  'habit_logs',
  'habits',
  'journal_entries',
  'tasks',
  'objectives',
  'interactions',
  'people',
  'work_logs',
  'projects',
  'workspaces',
  'legal_obligations',
  'contracts',
  'legal_entities',
  'knowledge_notes',
  'books',
  'documents',
  'assets',
  'maintenance_logs',
  'housing_bills',
  'residences',
  'security_items',
  'media_items',
  'hobby_logs',
  'social_posts',
  'social_goals',
  'reflections',
  'personal_values',
  'entity_tags',
  'tags',
  'data_gaps',
  'onboarding_questions',
  'modules',
];

export async function resetTenantData(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const sql = getPool();

  const rows = await sql.unsafe('SELECT schema_name FROM admin.tenants WHERE id = $1', [tenantId]);
  const schemaName = rows[0]?.schema_name as string | undefined;
  if (!schemaName) return { ok: false, error: 'Tenant não encontrado' };

  try {
    for (const table of TABLES_TO_WIPE) {
      try {
        await sql.unsafe(`DELETE FROM "${schemaName}".${table}`);
      } catch {
        /* table may not exist — skip */
      }
    }

    // Reset profile
    try {
      await sql.unsafe(
        `UPDATE "${schemaName}".profile SET name = 'User', birth_date = '2000-01-01', metadata = '{}', onboarding_complete = false, cpf = null`,
      );
    } catch {
      /* skip */
    }

    // Clear integration_configs (tenant-level API keys, not admin.tenants credentials)
    try {
      await sql.unsafe(`DELETE FROM "${schemaName}".integration_configs`);
    } catch {
      /* skip */
    }

    // Re-seed modules as disabled
    const moduleIds = [
      'finances',
      'health',
      'people',
      'career',
      'objectives',
      'knowledge',
      'routine',
      'assets',
      'entertainment',
      'legal',
      'social',
      'spirituality',
      'housing',
      'security',
      'calendar',
      'journal',
    ];
    for (const id of moduleIds) {
      try {
        await sql.unsafe(
          `INSERT INTO "${schemaName}".modules (id, enabled) VALUES ($1, false)
           ON CONFLICT (id) DO UPDATE SET enabled = false`,
          [id],
        );
      } catch {
        /* skip */
      }
    }

    revalidatePath('/dashboard/admin');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao limpar dados' };
  }
}

export async function deleteTenant(tenantId: string) {
  await requireAdmin();
  const sql = getPool();

  // Get schema name first
  const rows = await sql.unsafe('SELECT schema_name FROM admin.tenants WHERE id = $1', [tenantId]);
  const schemaName = rows[0]?.schema_name as string;

  if (schemaName) {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }

  await sql.unsafe('DELETE FROM admin.tenants WHERE id = $1', [tenantId]);

  return { success: true };
}
