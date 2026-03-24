import {
  createPerson,
  findPersonByName,
  logInteraction,
  updateHowWeMet,
} from '@hawk/module-people/queries';

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
};
