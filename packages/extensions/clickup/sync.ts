import { db as typedDb } from '@hawk/db';
import type { ExtensionConnection, SyncResult } from '../core/types';

// Cast to any — extension tables aren't in generated types until migration + db:types
// biome-ignore lint/suspicious/noExplicitAny: pending type generation
const db = typedDb as any;

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string };
  priority: { id: string } | null;
  list: { name: string };
  space: { name?: string };
  url: string;
  due_date: string | null;
  assignees: Array<{ username: string }>;
}

interface ClickUpTeam {
  id: string;
  name: string;
}

interface ClickUpSpace {
  id: string;
  name: string;
}

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpFolder {
  id: string;
  name: string;
  lists: ClickUpList[];
}

function getToken(connection: ExtensionConnection): string {
  return connection.access_token ?? connection.api_key ?? '';
}

async function cuFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClickUp API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function syncClickUp(connection: ExtensionConnection): Promise<SyncResult> {
  const token = getToken(connection);
  if (!token) return { synced: 0, errors: ['No access token or API key'] };

  const errors: string[] = [];
  let synced = 0;

  try {
    // Get teams (workspaces)
    const { teams } = await cuFetch<{ teams: ClickUpTeam[] }>('/team', token);

    for (const team of teams) {
      // Get spaces
      const { spaces } = await cuFetch<{ spaces: ClickUpSpace[] }>(
        `/team/${team.id}/space?archived=false`,
        token,
      );

      for (const space of spaces) {
        // Get folders and their lists
        const { folders } = await cuFetch<{ folders: ClickUpFolder[] }>(
          `/space/${space.id}/folder?archived=false`,
          token,
        );

        const listIds: string[] = [];
        for (const folder of folders) {
          for (const list of folder.lists) {
            listIds.push(list.id);
          }
        }

        // Get folderless lists
        const { lists } = await cuFetch<{ lists: ClickUpList[] }>(
          `/space/${space.id}/list?archived=false`,
          token,
        );
        for (const list of lists) {
          listIds.push(list.id);
        }

        // Sync tasks from each list
        for (const listId of listIds) {
          try {
            const { tasks } = await cuFetch<{ tasks: ClickUpTask[] }>(
              `/list/${listId}/task?archived=false&subtasks=true&include_closed=true`,
              token,
            );

            for (const task of tasks) {
              await db.from('clickup_tasks').upsert(
                {
                  clickup_id: task.id,
                  name: task.name,
                  description: task.description ?? null,
                  status: task.status.status,
                  priority: task.priority ? Number.parseInt(task.priority.id, 10) : null,
                  list_name: task.list.name,
                  space_name: space.name,
                  url: task.url,
                  due_date: task.due_date ? new Date(Number(task.due_date)).toISOString() : null,
                  assignees: task.assignees.map((a) => a.username),
                  synced_at: new Date().toISOString(),
                },
                { onConflict: 'clickup_id' },
              );
              synced++;
            }
          } catch {
            // skip individual list failures
          }
        }
      }
    }
  } catch (e) {
    errors.push(`ClickUp sync failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { synced, errors };
}
