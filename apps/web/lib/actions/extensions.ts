'use server';

import {
  type ExtensionView,
  deleteConnection,
  extensionRegistry,
  getAllConnections,
  getConnection,
  upsertConnection,
} from '@hawk/extensions/core';

// Ensure extensions are registered
import '@hawk/extensions/setup';
import { withTenant } from '../supabase/with-tenant';

export async function fetchExtensions(): Promise<ExtensionView[]> {
  return withTenant(async () => {
    const definitions = extensionRegistry.getAll();
    const connections = await getAllConnections();
    const connMap = new Map(connections.map((c) => [c.extension_id, c]));

    return definitions.map((def) => {
      const conn = connMap.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        authMethod: def.authMethod,
        status: conn?.status ?? 'disconnected',
        lastSyncAt: conn?.last_sync_at ?? null,
        lastError: conn?.last_error ?? null,
        syncEnabled: conn?.sync_enabled ?? true,
        connected: conn?.status === 'connected',
      };
    });
  });
}

export async function disconnectExtension(extensionId: string): Promise<void> {
  return withTenant(async () => {
    await deleteConnection(extensionId as Parameters<typeof deleteConnection>[0]);
  });
}

export async function connectWithApiKey(
  extensionId: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  return withTenant(async () => {
    const ext = extensionRegistry.get(extensionId as Parameters<typeof extensionRegistry.get>[0]);
    if (!ext) return { ok: false, error: 'Unknown extension' };

    if (ext.validateApiKey) {
      const valid = await ext.validateApiKey(apiKey);
      if (!valid) return { ok: false, error: 'Invalid API key' };
    }

    await upsertConnection(ext.id, {
      status: 'connected',
      api_key: apiKey,
    });

    return { ok: true };
  });
}

export async function triggerSync(
  extensionId: string,
): Promise<{ synced: number; errors: string[] }> {
  return withTenant(async () => {
    const ext = extensionRegistry.get(extensionId as Parameters<typeof extensionRegistry.get>[0]);
    if (!ext?.sync) return { synced: 0, errors: ['Extension does not support sync'] };

    const conn = await getConnection(ext.id);
    if (!conn || conn.status !== 'connected') {
      return { synced: 0, errors: ['Extension is not connected'] };
    }

    const result = await ext.sync(conn);

    // Update last_sync_at
    await upsertConnection(ext.id, {
      last_sync_at: new Date().toISOString(),
      last_error: result.errors.length > 0 ? result.errors.join('; ') : null,
    });

    return result;
  });
}

export async function toggleSync(extensionId: string, enabled: boolean): Promise<void> {
  return withTenant(async () => {
    await upsertConnection(extensionId as Parameters<typeof upsertConnection>[0], {
      sync_enabled: enabled,
    });
  });
}
