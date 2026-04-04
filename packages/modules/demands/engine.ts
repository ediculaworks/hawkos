// Engine: executa steps de demands de forma assíncrona
import { db, getPool } from '@hawk/db';
import OpenAI from 'openai';
import {
  createLog,
  getActiveDemands,
  getReadySteps,
  listSteps,
  resolveDependencies,
  updateDemand,
  updateDemandProgress,
  updateStep,
} from './queries';
import type { Demand, DemandStep } from './types';

// Optional notifier for WebSocket broadcast
let notifier: ((type: string, data: Record<string, unknown>) => void) | null = null;

export function setDemandNotifier(fn: (type: string, data: Record<string, unknown>) => void): void {
  notifier = fn;
}

function notify(type: string, data: Record<string, unknown>): void {
  notifier?.(type, data);
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || 'not-set',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/hawk-os',
        'X-Title': 'Hawk OS',
      },
    });
  }
  return _client;
}

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/auto';

async function loadAgentInfo(
  agentId: string,
): Promise<{ model: string; identity: string; maxTokens: number; temperature: number } | null> {
  const { data } = await db
    .from('agent_templates')
    .select('llm_model, identity, max_tokens, temperature, name')
    .eq('id', agentId)
    .single();

  if (!data) return null;
  return {
    model: data.llm_model ?? DEFAULT_MODEL,
    identity: data.identity ?? '',
    maxTokens: data.max_tokens ?? 4096,
    temperature: Number(data.temperature ?? 0.3),
  };
}

/**
 * Get results from previous steps that this step depends on
 */
async function getPreviousResults(demandId: string, dependsOn: string[]): Promise<string> {
  if (dependsOn.length === 0) return '';

  const steps = await listSteps(demandId);
  const depSteps = steps.filter((s) => dependsOn.includes(s.id) && s.result);

  if (depSteps.length === 0) return '';

  return depSteps.map((s) => `### Resultado de "${s.title}":\n${s.result}`).join('\n\n');
}

/**
 * Build the prompt for a step execution
 */
function buildStepPrompt(demand: Demand, step: DemandStep, previousResults: string): string {
  let prompt = `Você está executando uma etapa de uma demanda de longa duração.

DEMANDA: ${demand.title}
${demand.description ? `CONTEXTO: ${demand.description}` : ''}

ETAPA ATUAL: ${step.title}
${step.description ? `INSTRUÇÃO: ${step.description}` : ''}
`;

  if (previousResults) {
    prompt += `\nRESULTADOS DE ETAPAS ANTERIORES:\n${previousResults}\n`;
  }

  if (step.tool_name) {
    prompt += `\nTOOL SUGERIDO: ${step.tool_name}`;
    if (Object.keys(step.tool_args).length > 0) {
      prompt += `\nARGUMENTOS: ${JSON.stringify(step.tool_args)}`;
    }
  }

  prompt +=
    '\n\nExecute esta etapa e retorne um resultado claro e conciso. Se precisar de mais informações, indique o que falta.';

  return prompt;
}

// ── Atomic Task Checkout (Paperclip pattern) ─────────────────────────

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

/**
 * Atomically checkout a step — prevents double execution.
 * Uses PostgreSQL UPDATE ... WHERE to guarantee exclusivity.
 * Returns the step if claimed, null if already claimed by another worker.
 */
async function checkoutStep(stepId: string): Promise<DemandStep | null> {
  try {
    const sql = getPool();
    const rows = await sql.unsafe(
      `UPDATE demand_steps
       SET status = 'running',
           claimed_at = NOW(),
           claimed_by = $2,
           started_at = COALESCE(started_at, NOW())
       WHERE id = $1
         AND status = 'ready'
         AND claimed_at IS NULL
       RETURNING *`,
      [stepId, WORKER_ID],
    );
    return (rows[0] as unknown as DemandStep) ?? null;
  } catch (err) {
    console.warn(`[demand-engine] checkoutStep failed for ${stepId}:`, err);
    return null;
  }
}

/**
 * Release a step claim (on completion or failure).
 */
async function releaseStep(
  stepId: string,
  status: 'completed' | 'failed' | 'ready',
  result?: string,
  error?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    claimed_at: null,
    claimed_by: null,
  };
  if (result !== undefined) updates.result = result;
  if (error !== undefined) updates.error_message = error;
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  await updateStep(stepId, updates);
}

/**
 * Recover stale claims — steps that were claimed but not completed within timeout.
 * Called at the start of each queue processing cycle.
 */
async function recoverStaleClaims(): Promise<number> {
  try {
    const sql = getPool();
    const rows = await sql.unsafe('SELECT recover_stale_demand_steps() AS recovered');
    return Number((rows[0] as unknown as { recovered: number })?.recovered ?? 0);
  } catch (err) {
    // RPC may not exist if migration hasn't been applied yet
    console.warn(
      '[demand-engine] recover_stale_demand_steps RPC failed (migration may be pending):',
      err,
    );
    return 0;
  }
}

/**
 * Execute a single step (with atomic checkout)
 */
async function executeStep(demand: Demand, step: DemandStep): Promise<void> {
  // Atomic checkout — if another worker already claimed this step, skip it
  const claimed = await checkoutStep(step.id);
  if (!claimed) return; // Already claimed by another worker

  await createLog(demand.id, step.id, {
    log_type: 'status_change',
    agent_id: step.assigned_agent_id ?? undefined,
    message: `Step "${step.title}" iniciado`,
  });

  // Handle checkpoint steps
  if (step.execution_type === 'checkpoint') {
    await updateStep(step.id, { status: 'waiting_human' });
    await createLog(demand.id, step.id, {
      log_type: 'checkpoint',
      message: `Aprovação necessária para "${step.title}"`,
    });
    notify('demand_checkpoint', { demandId: demand.id, stepId: step.id, stepTitle: step.title });
    return;
  }

  try {
    // Load agent identity
    const agentId = step.assigned_agent_id ?? '00000000-0000-0000-0000-000000000001';
    const agentInfo = await loadAgentInfo(agentId);

    // Build prompt with previous results
    const previousResults = await getPreviousResults(demand.id, step.depends_on);
    const prompt = buildStepPrompt(demand, step, previousResults);

    // Call LLM
    const systemPrompt = agentInfo?.identity
      ? `${agentInfo.identity}\n\nVocê está executando uma etapa de uma demanda do Hawk OS.`
      : 'Você é um agente especialista executando uma etapa de uma demanda do Hawk OS.';

    const response = await getClient().chat.completions.create(
      {
        model: agentInfo?.model ?? DEFAULT_MODEL,
        max_tokens: agentInfo?.maxTokens ?? 4096,
        temperature: agentInfo?.temperature ?? 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      },
      { signal: AbortSignal.timeout(60_000) },
    );

    const result = response.choices[0]?.message.content ?? 'Sem resultado';

    // Release claim and mark as completed
    await releaseStep(step.id, 'completed', result);

    await createLog(demand.id, step.id, {
      log_type: 'agent_action',
      agent_id: step.assigned_agent_id ?? undefined,
      message: `Step concluído: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`,
    });
  } catch (error) {
    const errorMsg = String(error);

    if (step.retry_count < step.max_retries) {
      // Release claim and re-queue for retry
      await releaseStep(step.id, 'ready', undefined, errorMsg);
      await updateStep(step.id, { retry_count: step.retry_count + 1 });
      await createLog(demand.id, step.id, {
        log_type: 'retry',
        message: `Retry ${step.retry_count + 1}/${step.max_retries}: ${errorMsg}`,
      });
    } else {
      // Release claim and mark as failed
      await releaseStep(step.id, 'failed', undefined, errorMsg);
      await createLog(demand.id, step.id, {
        log_type: 'error',
        message: `Step falhou após ${step.max_retries} tentativas: ${errorMsg}`,
      });
    }
  }
}

/**
 * Check if a demand is complete and update status accordingly
 */
async function checkDemandCompletion(demand: Demand): Promise<void> {
  const steps = await listSteps(demand.id);
  const allDone = steps.every((s) => ['completed', 'skipped', 'cancelled'].includes(s.status));
  const anyFailed = steps.some((s) => s.status === 'failed');
  const anyWaiting = steps.some((s) => s.status === 'waiting_human');

  if (anyWaiting) return; // Still waiting for human approval

  if (allDone) {
    await updateDemand(demand.id, {
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
    });
    await createLog(demand.id, null, {
      log_type: 'status_change',
      message: 'Demanda concluída com sucesso',
    });
    notify('demand_completed', { demandId: demand.id, title: demand.title });
  } else if (anyFailed) {
    // Check if all non-failed steps are done
    const nonFailed = steps.filter((s) => s.status !== 'failed');
    const allNonFailedDone = nonFailed.every((s) =>
      ['completed', 'skipped', 'cancelled', 'pending'].includes(s.status),
    );

    if (allNonFailedDone) {
      await updateDemand(demand.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      });
      const failedSteps = steps.filter((s) => s.status === 'failed');
      await createLog(demand.id, null, {
        log_type: 'error',
        message: `Demanda falhou: ${failedSteps.length} step(s) falharam`,
      });
    }
  }
}

/**
 * Main queue processor — called by cron every 2 minutes.
 * Recovers stale claims before processing new work (Paperclip heartbeat pattern).
 */
export async function processDemandQueue(): Promise<void> {
  // Recover steps that were claimed but not completed (crash recovery)
  const recovered = await recoverStaleClaims();
  if (recovered > 0) {
    console.log(`[demand-engine] Recovered ${recovered} stale step claim(s)`);
  }

  const activeDemands = await getActiveDemands();
  const runningDemands = activeDemands.filter((d) => d.status === 'running');

  for (const demand of runningDemands) {
    try {
      // Get ready steps
      const readySteps = await getReadySteps(demand.id);

      if (readySteps.length > 0) {
        // Execute all ready steps in parallel
        await Promise.allSettled(readySteps.map((step) => executeStep(demand, step)));
      }

      // After execution, resolve dependencies for next steps
      await resolveDependencies(demand.id);

      // Update progress
      await updateDemandProgress(demand.id);

      // Check completion
      await checkDemandCompletion(demand);
    } catch (error) {
      console.error(`[demand-engine] Error processing demand ${demand.id}:`, error);
      await createLog(demand.id, null, {
        log_type: 'error',
        message: `Erro no processamento: ${String(error)}`,
      });
    }
  }
}
