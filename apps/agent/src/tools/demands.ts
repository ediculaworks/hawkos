import {
  createDemand,
  createLog,
  getActiveDemands,
  getDemandWithSteps,
  listSteps,
  updateDemand,
  updateStep,
} from '@hawk/module-demands/queries';
import { triageDemand } from '@hawk/module-demands/triage';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const demandTools: Record<string, ToolDefinition> = {
  create_demand: {
    name: 'create_demand',
    modules: ['objectives'],
    description:
      'Cria uma nova demanda (tarefa complexa de longa duração que será decomposta em etapas e executada por agentes)',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título da demanda' },
        description: {
          type: 'string',
          description: 'Descrição detalhada do que precisa ser feito',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Prioridade',
        },
        module: {
          type: 'string',
          description: 'Módulo principal (finances, health, career, etc.)',
        },
        deadline: {
          type: 'string',
          description: 'Prazo (ISO datetime ou YYYY-MM-DD)',
        },
      },
      required: ['title'],
    },
    schema: z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      module: z.string().optional(),
      deadline: z.string().optional(),
    }),
    handler: async (args: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      module?: string;
      deadline?: string;
    }) => {
      const demand = await createDemand({
        title: args.title,
        description: args.description,
        priority: args.priority,
        module: args.module,
        deadline: args.deadline,
        origin: 'chat',
      });

      // Trigger triage asynchronously
      triageDemand(demand).catch((err) => console.error('[demands] Triage failed:', err));

      return `Demanda criada: "${demand.title}" (ID: ${demand.id}). Triage em andamento — os steps serão criados automaticamente e a execução iniciará em breve.`;
    },
  },

  list_demands: {
    name: 'list_demands',
    modules: ['objectives'],
    description: 'Lista demandas ativas com progresso e status dos steps',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['running', 'paused', 'planned', 'triaging', 'completed', 'failed'],
          description: 'Filtrar por status (opcional, default: ativas)',
        },
      },
    },
    schema: z.object({
      status: z
        .enum(['running', 'paused', 'planned', 'triaging', 'completed', 'failed'])
        .optional(),
    }),
    handler: async (args: { status?: string }) => {
      const demands = args.status ? await getActiveDemands() : await getActiveDemands();

      if (demands.length === 0) return 'Nenhuma demanda ativa no momento.';

      const lines: string[] = [];
      for (const d of demands) {
        const emoji =
          d.status === 'running'
            ? '🔄'
            : d.status === 'paused'
              ? '⏸'
              : d.status === 'planned'
                ? '📋'
                : d.status === 'triaging'
                  ? '🔍'
                  : '•';
        lines.push(
          `${emoji} ${d.title} — ${d.progress}% (${d.completed_steps}/${d.total_steps} steps) [${d.status}]`,
        );
      }

      return `Demandas ativas:\n${lines.join('\n')}`;
    },
  },

  get_demand_detail: {
    name: 'get_demand_detail',
    modules: ['objectives'],
    description: 'Mostra detalhes de uma demanda específica com todos os steps e seus status',
    parameters: {
      type: 'object',
      properties: {
        demand_id: { type: 'string', description: 'ID da demanda' },
      },
      required: ['demand_id'],
    },
    schema: z.object({
      demand_id: z.string().uuid(),
    }),
    handler: async (args: { demand_id: string }) => {
      const d = await getDemandWithSteps(args.demand_id);

      const stepLines = d.steps.map((s) => {
        const icon =
          s.status === 'completed'
            ? '✅'
            : s.status === 'running'
              ? '🔄'
              : s.status === 'failed'
                ? '❌'
                : s.status === 'waiting_human'
                  ? '⏳'
                  : s.status === 'skipped'
                    ? '⏭'
                    : s.status === 'ready'
                      ? '▶️'
                      : '⬜';
        const result = s.result ? ` → ${s.result.slice(0, 100)}` : '';
        return `  ${icon} ${s.title} [${s.status}]${result}`;
      });

      return `Demanda: ${d.title}
Status: ${d.status} | Progresso: ${d.progress}%
Steps (${d.completed_steps}/${d.total_steps}):
${stepLines.join('\n')}`;
    },
  },

  approve_demand_step: {
    name: 'approve_demand_step',
    modules: ['objectives'],
    description: 'Aprova ou rejeita um checkpoint de demanda aguardando aprovação humana',
    parameters: {
      type: 'object',
      properties: {
        step_id: { type: 'string', description: 'ID do step aguardando aprovação' },
        approved: {
          type: 'boolean',
          description: 'true para aprovar e continuar, false para rejeitar',
        },
        feedback: {
          type: 'string',
          description: 'Feedback opcional sobre a decisão',
        },
      },
      required: ['step_id', 'approved'],
    },
    schema: z.object({
      step_id: z.string().uuid(),
      approved: z.boolean(),
      feedback: z.string().optional(),
    }),
    handler: async (args: {
      step_id: string;
      approved: boolean;
      feedback?: string;
    }) => {
      if (args.approved) {
        await updateStep(args.step_id, {
          status: 'completed',
          result: args.feedback ?? 'Aprovado pelo usuário',
          completed_at: new Date().toISOString(),
        });
        return 'Checkpoint aprovado. A execução continuará no próximo ciclo.';
      }

      await updateStep(args.step_id, {
        status: 'cancelled',
        result: args.feedback ?? 'Rejeitado pelo usuário',
      });
      return 'Checkpoint rejeitado. Step cancelado.';
    },
  },

  cancel_demand: {
    name: 'cancel_demand',
    modules: ['objectives'],
    description: 'Cancela uma demanda em andamento e todos os steps pendentes',
    parameters: {
      type: 'object',
      properties: {
        demand_id: { type: 'string', description: 'ID da demanda' },
        reason: { type: 'string', description: 'Motivo do cancelamento' },
      },
      required: ['demand_id'],
    },
    schema: z.object({
      demand_id: z.string().uuid(),
      reason: z.string().optional(),
    }),
    handler: async (args: { demand_id: string; reason?: string }) => {
      // Cancel all pending/ready steps
      const steps = await listSteps(args.demand_id);
      for (const step of steps) {
        if (['pending', 'ready', 'running', 'waiting_human'].includes(step.status)) {
          await updateStep(step.id, { status: 'cancelled' });
        }
      }

      await updateDemand(args.demand_id, {
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      });

      await createLog(args.demand_id, null, {
        log_type: 'status_change',
        message: `Demanda cancelada${args.reason ? `: ${args.reason}` : ''}`,
      });

      return 'Demanda cancelada com sucesso.';
    },
  },

  update_demand: {
    name: 'update_demand',
    modules: ['objectives'],
    description: 'Atualiza título, descrição, prioridade ou contexto de uma demanda existente',
    parameters: {
      type: 'object',
      properties: {
        demand_id: { type: 'string', description: 'ID da demanda' },
        title: { type: 'string', description: 'Novo título' },
        description: { type: 'string', description: 'Nova descrição' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Nova prioridade',
        },
        context: { type: 'string', description: 'Contexto adicional para o agente' },
      },
      required: ['demand_id'],
    },
    schema: z.object({
      demand_id: z.string().uuid(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      context: z.string().optional(),
    }),
    handler: async (args: {
      demand_id: string;
      title?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      context?: string;
    }) => {
      const { demand_id, ...updates } = args;
      const demand = await updateDemand(demand_id, updates);
      return `Demanda atualizada: ${demand.title}`;
    },
  },
};
