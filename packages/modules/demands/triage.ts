// Triage: Hawk analisa uma demand e decompõe em steps executáveis
import { db } from '@hawk/db';
import OpenAI from 'openai';
import { createLog, createStep, resolveDependencies, updateDemand } from './queries';
import type { CreateStepInput, Demand, TriageResult, TriageStep } from './types';

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

const TRIAGE_MODEL = process.env.OPENROUTER_MODEL ?? 'openrouter/auto';

async function loadAvailableAgents(): Promise<
  { id: string; name: string; description: string; tools_enabled: string[] }[]
> {
  const { data } = await db
    .from('agent_templates')
    .select('id, name, description, tools_enabled')
    .eq('is_user_facing', true);

  return (data ?? []) as {
    id: string;
    name: string;
    description: string;
    tools_enabled: string[];
  }[];
}

/**
 * Tria uma demand: chama LLM para decompor em steps com agent assignments.
 * Retorna a demand atualizada.
 */
export async function triageDemand(demand: Demand): Promise<Demand> {
  // Mark as triaging
  await updateDemand(demand.id, { status: 'triaging' });
  await createLog(demand.id, null, {
    log_type: 'status_change',
    message: 'Triage iniciada',
  });

  try {
    const agents = await loadAvailableAgents();
    const agentDescriptions = agents
      .map(
        (a) =>
          `- ${a.name} (${a.id}): ${a.description ?? 'sem descrição'} | Módulos: ${a.tools_enabled.join(', ') || 'nenhum'}`,
      )
      .join('\n');

    const prompt = `Analise a seguinte demanda e crie um plano de execução detalhado.

DEMANDA: ${demand.title}
${demand.description ? `DESCRIÇÃO: ${demand.description}` : ''}
${demand.module ? `MÓDULO PRINCIPAL: ${demand.module}` : ''}
${demand.deadline ? `PRAZO: ${demand.deadline}` : ''}

AGENTES DISPONÍVEIS:
${agentDescriptions}

Retorne APENAS JSON válido (sem markdown, sem \`\`\`):
{
  "analysis": "Sua análise da demanda em 1-2 frases",
  "estimated_complexity": "simple|medium|complex",
  "estimated_duration_hours": <número>,
  "suggested_agents": ["<agent_id>", ...],
  "requires_approval": <boolean — true se há ações irreversíveis>,
  "steps": [
    {
      "title": "Título do step",
      "description": "O que fazer neste step",
      "execution_type": "sequential|parallel|conditional|checkpoint",
      "assigned_agent_name": "Nome do agente",
      "depends_on_indices": [<índices dos steps anteriores necessários>],
      "tool_hint": "nome_do_tool opcional",
      "estimated_minutes": <número>
    }
  ]
}

Regras:
- Máximo 8 steps para demandas simples, 15 para complexas
- Use checkpoints para ações irreversíveis (transferências, deletar dados)
- Paralelizar steps independentes quando possível
- Primeiro step sempre é análise/coleta de dados
- assigned_agent_name deve ser um dos agentes listados (use o nome exato)`;

    const response = await getClient().chat.completions.create({
      model: TRIAGE_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Você é o planejador de demandas do Hawk OS. Analise demandas e crie planos de execução estruturados. Responda SEMPRE com JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices[0]?.message.content ?? '';

    // Parse JSON (strip markdown fences if present)
    const jsonStr = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const triageResult: TriageResult = JSON.parse(jsonStr);

    // Resolve agent names to IDs
    const agentMap = new Map(agents.map((a) => [a.name.toLowerCase(), a.id]));

    // Create steps in DB
    const createdStepIds: string[] = [];

    for (let i = 0; i < triageResult.steps.length; i++) {
      const ts = triageResult.steps[i] as TriageStep;
      const agentId = agentMap.get(ts.assigned_agent_name.toLowerCase()) ?? null;

      // Resolve depends_on from indices to UUIDs
      const dependsOn = ts.depends_on_indices
        .filter((idx) => idx >= 0 && idx < createdStepIds.length)
        .map((idx) => createdStepIds[idx] as string);

      const stepInput: CreateStepInput = {
        title: ts.title,
        description: ts.description,
        step_order: i,
        execution_type: ts.execution_type,
        assigned_agent_id: agentId ?? undefined,
        depends_on: dependsOn,
        tool_name: ts.tool_hint ?? undefined,
        estimated_duration_minutes: ts.estimated_minutes,
      };

      const step = await createStep(demand.id, stepInput);
      createdStepIds.push(step.id);
    }

    // Update demand with triage result
    const hasCheckpoint = triageResult.steps.some((s) => s.execution_type === 'checkpoint');
    const newStatus = triageResult.requires_approval || hasCheckpoint ? 'planned' : 'running';

    const updated = await updateDemand(demand.id, {
      status: newStatus,
      triage_result: triageResult,
      total_steps: triageResult.steps.length,
      started_at: newStatus === 'running' ? new Date().toISOString() : undefined,
    });

    // Resolve dependencies to mark first steps as ready
    await resolveDependencies(demand.id);

    await createLog(demand.id, null, {
      log_type: 'status_change',
      message: `Triage concluída: ${triageResult.steps.length} steps criados (${triageResult.estimated_complexity}). Status: ${newStatus}`,
      metadata: {
        complexity: triageResult.estimated_complexity,
        duration_hours: triageResult.estimated_duration_hours,
      },
    });

    return updated;
  } catch (error) {
    await createLog(demand.id, null, {
      log_type: 'error',
      message: `Triage falhou: ${String(error)}`,
    });
    await updateDemand(demand.id, { status: 'failed' });
    throw error;
  }
}
