'use server';

import { getSafeSchemaFromCookie } from '@/lib/auth/safe-schema';
import { getPool } from '@hawk/db';

export interface LLMChainEntry {
  id?: string;
  priority: number;
  providerId: string;
  modelId: string;
  tier: 'simple' | 'moderate' | 'complex' | 'all';
  enabled: boolean;
}

/** Fetch the tenant's LLM chain config. Returns empty array if none configured. */
export async function fetchLLMChain(): Promise<LLMChainEntry[]> {
  const result = await getSafeSchemaFromCookie();
  if (!result) return [];
  const { slug } = result;

  const sql = getPool();

  try {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      const tenants = await tx.unsafe('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [slug]);
      const tenant = tenants[0] as { id: string } | undefined;
      if (!tenant) return [];

      return tx.unsafe(
        `SELECT id, priority, provider_id, model_id, tier, enabled
         FROM tenant_llm_chain
         WHERE tenant_id = $1
         ORDER BY priority ASC`,
        [tenant.id],
      );
    });

    return (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      priority: r.priority as number,
      providerId: r.provider_id as string,
      modelId: r.model_id as string,
      tier: r.tier as LLMChainEntry['tier'],
      enabled: r.enabled as boolean,
    }));
  } catch {
    return [];
  }
}

/** Save the full LLM chain for the current tenant (replace all entries). */
export async function saveLLMChain(entries: Omit<LLMChainEntry, 'id'>[]): Promise<boolean> {
  const result = await getSafeSchemaFromCookie();
  if (!result) return false;
  const { slug } = result;

  const sql = getPool();

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe('SET LOCAL search_path TO admin, public');
      const tenants = await tx.unsafe('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [slug]);
      const tenant = tenants[0] as { id: string } | undefined;
      if (!tenant) throw new Error('Tenant not found');

      // Delete existing chain
      await tx.unsafe('DELETE FROM tenant_llm_chain WHERE tenant_id = $1', [tenant.id]);

      // Insert new entries
      for (const entry of entries) {
        await tx.unsafe(
          `INSERT INTO tenant_llm_chain (tenant_id, priority, provider_id, model_id, tier, enabled)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenant.id, entry.priority, entry.providerId, entry.modelId, entry.tier, entry.enabled],
        );
      }
    });

    // Notify agent to reload credentials
    try {
      const agentUrl = process.env.DOCKER
        ? 'http://agent:3001'
        : `http://localhost:${process.env.AGENT_PORT ?? 3001}`;
      await fetch(`${agentUrl}/admin/tenants/${slug}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AGENT_API_SECRET ?? ''}`,
        },
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    } catch {
      // Non-fatal: agent will pick up changes on next restart
    }

    return true;
  } catch {
    return false;
  }
}
