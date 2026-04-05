'use server';

import { createAdminClientFromEnv } from '@hawk/admin';
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

  try {
    const admin = createAdminClientFromEnv();
    const result = await admin.createTenant({
      label: data.label,
      discordConfig: data.discordConfig,
      openrouterConfig: data.openrouterConfig,
    });
    if (!result.success || !result.tenant) {
      return { ok: false, error: result.error ?? 'Erro ao criar tenant' };
    }
    revalidatePath('/dashboard/admin');
    return { ok: true, slug: result.tenant.slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao criar tenant' };
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
