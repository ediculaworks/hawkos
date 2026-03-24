import { db as typedDb } from '@hawk/db';

// biome-ignore lint/suspicious/noExplicitAny: pending type generation
const db = typedDb as any;

export async function getTasks(limit = 50) {
  const { data } = await db
    .from('clickup_tasks')
    .select(
      'id, clickup_id, name, description, status, priority, list_name, space_name, url, due_date, assignees, synced_at',
    )
    .order('updated_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getTasksByStatus(status: string, limit = 50) {
  const { data } = await db
    .from('clickup_tasks')
    .select(
      'id, clickup_id, name, description, status, priority, list_name, space_name, url, due_date, assignees',
    )
    .eq('status', status)
    .order('priority', { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function getTaskCount() {
  const { count } = await db.from('clickup_tasks').select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function getSpaces(): Promise<string[]> {
  const { data } = await db
    .from('clickup_tasks')
    .select('space_name')
    .not('space_name', 'is', null);
  const unique = new Set((data ?? []).map((r: { space_name: string }) => r.space_name));
  return Array.from(unique) as string[];
}
