'use server';

import {
  createObjective,
  createTask,
  deleteObjective,
  deleteTask,
  getActiveCycle,
  getCycleWithTasks,
  getObjectiveWithTasks,
  getTasksByState,
  listActiveTasks,
  listObjectivesByTimeframe,
  listOverdueTasks,
  listRecentlyCompletedTasks,
  updateObjective,
  updateTask,
} from '@hawk/module-objectives/queries';
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
  TaskPriority,
  TaskStatus,
  UpdateObjectiveInput,
  UpdateTaskInput,
} from '@hawk/module-objectives/types';
import { withTenant } from '../supabase/with-tenant';

export async function fetchGoals(): Promise<Record<ObjectiveTimeframe, Objective[]>> {
  return withTenant(async () => listObjectivesByTimeframe());
}

export async function fetchActiveTasks(limit = 50): Promise<Task[]> {
  return withTenant(async () => listActiveTasks(limit));
}

export async function fetchOverdueTasks(): Promise<Task[]> {
  return withTenant(async () => listOverdueTasks());
}

export async function fetchObjectiveWithTasks(id: string): Promise<ObjectiveWithTasks> {
  return withTenant(async () => getObjectiveWithTasks(id));
}

export async function fetchRecentlyCompleted(limit = 5): Promise<Task[]> {
  return withTenant(async () => listRecentlyCompletedTasks(limit));
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  return withTenant(async () => updateTask(taskId, { status }));
}

export async function setTaskPriority(taskId: string, priority: TaskPriority): Promise<Task> {
  return withTenant(async () => updateTask(taskId, { priority }));
}

export async function addObjective(input: CreateObjectiveInput): Promise<Objective> {
  return withTenant(async () => createObjective(input));
}

export async function addTask(input: CreateTaskInput): Promise<Task> {
  return withTenant(async () => createTask(input));
}

export async function setObjectiveProgress(id: string, progress: number): Promise<Objective> {
  return withTenant(async () => updateObjective(id, { progress }));
}

export async function fetchTasksByState(
  objectiveId?: string,
): Promise<{ state: IssueState; tasks: Task[] }[]> {
  return withTenant(async () => getTasksByState(objectiveId));
}

export async function fetchActiveCycle(objectiveId?: string): Promise<Cycle | null> {
  return withTenant(async () => getActiveCycle(objectiveId));
}

export async function fetchCycleWithTasks(cycleId: string): Promise<CycleWithTasks> {
  return withTenant(async () => getCycleWithTasks(cycleId));
}

export async function editTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  return withTenant(async () => updateTask(taskId, input));
}

export async function editObjective(id: string, input: UpdateObjectiveInput): Promise<Objective> {
  return withTenant(async () => updateObjective(id, input));
}

export async function removeTask(taskId: string): Promise<void> {
  return withTenant(async () => deleteTask(taskId));
}

export async function removeObjective(id: string): Promise<void> {
  return withTenant(async () => deleteObjective(id));
}

export async function updateTaskStateAction(taskId: string, stateId: string): Promise<Task> {
  return withTenant(async () => {
    const { db } = await import('@hawk/db');
    const { data, error } = await db
      .from('tasks')
      // biome-ignore lint/suspicious/noExplicitAny: state_id added via migration, types not regenerated
      .update({ state_id: stateId } as any)
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update task state: ${error.message}`);
    return data as Task;
  });
}
