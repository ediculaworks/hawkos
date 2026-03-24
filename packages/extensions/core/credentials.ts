import { db as typedDb } from '@hawk/db';
import type { ConnectionStatus, ExtensionConnection, ExtensionId } from './types';

// biome-ignore lint/suspicious/noExplicitAny: pending type generation
const db = typedDb as any;

const TABLE = 'extension_connections';

export async function getConnection(extensionId: ExtensionId): Promise<ExtensionConnection | null> {
  const { data } = await db.from(TABLE).select('*').eq('extension_id', extensionId).maybeSingle();
  return data as ExtensionConnection | null;
}

export async function getAllConnections(): Promise<ExtensionConnection[]> {
  const { data } = await db.from(TABLE).select('*').order('created_at', { ascending: true });
  return (data ?? []) as ExtensionConnection[];
}

export async function upsertConnection(
  extensionId: ExtensionId,
  fields: Partial<Omit<ExtensionConnection, 'id' | 'extension_id' | 'created_at' | 'updated_at'>>,
): Promise<ExtensionConnection> {
  const { data, error } = await db
    .from(TABLE)
    .upsert({ extension_id: extensionId, ...fields }, { onConflict: 'extension_id' })
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert connection: ${error.message}`);
  return data as ExtensionConnection;
}

export async function updateConnectionStatus(
  extensionId: ExtensionId,
  status: ConnectionStatus,
  extra?: Partial<ExtensionConnection>,
): Promise<void> {
  await db
    .from(TABLE)
    .update({ status, ...extra })
    .eq('extension_id', extensionId);
}

export async function deleteConnection(extensionId: ExtensionId): Promise<void> {
  await db.from(TABLE).delete().eq('extension_id', extensionId);
}

export async function getConnectedExtensionIds(): Promise<ExtensionId[]> {
  const { data } = await db.from(TABLE).select('extension_id').eq('status', 'connected');
  return (data ?? []).map((r: { extension_id: ExtensionId }) => r.extension_id);
}
