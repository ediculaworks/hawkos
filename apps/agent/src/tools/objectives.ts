import {
  createObjective,
  createTask,
  updateObjective,
  updateTask,
} from '@hawk/module-objectives/queries';

import type { ToolDefinition } from './types.js';

export const objectiveTools: Record<string, ToolDefinition> = {
  create_objective: {
    name: 'create_objective',
    modules: ['objectives'],
    description: 'Cria um novo objetivo',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do objetivo' },
        description: { type: 'string', description: 'Descrição opcional' },
        timeframe: {
          type: 'string',
          enum: ['short', 'medium', 'long'],
          description: 'Prazo: curto/médio/longo',
        },
        target_date: { type: 'string', description: 'Data alvo (YYYY-MM-DD)' },
      },
      required: ['title', 'timeframe'],
    },
    handler: async (args: {
      title: string;
      description?: string;
      timeframe: 'short' | 'medium' | 'long';
      target_date?: string;
    }) => {
      const objective = await createObjective({
        title: args.title,
        description: args.description,
        timeframe: args.timeframe,
        target_date: args.target_date,
      });
      return `Objetivo criado: ${objective.title} (${objective.timeframe})`;
    },
  },

  update_objective: {
    name: 'update_objective',
    modules: ['objectives'],
    description: 'Atualiza um objetivo existente (título, status, timeframe, etc)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do objetivo' },
        title: { type: 'string', description: 'Novo título' },
        description: { type: 'string', description: 'Nova descrição' },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'cancelled'],
          description: 'Novo status',
        },
        timeframe: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Novo prazo' },
        target_date: { type: 'string', description: 'Nova data alvo (YYYY-MM-DD)' },
      },
      required: ['id'],
    },
    handler: async (args: {
      id: string;
      title?: string;
      description?: string;
      status?: 'active' | 'paused' | 'completed' | 'abandoned';
      timeframe?: 'short' | 'medium' | 'long';
      target_date?: string;
    }) => {
      const { id, ...input } = args;
      const obj = await updateObjective(id, input);
      return `Objetivo atualizado: ${obj.title} (${obj.status})`;
    },
  },

  create_task: {
    name: 'create_task',
    modules: ['objectives'],
    description: 'Cria uma nova tarefa',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título da tarefa' },
        objective_title: {
          type: 'string',
          description: 'Título do objetivo relacionado (opcional)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Prioridade',
        },
        due_date: { type: 'string', description: 'Data de vencimento (YYYY-MM-DD)' },
      },
      required: ['title'],
    },
    handler: async (args: {
      title: string;
      objective_title?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      due_date?: string;
    }) => {
      const task = await createTask({
        title: args.title,
        objective_id: undefined,
        priority: args.priority,
        due_date: args.due_date,
      });
      return `Tarefa criada: ${task.title}`;
    },
  },

  update_task: {
    name: 'update_task',
    modules: ['objectives'],
    description: 'Atualiza uma tarefa (título, status, prioridade, etc)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID da tarefa' },
        title: { type: 'string', description: 'Novo título' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done', 'cancelled'],
          description: 'Novo status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Nova prioridade',
        },
        due_date: { type: 'string', description: 'Nova data de vencimento (YYYY-MM-DD)' },
      },
      required: ['id'],
    },
    handler: async (args: {
      id: string;
      title?: string;
      status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      due_date?: string;
    }) => {
      const { id, ...input } = args;
      const task = await updateTask(id, input);
      return `Tarefa atualizada: ${task.title} (${task.status})`;
    },
  },
};
