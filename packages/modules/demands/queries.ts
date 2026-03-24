import { db } from '@hawk/db';
import type {
  CreateArtifactInput,
  CreateDemandInput,
  CreateLogInput,
  CreateStepInput,
  Demand,
  DemandArtifact,
  DemandFull,
  DemandLog,
  DemandStatus,
  DemandStep,
  DemandWithSteps,
  UpdateDemandInput,
  UpdateStepInput,
} from './types';

// ============================================================
// DEMANDS
// ============================================================

export async function createDemand(input: CreateDemandInput): Promise<Demand> {
  const { data, error } = await db
    .from('demands')
    .insert({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      module: input.module ?? null,
      objective_id: input.objective_id ?? null,
      origin: input.origin ?? 'chat',
      origin_session_id: input.origin_session_id ?? null,
      origin_message: input.origin_message ?? null,
      deadline: input.deadline ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create demand: ${error.message}`);
  return data as Demand;
}

export async function updateDemand(id: string, input: UpdateDemandInput): Promise<Demand> {
  const { data, error } = await db
    .from('demands')
    // biome-ignore lint/suspicious/noExplicitAny: triage_result type mismatch between Json and TriageResult
    .update(input as any)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update demand: ${error.message}`);
  return data as Demand;
}

export async function getDemand(id: string): Promise<Demand> {
  const { data, error } = await db.from('demands').select('*').eq('id', id).single();

  if (error) throw new Error(`Failed to get demand: ${error.message}`);
  return data as Demand;
}

export async function deleteDemand(id: string): Promise<void> {
  const { error } = await db.from('demands').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete demand: ${error.message}`);
}

export async function listDemands(filters?: {
  status?: DemandStatus | DemandStatus[];
  module?: string;
  limit?: number;
  offset?: number;
}): Promise<Demand[]> {
  let query = db.from('demands').select('*');

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.module) {
    query = query.eq('module', filters.module);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50)
    .range(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list demands: ${error.message}`);
  return (data ?? []) as Demand[];
}

export async function getActiveDemands(): Promise<Demand[]> {
  return listDemands({ status: ['running', 'triaging', 'planned'] });
}

export async function getDemandWithSteps(id: string): Promise<DemandWithSteps> {
  const [demand, steps] = await Promise.all([getDemand(id), listSteps(id)]);
  return { ...demand, steps };
}

export async function getDemandFull(id: string): Promise<DemandFull> {
  const [demand, steps, logs, artifacts] = await Promise.all([
    getDemand(id),
    listSteps(id),
    listLogs(id, 100),
    listArtifacts(id),
  ]);
  return { ...demand, steps, logs, artifacts };
}

// ============================================================
// DEMAND STEPS
// ============================================================

export async function createStep(demandId: string, input: CreateStepInput): Promise<DemandStep> {
  const { data, error } = await db
    .from('demand_steps')
    .insert({
      demand_id: demandId,
      title: input.title,
      description: input.description ?? null,
      step_order: input.step_order,
      execution_type: input.execution_type ?? 'sequential',
      // biome-ignore lint/suspicious/noExplicitAny: condition_rule Json type mismatch
      condition_rule: (input.condition_rule ?? null) as any,
      assigned_agent_id: input.assigned_agent_id ?? null,
      depends_on: input.depends_on ?? [],
      tool_name: input.tool_name ?? null,
      // biome-ignore lint/suspicious/noExplicitAny: tool_args Json type mismatch
      tool_args: (input.tool_args ?? {}) as any,
      estimated_duration_minutes: input.estimated_duration_minutes ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create step: ${error.message}`);
  return data as DemandStep;
}

export async function updateStep(id: string, input: UpdateStepInput): Promise<DemandStep> {
  const { data, error } = await db
    .from('demand_steps')
    // biome-ignore lint/suspicious/noExplicitAny: result_metadata Json type mismatch
    .update(input as any)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update step: ${error.message}`);
  return data as DemandStep;
}

export async function listSteps(demandId: string): Promise<DemandStep[]> {
  const { data, error } = await db
    .from('demand_steps')
    .select('*')
    .eq('demand_id', demandId)
    .order('step_order', { ascending: true });

  if (error) throw new Error(`Failed to list steps: ${error.message}`);
  return (data ?? []) as DemandStep[];
}

export async function getReadySteps(demandId: string): Promise<DemandStep[]> {
  const { data, error } = await db
    .from('demand_steps')
    .select('*')
    .eq('demand_id', demandId)
    .eq('status', 'ready')
    .order('step_order', { ascending: true });

  if (error) throw new Error(`Failed to get ready steps: ${error.message}`);
  return (data ?? []) as DemandStep[];
}

export async function getStepsByStatus(
  demandId: string,
  status: string | string[],
): Promise<DemandStep[]> {
  let query = db.from('demand_steps').select('*').eq('demand_id', demandId);

  if (Array.isArray(status)) {
    query = query.in('status', status);
  } else {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('step_order', { ascending: true });
  if (error) throw new Error(`Failed to get steps by status: ${error.message}`);
  return (data ?? []) as DemandStep[];
}

// ============================================================
// DEMAND LOGS
// ============================================================

export async function createLog(
  demandId: string,
  stepId: string | null,
  input: CreateLogInput,
): Promise<DemandLog> {
  const { data, error } = await db
    .from('demand_logs')
    .insert({
      demand_id: demandId,
      step_id: stepId,
      log_type: input.log_type,
      agent_id: input.agent_id ?? null,
      message: input.message,
      // biome-ignore lint/suspicious/noExplicitAny: metadata Json type mismatch
      metadata: (input.metadata ?? {}) as any,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create log: ${error.message}`);
  return data as DemandLog;
}

export async function listLogs(demandId: string, limit = 50): Promise<DemandLog[]> {
  const { data, error } = await db
    .from('demand_logs')
    .select('*')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list logs: ${error.message}`);
  return (data ?? []) as DemandLog[];
}

// ============================================================
// DEMAND ARTIFACTS
// ============================================================

export async function createArtifact(
  demandId: string,
  stepId: string | null,
  input: CreateArtifactInput,
): Promise<DemandArtifact> {
  const { data, error } = await db
    .from('demand_artifacts')
    .insert({
      demand_id: demandId,
      step_id: stepId,
      artifact_type: input.artifact_type,
      title: input.title,
      content: input.content ?? null,
      reference_id: input.reference_id ?? null,
      reference_table: input.reference_table ?? null,
      file_url: input.file_url ?? null,
      // biome-ignore lint/suspicious/noExplicitAny: metadata Json type mismatch
      metadata: (input.metadata ?? {}) as any,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create artifact: ${error.message}`);
  return data as DemandArtifact;
}

export async function listArtifacts(demandId: string): Promise<DemandArtifact[]> {
  const { data, error } = await db
    .from('demand_artifacts')
    .select('*')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to list artifacts: ${error.message}`);
  return (data ?? []) as DemandArtifact[];
}

// ============================================================
// PROGRESS CALCULATION
// ============================================================

export async function updateDemandProgress(demandId: string): Promise<Demand> {
  const steps = await listSteps(demandId);
  const total = steps.length;
  const completed = steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return updateDemand(demandId, {
    progress,
    total_steps: total,
    completed_steps: completed,
  });
}

// ============================================================
// DEPENDENCY RESOLUTION
// ============================================================

export async function resolveDependencies(demandId: string): Promise<number> {
  const steps = await listSteps(demandId);
  const completedIds = new Set(
    steps.filter((s) => s.status === 'completed' || s.status === 'skipped').map((s) => s.id),
  );

  let readied = 0;

  for (const step of steps) {
    if (step.status !== 'pending') continue;

    // Check all dependencies are satisfied
    const depsResolved = step.depends_on.every((depId) => completedIds.has(depId));
    if (!depsResolved) continue;

    // Handle conditional steps
    if (step.execution_type === 'conditional' && step.condition_rule) {
      const rule = step.condition_rule;
      const targetStep = steps.find((s) => s.id === rule.if_step);
      const conditionMet = targetStep?.status === rule.status;

      if ((rule.then === 'run' && !conditionMet) || (rule.then === 'skip' && conditionMet)) {
        await updateStep(step.id, { status: 'skipped' });
        continue;
      }
    }

    await updateStep(step.id, { status: 'ready' });
    readied++;
  }

  return readied;
}
