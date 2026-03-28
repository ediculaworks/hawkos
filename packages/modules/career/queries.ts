import { db } from '@hawk/db';
import { HawkError, createLogger } from '@hawk/shared';
const logger = createLogger('career');
import type {
  CreateProjectInput,
  CreateWorkspaceInput,
  LogWorkInput,
  Project,
  WorkLog,
  WorkSummary,
  Workspace,
} from './types';

/**
 * Listar workspaces ativos
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await db
    .from('workspaces')
    .select('id, name, type, active, hourly_rate, monthly_income, metadata')
    .eq('active', true)
    .order('name');

  if (error) {
    logger.error({ error: error.message }, 'Failed to list workspaces');
    throw new HawkError(`Failed to list workspaces: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Workspace[];
}

/**
 * Buscar workspace por nome (parcial)
 */
export async function findWorkspaceByName(name: string): Promise<Workspace | null> {
  const { data, error } = await db
    .from('workspaces')
    .select('id, name, type, active, hourly_rate, monthly_income, metadata')
    .ilike('name', `%${name}%`)
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to find workspace');
    throw new HawkError(`Failed to find workspace: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Workspace | null;
}

/**
 * Listar projetos ativos
 */
export async function listActiveProjects(): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select(
      'id, name, description, status, priority, workspace_id, github_repo, start_date, end_date, metadata',
    )
    .eq('status', 'active')
    .order('priority', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to list projects');
    throw new HawkError(`Failed to list projects: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Project[];
}

/**
 * Buscar projeto por nome (parcial)
 */
export async function findProjectByName(name: string): Promise<Project | null> {
  const { data, error } = await db
    .from('projects')
    .select(
      'id, name, description, status, priority, workspace_id, github_repo, start_date, end_date, metadata',
    )
    .ilike('name', `%${name}%`)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to find project');
    throw new HawkError(`Failed to find project: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Project | null;
}

/**
 * Registrar horas trabalhadas
 */
export async function logWork(input: LogWorkInput): Promise<WorkLog> {
  const workspace = await findWorkspaceByName(input.workspace_name);
  if (!workspace) {
    logger.error({ error: `Workspace "${input.workspace_name}" not found` }, 'Failed to log work');
    throw new HawkError(`Workspace "${input.workspace_name}" not found`, 'DB_QUERY_FAILED');
  }

  let projectId: string | null = null;
  if (input.project_name) {
    const project = await findProjectByName(input.project_name);
    projectId = project?.id ?? null;
  }

  const { data, error } = await db
    .from('work_logs')
    .insert({
      workspace_id: workspace.id,
      project_id: projectId,
      date: input.date ?? (new Date().toISOString().split('T')[0] as string),
      duration_minutes: input.duration_minutes,
      description: input.description ?? null,
      billable: input.billable ?? false,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to log work');
    throw new HawkError(`Failed to log work: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkLog;
}

/**
 * Resumo de horas por workspace (semana + mês)
 */
export async function getWorkSummary(): Promise<WorkSummary[]> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);

  const weekStr = weekAgo.toISOString().split('T')[0] as string;
  const monthStr = monthAgo.toISOString().split('T')[0] as string;

  const workspaces = await listWorkspaces();

  const { data: logs, error } = await db
    .from('work_logs')
    .select(
      'id, workspace_id, project_id, date, duration_minutes, description, billable, created_at, metadata',
    )
    .gte('date', monthStr)
    .order('date', { ascending: false });

  if (error) {
    logger.error({ error: error.message }, 'Failed to get work logs');
    throw new HawkError(`Failed to get work logs: ${error.message}`, 'DB_QUERY_FAILED');
  }
  const allLogs = (logs ?? []) as WorkLog[];

  return workspaces.map((ws) => {
    const wsLogs = allLogs.filter((l) => l.workspace_id === ws.id);
    const weekLogs = wsLogs.filter((l) => l.date >= weekStr);
    const weekMin = weekLogs.reduce((s, l) => s + l.duration_minutes, 0);
    const monthMin = wsLogs.reduce((s, l) => s + l.duration_minutes, 0);

    return {
      workspace: ws,
      total_minutes_week: weekMin,
      total_minutes_month: monthMin,
      total_hours_week: Math.round((weekMin / 60) * 10) / 10,
      total_hours_month: Math.round((monthMin / 60) * 10) / 10,
      logs: wsLogs.slice(0, 5),
    };
  });
}

/**
 * Logs recentes (últimos 10)
 */
export async function listRecentWorkLogs(limit = 10): Promise<WorkLog[]> {
  const { data, error } = await db
    .from('work_logs')
    .select(
      'id, workspace_id, project_id, date, duration_minutes, description, billable, created_at, metadata',
    )
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list work logs');
    throw new HawkError(`Failed to list work logs: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as WorkLog[];
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const { data, error } = await db
    .from('workspaces')
    .insert({
      name: input.name,
      type: input.type,
      hourly_rate: input.hourly_rate ?? null,
      monthly_income: input.monthly_income ?? null,
      metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create workspace');
    throw new HawkError(`Failed to create workspace: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Workspace;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .insert({
      name: input.name,
      workspace_id: input.workspace_id ?? null,
      description: input.description ?? null,
      priority: input.priority ?? 5,
      github_repo: input.github_repo ?? null,
      start_date: input.start_date ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create project');
    throw new HawkError(`Failed to create project: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Project;
}

export async function logWorkDirect(input: {
  workspace_id: string;
  project_id?: string;
  duration_minutes: number;
  description?: string;
  date?: string;
  billable?: boolean;
}): Promise<WorkLog> {
  const { data, error } = await db
    .from('work_logs')
    .insert({
      workspace_id: input.workspace_id,
      project_id: input.project_id ?? null,
      duration_minutes: input.duration_minutes,
      description: input.description ?? null,
      date: input.date ?? new Date().toISOString().split('T')[0],
      billable: input.billable ?? false,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to log work');
    throw new HawkError(`Failed to log work: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as WorkLog;
}
