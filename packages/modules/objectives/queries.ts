import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';

const logger = createLogger('objectives');

const CreateObjectiveSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.number().min(1).max(10),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
});

import type {
  CreateObjectiveInput,
  CreateTaskInput,
  Cycle,
  CycleWithTasks,
  IssueState,
  Objective,
  ObjectiveTimeframe,
  ObjectiveWithTasks,
  Task,
  TaskStatus,
  UpdateObjectiveInput,
  UpdateTaskInput,
} from './types';

/**
 * Listar objetivos ativos agrupados por timeframe
 */
export async function listObjectivesByTimeframe(): Promise<
  Record<ObjectiveTimeframe, Objective[]>
> {
  const { data, error } = await db
    .from('objectives')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list objectives');
    throw new HawkError(`Failed to list objectives: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const result: Record<ObjectiveTimeframe, Objective[]> = {
    short: [],
    medium: [],
    long: [],
  };

  for (const obj of data ?? []) {
    result[obj.timeframe as ObjectiveTimeframe].push(obj as Objective);
  }

  return result;
}

/**
 * Obter objetivo por ID
 */
export async function getObjective(id: string): Promise<Objective> {
  const { data, error } = await db.from('objectives').select('*').eq('id', id).single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get objective');
    throw new HawkError(`Failed to get objective: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Objective;
}

/**
 * Obter objetivo com todas as suas tarefas
 */
export async function getObjectiveWithTasks(id: string): Promise<ObjectiveWithTasks> {
  const objective = await getObjective(id);

  const { data: tasks, error } = await db
    .from('tasks')
    .select('*')
    .eq('objective_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get tasks');
    throw new HawkError(`Failed to get tasks: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const taskList = (tasks ?? []) as Task[];
  const openTasks = taskList.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
  const doneTasks = taskList.filter((t) => t.status === 'done').length;

  return {
    ...objective,
    tasks: taskList,
    open_tasks: openTasks,
    done_tasks: doneTasks,
  };
}

/**
 * Criar objetivo
 */
export async function createObjective(input: CreateObjectiveInput): Promise<Objective> {
  const parsed = CreateObjectiveSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('objectives')
    .insert({
      title: input.title,
      description: input.description ?? null,
      timeframe: input.timeframe,
      module: input.module ?? null,
      target_date: input.target_date ?? null,
      priority: input.priority ?? 5,
      parent_id: input.parent_id ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create objective');
    throw new HawkError(`Failed to create objective: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Objective;
}

/**
 * Atualizar objetivo (progresso, status, etc)
 */
export async function updateObjective(id: string, input: UpdateObjectiveInput): Promise<Objective> {
  const { data, error } = await db
    .from('objectives')
    .update({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.progress !== undefined && { progress: input.progress }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.target_date !== undefined && { target_date: input.target_date }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.timeframe !== undefined && { timeframe: input.timeframe }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update objective');
    throw new HawkError(`Failed to update objective: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Objective;
}

/**
 * Excluir objetivo (e suas tarefas em cascata)
 */
export async function deleteObjective(id: string): Promise<void> {
  const { error } = await db.from('objectives').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete objective');
    throw new HawkError(`Failed to delete objective: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Excluir tarefa
 */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete task');
    throw new HawkError(`Failed to delete task: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Listar tarefas ativas (todo + in_progress + blocked)
 */
export async function listActiveTasks(limit = 20): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .in('status', ['todo', 'in_progress', 'blocked'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list tasks');
    throw new HawkError(`Failed to list tasks: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Task[];
}

/**
 * Listar tarefas com due_date hoje ou no passado (pendentes)
 */
export async function listOverdueTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0] as string;

  const { data, error } = await db
    .from('tasks')
    .select('*')
    .in('status', ['todo', 'in_progress'])
    .lte('due_date', today)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list overdue tasks');
    throw new HawkError(`Failed to list overdue tasks: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Task[];
}

/**
 * Criar tarefa
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const parsed = CreateTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  const { data, error } = await db
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      objective_id: input.objective_id ?? null,
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
      module: input.module ?? null,
      tags: input.tags ?? [],
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create task');
    throw new HawkError(`Failed to create task: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Task;
}

/**
 * Atualizar status de uma tarefa
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) updates.title = input.title;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'done') {
      updates.completed_at = new Date().toISOString();
    }
  }
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.due_date !== undefined) updates.due_date = input.due_date;
  if (input.description !== undefined) updates.description = input.description;
  if (input.tags !== undefined) updates.tags = input.tags;

  const { data, error } = await db.from('tasks').update(updates).eq('id', id).select().single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update task');
    throw new HawkError(`Failed to update task: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Task;
}

/**
 * Encontrar tarefa por título (busca parcial)
 */
export async function findTaskByTitle(title: string, activeOnly = true): Promise<Task | null> {
  let query = db.from('tasks').select('*').ilike('title', `%${title}%`).limit(1);

  if (activeOnly) {
    query = query.in('status', ['todo', 'in_progress', 'blocked'] as TaskStatus[]);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    logger.error({ error: error.message }, 'Failed to find task');
    throw new HawkError(`Failed to find task: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Task | null;
}

/**
 * Encontrar objetivo por título (busca parcial)
 */
export async function findObjectiveByTitle(title: string): Promise<Objective | null> {
  const { data, error } = await db
    .from('objectives')
    .select('*')
    .ilike('title', `%${title}%`)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to find objective');
    throw new HawkError(`Failed to find objective: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Objective | null;
}

/**
 * Tarefas concluídas recentemente
 */
export async function listRecentlyCompletedTasks(limit = 5): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .eq('status', 'done')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list completed tasks');
    throw new HawkError(`Failed to list completed tasks: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return (data ?? []) as Task[];
}

// ── M2M: Task ↔ Objectives ────────────────────────────────

/**
 * Linkar tarefa a múltiplos objetivos
 */
export async function linkTaskToObjectives(taskId: string, objectiveIds: string[]): Promise<void> {
  if (objectiveIds.length === 0) return;

  const rows = objectiveIds.map((oid) => ({ task_id: taskId, objective_id: oid }));
  const { error } = await db
    .from('task_objectives')
    .upsert(rows, { onConflict: 'task_id,objective_id' });

  if (error) {
    logger.error({ error: error.message }, 'Failed to link task to objectives');
    throw new HawkError(`Failed to link task to objectives: ${error.message}`, 'DB_QUERY_FAILED');
  }
}

/**
 * Desvincular tarefa de um objetivo
 */
export async function unlinkTaskFromObjective(taskId: string, objectiveId: string): Promise<void> {
  const { error } = await db
    .from('task_objectives')
    .delete()
    .eq('task_id', taskId)
    .eq('objective_id', objectiveId);

  if (error) {
    logger.error({ error: error.message }, 'Failed to unlink task from objective');
    throw new HawkError(
      `Failed to unlink task from objective: ${error.message}`,
      'DB_QUERY_FAILED',
    );
  }
}

/**
 * Obter todos os objetivos de uma tarefa (M2M)
 */
export async function getObjectivesForTask(taskId: string): Promise<Objective[]> {
  const { data, error } = await db
    .from('task_objectives')
    .select('objective_id')
    .eq('task_id', taskId);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get objectives for task');
    throw new HawkError(`Failed to get objectives for task: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const ids = (data ?? [])
    .map((r: any) => r.objective_id)
    .filter((id: any): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const { data: objectives, error: objErr } = await db.from('objectives').select('*').in('id', ids);

  if (objErr) {
    logger.error({ error: objErr.message }, 'Failed to get objectives');
    throw new HawkError(`Failed to get objectives: ${objErr.message}`, 'DB_QUERY_FAILED');
  }
  return (objectives ?? []) as Objective[];
}

/**
 * Buscar tarefas por título (para @mentions — retorna múltiplos)
 */
export async function searchTasks(query: string, limit = 5): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .ilike('title', `%${query}%`)
    .in('status', ['todo', 'in_progress', 'blocked'] as TaskStatus[])
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search tasks');
    throw new HawkError(`Failed to search tasks: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Task[];
}

/**
 * Buscar objetivos por título (para @mentions — retorna múltiplos)
 */
export async function searchObjectives(query: string, limit = 5): Promise<Objective[]> {
  const { data, error } = await db
    .from('objectives')
    .select('*')
    .ilike('title', `%${query}%`)
    .eq('status', 'active')
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search objectives');
    throw new HawkError(`Failed to search objectives: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Objective[];
}

// ============================================================
// ISSUE STATES (Plane pattern)
// ============================================================

/**
 * Listar estados disponíveis (globais + de um objetivo específico)
 */
export async function listIssueStates(objectiveId?: string): Promise<IssueState[]> {
  // biome-ignore lint/suspicious/noExplicitAny: issue_states not in generated types
  let query = (db as any)
    .from('issue_states')
    .select('id, objective_id, name, color, type, position')
    .order('position', { ascending: true });

  if (objectiveId) {
    query = query.or(`objective_id.eq.${objectiveId},objective_id.is.null`);
  } else {
    query = query.is('objective_id', null);
  }

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list issue states');
    throw new HawkError(`Failed to list issue states: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as IssueState[];
}

/**
 * Tarefas agrupadas por estado (Kanban board)
 */
export async function getTasksByState(
  objectiveId?: string,
): Promise<{ state: IssueState; tasks: Task[] }[]> {
  const states = await listIssueStates(objectiveId);

  let taskQuery = db.from('tasks').select('*').order('sort_order', { ascending: true });
  if (objectiveId) {
    taskQuery = taskQuery.eq('objective_id', objectiveId);
  }
  const { data: tasks, error } = await taskQuery;
  if (error) {
    logger.error({ error: error.message }, 'Failed to get tasks');
    throw new HawkError(`Failed to get tasks: ${error.message}`, 'DB_QUERY_FAILED');
  }

  const tasksByStateId = new Map<string | null, Task[]>();
  for (const task of tasks ?? []) {
    // biome-ignore lint/suspicious/noExplicitAny: state_id not in generated types
    const sid = (task as any).state_id ?? null;
    if (!tasksByStateId.has(sid)) tasksByStateId.set(sid, []);
    tasksByStateId.get(sid)?.push(task as Task);
  }

  return states.map((state) => ({
    state,
    tasks: tasksByStateId.get(state.id) ?? [],
  }));
}

/**
 * Criar sub-tarefa (parent_id)
 */
export async function createSubTask(parentId: string, input: CreateTaskInput): Promise<Task> {
  const { data, error } = await db
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      objective_id: input.objective_id ?? null,
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
      module: input.module ?? null,
      tags: input.tags ?? [],
      parent_id: parentId,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create sub-task');
    throw new HawkError(`Failed to create sub-task: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Task;
}

// ============================================================
// CYCLES (Plane pattern)
// ============================================================

/**
 * Ciclo ativo atual (status = 'current')
 */
export async function getActiveCycle(objectiveId?: string): Promise<Cycle | null> {
  // biome-ignore lint/suspicious/noExplicitAny: cycles not in generated types
  let query = (db as any)
    .from('cycles')
    .select('*')
    .eq('status', 'current')
    .order('start_date', { ascending: false })
    .limit(1);

  if (objectiveId) query = query.eq('objective_id', objectiveId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    logger.error({ error: error.message }, 'Failed to get active cycle');
    throw new HawkError(`Failed to get active cycle: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Cycle | null;
}

/**
 * Ciclo com tarefas + métricas de progresso
 */
export async function getCycleWithTasks(cycleId: string): Promise<CycleWithTasks> {
  // biome-ignore lint/suspicious/noExplicitAny: cycles not in generated types
  const { data: cycle, error: cErr } = await (db as any)
    .from('cycles')
    .select('*')
    .eq('id', cycleId)
    .single();
  if (cErr) {
    logger.error({ error: cErr.message }, 'Failed to get cycle');
    throw new HawkError(`Failed to get cycle: ${cErr.message}`, 'DB_QUERY_FAILED');
  }

  // biome-ignore lint/suspicious/noExplicitAny: cycle_tasks not in generated types
  const { data: cycleTasks, error: ctErr } = await (db as any)
    .from('cycle_tasks')
    .select('task_id')
    .eq('cycle_id', cycleId);
  if (ctErr) {
    logger.error({ error: ctErr.message }, 'Failed to get cycle tasks');
    throw new HawkError(`Failed to get cycle tasks: ${ctErr.message}`, 'DB_QUERY_FAILED');
  }

  // biome-ignore lint/suspicious/noExplicitAny: cycle_tasks not in generated types
  const taskIds = (cycleTasks ?? []).map((ct: any) => ct.task_id);
  let tasks: Task[] = [];

  if (taskIds.length > 0) {
    const { data: taskData, error: tErr } = await db.from('tasks').select('*').in('id', taskIds);
    if (tErr) {
      logger.error({ error: tErr.message }, 'Failed to get tasks');
      throw new HawkError(`Failed to get tasks: ${tErr.message}`, 'DB_QUERY_FAILED');
    }
    tasks = (taskData ?? []) as Task[];
  }

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  return {
    ...(cycle as unknown as Cycle),
    tasks,
    completed_count: completedCount,
    total_count: tasks.length,
    completion_pct: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
  };
}

/**
 * Calcular velocidade dos últimos N ciclos (tarefas concluídas por ciclo)
 */
export async function calculateVelocity(
  n = 3,
): Promise<{ cycle_name: string; velocity: number; start_date: string }[]> {
  // biome-ignore lint/suspicious/noExplicitAny: cycles not in generated types
  const { data: cycles, error } = await (db as any)
    .from('cycles')
    .select('id, name, start_date, velocity_actual')
    .eq('status', 'completed')
    .order('start_date', { ascending: false })
    .limit(n);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get cycles');
    throw new HawkError(`Failed to get cycles: ${error.message}`, 'DB_QUERY_FAILED');
  }
  if (!cycles?.length) return [];

  const results = await Promise.all(
    // biome-ignore lint/suspicious/noExplicitAny: cycles not in generated types
    cycles.map(async (cycle: any) => {
      if (cycle.velocity_actual != null) {
        return {
          cycle_name: cycle.name,
          velocity: cycle.velocity_actual,
          start_date: cycle.start_date,
        };
      }
      // biome-ignore lint/suspicious/noExplicitAny: cycle_tasks not in generated types
      const { data: ct } = await (db as any)
        .from('cycle_tasks')
        .select('task_id')
        .eq('cycle_id', cycle.id);

      // biome-ignore lint/suspicious/noExplicitAny: cycle_tasks not in generated types
      const taskIds = (ct ?? []).map((r: any) => r.task_id);
      if (taskIds.length === 0)
        return { cycle_name: cycle.name, velocity: 0, start_date: cycle.start_date };

      const { data: done } = await db
        .from('tasks')
        .select('id')
        .in('id', taskIds)
        .eq('status', 'done');

      return { cycle_name: cycle.name, velocity: done?.length ?? 0, start_date: cycle.start_date };
    }),
  );

  return results;
}
