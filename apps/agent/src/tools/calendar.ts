import {
  createEvent,
  deleteEvent,
  findFreeSlots,
  updateEvent,
} from '@hawk/module-calendar/queries';
import { z } from 'zod';

import type { ToolDefinition } from './types.js';

export const calendarTools: Record<string, ToolDefinition> = {
  create_event: {
    name: 'create_event',
    modules: ['calendar'],
    description: 'Cria um evento no calendário',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título do evento' },
        start_at: { type: 'string', description: 'Data/hora de início (YYYY-MM-DD ou ISO)' },
        end_at: { type: 'string', description: 'Data/hora de fim (opcional)' },
        description: { type: 'string', description: 'Descrição opcional' },
        location: { type: 'string', description: 'Local opcional' },
      },
      required: ['title', 'start_at'],
    },
    schema: z.object({
      title: z.string().min(1).max(200),
      start_at: z.string().min(1),
      end_at: z.string().optional(),
      description: z.string().max(2000).optional(),
      location: z.string().max(200).optional(),
    }),
    handler: async (args: {
      title: string;
      start_at: string;
      end_at?: string;
      description?: string;
      location?: string;
    }) => {
      const startDate = new Date(args.start_at);
      const endDate = args.end_at
        ? new Date(args.end_at)
        : new Date(startDate.getTime() + 60 * 60 * 1000);

      const event = await createEvent({
        title: args.title,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        description: args.description,
        location: args.location,
      });

      return `Evento criado: ${event.title}`;
    },
  },

  update_event: {
    name: 'update_event',
    modules: ['calendar'],
    description: 'Atualiza um evento no calendário',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do evento' },
        title: { type: 'string', description: 'Novo título' },
        start_at: { type: 'string', description: 'Nova data/hora de início' },
        end_at: { type: 'string', description: 'Nova data/hora de fim' },
        description: { type: 'string', description: 'Nova descrição' },
        location: { type: 'string', description: 'Novo local' },
      },
      required: ['id'],
    },
    schema: z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      start_at: z.string().optional(),
      end_at: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    handler: async (args: {
      id: string;
      title?: string;
      start_at?: string;
      end_at?: string;
      description?: string;
      location?: string;
    }) => {
      const { id, ...input } = args;
      const event = await updateEvent(id, {
        ...input,
        start_at: input.start_at ? new Date(input.start_at).toISOString() : undefined,
        end_at: input.end_at ? new Date(input.end_at).toISOString() : undefined,
      });
      return `Evento atualizado: ${event.title}`;
    },
  },

  delete_event: {
    name: 'delete_event',
    modules: ['calendar'],
    dangerous: true,
    description: 'Deleta um evento do calendário',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID do evento a deletar' },
      },
      required: ['id'],
    },
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args: { id: string }) => {
      await deleteEvent(args.id);
      return 'Evento deletado.';
    },
  },

  find_free_slots: {
    name: 'find_free_slots',
    modules: ['calendar'],
    description: 'Encontra horários livres na agenda para uma duração específica',
    parameters: {
      type: 'object',
      properties: {
        duration_minutes: { type: 'number', description: 'Duração da reunião/evento em minutos' },
        days_ahead: { type: 'number', description: 'Quantos dias a frente buscar (default 7)' },
      },
      required: ['duration_minutes'],
    },
    schema: z.object({
      duration_minutes: z.number().int().positive().max(480),
      days_ahead: z.number().int().min(1).max(30).optional(),
    }),
    handler: async (args: { duration_minutes: number; days_ahead?: number }) => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + (args.days_ahead ?? 7));
      const slots = await findFreeSlots(args.duration_minutes, from, to);
      if (slots.length === 0) return 'Nenhum horário livre encontrado no período.';
      return [
        `**Horários livres** para ${args.duration_minutes}min:`,
        ...slots
          .slice(0, 5)
          .map(
            (s) =>
              `• ${s.start.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${s.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–${s.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          ),
        slots.length > 5 ? `... e mais ${slots.length - 5} horários` : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
};
