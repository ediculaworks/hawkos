import {
  createPerson,
  findPersonByName,
  listPeople,
  logInteraction,
  updateHowWeMet,
  updatePerson,
} from '@hawk/module-people/queries';
import { z } from 'zod';

import type { Relationship } from '@hawk/module-people/types';
import type { ToolDefinition } from './types.js';

export const peopleTools: Record<string, ToolDefinition> = {
  create_person: {
    name: 'create_person',
    modules: ['people'],
    description: 'Adiciona uma nova pessoa ao CRM',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da pessoa' },
        relationship: {
          type: 'string',
          enum: ['family', 'friend', 'colleague', 'romantic', 'professional', 'medical'],
          description: 'Tipo de relacionamento',
        },
        phone: { type: 'string', description: 'Telefone opcional' },
        birthday: { type: 'string', description: 'Aniversário (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Notas sobre a pessoa' },
      },
      required: ['name'],
    },
    schema: z.object({
      name: z.string().min(1).max(200),
      relationship: z
        .enum(['family', 'friend', 'colleague', 'romantic', 'professional', 'medical'])
        .optional(),
      phone: z.string().optional(),
      birthday: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      notes: z.string().optional(),
    }),
    handler: async (args: {
      name: string;
      relationship?: string;
      phone?: string;
      birthday?: string;
      notes?: string;
    }) => {
      const person = await createPerson({
        name: args.name,
        relationship: args.relationship as Relationship | undefined,
        phone: args.phone,
        birthday: args.birthday,
        notes: args.notes,
      });
      return `Pessoa adicionada: ${person.name}`;
    },
  },

  log_interaction: {
    name: 'log_interaction',
    modules: ['people'],
    description: 'Registra uma interação com uma pessoa',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Nome da pessoa' },
        type: {
          type: 'string',
          enum: ['call', 'meeting', 'message', 'visit', 'email'],
          description: 'Tipo de interação',
        },
        summary: { type: 'string', description: 'Resumo do que aconteceu' },
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: 'Sentimento',
        },
      },
      required: ['person_name', 'type'],
    },
    schema: z.object({
      person_name: z.string().min(1),
      type: z.enum(['call', 'meeting', 'message', 'visit', 'email']),
      summary: z.string().optional(),
      sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    }),
    handler: async (args: {
      person_name: string;
      type: 'call' | 'meeting' | 'message' | 'visit' | 'email';
      summary?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
    }) => {
      const person = await findPersonByName(args.person_name);
      if (!person) return `Erro: Pessoa "${args.person_name}" não encontrada.`;

      await logInteraction({
        person_id: person.id,
        type: args.type,
        summary: args.summary,
        sentiment: args.sentiment,
      });

      return `Interação registrada com ${person.name}: ${args.type}`;
    },
  },

  update_how_we_met: {
    name: 'update_how_we_met',
    modules: ['people'],
    description: 'Atualiza como conheceu uma pessoa',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Nome da pessoa' },
        how_we_met: { type: 'string', description: 'Como se conheceram' },
        first_met_at: { type: 'string', description: 'Data aproximada (YYYY-MM-DD)' },
        first_met_location: { type: 'string', description: 'Local onde se conheceram' },
      },
      required: ['person_name', 'how_we_met'],
    },
    schema: z.object({
      person_name: z.string().min(1),
      how_we_met: z.string().min(1),
      first_met_at: z.string().optional(),
      first_met_location: z.string().optional(),
    }),
    handler: async (args: {
      person_name: string;
      how_we_met: string;
      first_met_at?: string;
      first_met_location?: string;
    }) => {
      const person = await findPersonByName(args.person_name);
      if (!person) return `Erro: Pessoa "${args.person_name}" não encontrada.`;

      await updateHowWeMet({
        person_id: person.id,
        how_we_met: args.how_we_met,
        first_met_at: args.first_met_at,
        first_met_location: args.first_met_location,
      });
      return `Atualizado como conheceu ${person.name}.`;
    },
  },

  list_people: {
    name: 'list_people',
    modules: ['people'],
    description: 'Lista as pessoas do CRM com paginação',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número de resultados (padrão: 20, máx: 50)' },
        offset: { type: 'number', description: 'Deslocamento para paginação' },
      },
      required: [],
    },
    schema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    handler: async (args: { limit?: number; offset?: number }) => {
      const result = await listPeople(args.limit ?? 20, args.offset ?? 0);
      if (result.data.length === 0) return 'Nenhuma pessoa encontrada no CRM.';
      const lines = result.data.map((p) => `• ${p.name} (${p.relationship ?? 'sem tipo'})`);
      return `${result.total} pessoas no total:\n${lines.join('\n')}`;
    },
  },

  update_person: {
    name: 'update_person',
    modules: ['people'],
    description: 'Atualiza informações de uma pessoa existente no CRM',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Nome atual da pessoa para encontrá-la' },
        name: { type: 'string', description: 'Novo nome (opcional)' },
        relationship: {
          type: 'string',
          enum: ['family', 'friend', 'colleague', 'romantic', 'professional', 'medical'],
          description: 'Tipo de relacionamento',
        },
        phone: { type: 'string', description: 'Telefone' },
        birthday: { type: 'string', description: 'Aniversário (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Notas sobre a pessoa' },
        company: { type: 'string', description: 'Empresa onde trabalha' },
        role: { type: 'string', description: 'Cargo ou função' },
      },
      required: ['person_name'],
    },
    schema: z.object({
      person_name: z.string().min(1),
      name: z.string().min(1).optional(),
      relationship: z
        .enum(['family', 'friend', 'colleague', 'romantic', 'professional', 'medical'])
        .optional(),
      phone: z.string().optional(),
      birthday: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      notes: z.string().optional(),
      company: z.string().optional(),
      role: z.string().optional(),
    }),
    handler: async (args: {
      person_name: string;
      name?: string;
      relationship?: string;
      phone?: string;
      birthday?: string;
      notes?: string;
      company?: string;
      role?: string;
    }) => {
      const person = await findPersonByName(args.person_name);
      if (!person) return `Erro: Pessoa "${args.person_name}" não encontrada.`;

      const { person_name: _, ...updates } = args;
      const updated = await updatePerson(person.id, updates as Parameters<typeof updatePerson>[1]);
      return `Pessoa atualizada: ${updated.name}`;
    },
  },
};
