// Engine: executa steps de demands de forma assíncrona
import { db } from '@hawk/db';
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

/**
 * Execute a single step
 */
async function executeStep(demand: Demand, step: DemandStep): Promise<void> {
  // Mark as running
  await updateStep(step.id, {
    status: 'running',
    started_at: new Date().toISOString(),
  });
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

    const response = await getClient().chat.completions.create({
      model: agentInfo?.model ?? DEFAULT_MODEL,
      max_tokens: agentInfo?.maxTokens ?? 4096,
      temperature: agentInfo?.temperature ?? 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const result = response.choices[0]?.message.content ?? 'Sem resultado';

    // Mark as completed
    await updateStep(step.id, {
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    });

    await createLog(demand.id, step.id, {
      log_type: 'agent_action',
      agent_id: step.assigned_agent_id ?? undefined,
      message: `Step concluído: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`,
    });
  } catch (error) {
    const errorMsg = String(error);

    if (step.retry_count < step.max_retries) {
      // Re-queue for retry
      await updateStep(step.id, {
        status: 'ready',
        retry_count: step.retry_count + 1,
        error_message: errorMsg,
      });
      await createLog(demand.id, step.id, {
        log_type: 'retry',
        message: `Retry ${step.retry_count + 1}/${step.max_retries}: ${errorMsg}`,
      });
    } else {
      // Mark as failed
      await updateStep(step.id, {
        status: 'failed',
        error_message: errorMsg,
      });
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
 * Main queue processor — called by cron every 2 minutes
 */
export async function processDemandQueue(): Promise<void> {
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
