import { db } from '@hawk/db';
import type {
  AvailabilitySchedule,
  CalendarAttendee,
  CalendarEvent,
  CreateEventInput,
  EventListOptions,
  FreeSlot,
} from './types';
import { z } from 'zod';
import { createLogger, HawkError, ValidationError } from '@hawk/shared';
const logger = createLogger('calendar');

const CreateEventSchema = z.object({
  title: z.string().min(1),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
});

/**
 * Criar um novo evento no calendário
 */
export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
  const parsed = CreateEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(`Invalid input: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  }
  const { data, error } = await db
    .from('calendar_events')
    .insert([
      {
        title: input.title,
        description: input.description,
        location: input.location,
        start_at: input.start_at,
        end_at: input.end_at,
        all_day: input.all_day || false,
        tags: input.tags || [],
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create event');
    throw new HawkError(`Failed to create event: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as CalendarEvent;
}

/**
 * Listar eventos com filtros
 */
export async function listEvents(options?: EventListOptions): Promise<CalendarEvent[]> {
  let query = db
    .from('calendar_events')
    .select(
      'id, google_event_id, title, description, location, start_at, end_at, all_day, status, organizer_email, tags, is_recurring, created_at, updated_at',
    )
    .order('start_at', { ascending: true });

  if (options?.startDate) query = query.gte('start_at', options.startDate);
  if (options?.endDate) query = query.lte('end_at', options.endDate);

  if (options?.upcomingOnly) {
    const now = new Date().toISOString();
    query = query.gte('start_at', now);
  }

  if (options?.limit) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list events');
    throw new HawkError(`Failed to list events: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data || []) as CalendarEvent[];
}

/**
 * Obter um evento específico
 */
export async function getEvent(eventId: string): Promise<CalendarEvent> {
  const { data, error } = await db
    .from('calendar_events')
    .select(
      'id, google_event_id, title, description, location, start_at, end_at, all_day, status, organizer_email, tags, is_recurring, recurrence_rule, created_at, updated_at',
    )
    .eq('id', eventId)
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to get event');
    throw new HawkError(`Failed to get event: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as CalendarEvent;
}

/**
 * Atualizar um evento
 */
export async function updateEvent(
  eventId: string,
  updates: Partial<CreateEventInput>,
): Promise<CalendarEvent> {
  const { data, error } = await db
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update event');
    throw new HawkError(`Failed to update event: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as CalendarEvent;
}

/**
 * Deletar um evento
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await db.from('calendar_events').delete().eq('id', eventId);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete event');
    throw new HawkError(`Failed to delete event: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

/**
 * Obter participantes de um evento
 */
export async function getEventAttendees(eventId: string): Promise<CalendarAttendee[]> {
  const { data, error } = await db
    .from('calendar_attendees')
    .select('id, event_id, email, display_name, response_status, is_organizer')
    .eq('event_id', eventId);

  if (error) {
    logger.error({ error: error.message }, 'Failed to get attendees');
    throw new HawkError(`Failed to get attendees: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data || []) as CalendarAttendee[];
}

/**
 * Adicionar um participante a um evento
 */
export async function addAttendee(
  eventId: string,
  email: string,
  displayName?: string,
): Promise<CalendarAttendee> {
  const { data, error } = await db
    .from('calendar_attendees')
    .insert([
      {
        event_id: eventId,
        email,
        display_name: displayName,
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to add attendee');
    throw new HawkError(`Failed to add attendee: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as CalendarAttendee;
}

/**
 * Obter eventos próximos (próximos 7 dias)
 */
export async function getUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return listEvents({
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    limit: 50,
  });
}

/**
 * Obter eventos de um dia específico
 */
export async function getDayEvents(date: string): Promise<CalendarEvent[]> {
  const startDate = `${date}T00:00:00Z`;
  const endDate = `${date}T23:59:59Z`;

  return listEvents({
    startDate,
    endDate,
  });
}

// ============================================================
// AVAILABILITY + FREE SLOT FINDER (Cal.com pattern)
// ============================================================

/**
 * Busca o schedule de disponibilidade padrão
 */
export async function getDefaultSchedule(): Promise<AvailabilitySchedule | null> {
  // biome-ignore lint/suspicious/noExplicitAny: table added via migration, types not regenerated
  const { data } = await (db as any)
    .from('availability_schedules')
    .select('*, availability_slots(*)')
    .eq('is_default', true)
    .maybeSingle();
  return data as AvailabilitySchedule | null;
}

/**
 * Encontra slots livres dado duração + intervalo de datas (Cal.com pattern)
 */
export async function findFreeSlots(
  durationMinutes: number,
  fromDate: Date,
  toDate: Date,
  _timezone = 'America/Sao_Paulo',
): Promise<FreeSlot[]> {
  const schedule = await getDefaultSchedule();
  if (!schedule?.availability_slots?.length) return [];

  const events = await listEvents({
    startDate: fromDate.toISOString(),
    endDate: toDate.toISOString(),
  });

  const freeSlots: FreeSlot[] = [];
  const current = new Date(fromDate);

  while (current < toDate) {
    const dayOfWeek = current.getDay();

    // Verificar se há slot para este dia da semana
    const daySlots = schedule.availability_slots.filter((s) => s.day_of_week === dayOfWeek);

    for (const slot of daySlots) {
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);

      const slotStart = new Date(current);
      slotStart.setHours(startH as number, startM as number, 0, 0);

      const slotEnd = new Date(current);
      slotEnd.setHours(endH as number, endM as number, 0, 0);

      // Gerar candidatos de durationMinutes dentro do slot disponível
      const candidate = new Date(slotStart);
      while (candidate.getTime() + durationMinutes * 60000 <= slotEnd.getTime()) {
        const candidateEnd = new Date(candidate.getTime() + durationMinutes * 60000);

        // Verificar se não conflita com eventos existentes
        const hasConflict = events.some((event) => {
          const eventStart = new Date(event.start_at);
          const eventEnd = new Date(event.end_at);
          return candidateEnd > eventStart && candidate < eventEnd;
        });

        if (!hasConflict) {
          // Não adicionar duplicados (pode haver sobreposição de candidatos)
          const last = freeSlots[freeSlots.length - 1];
          if (!last || last.start.getTime() !== candidate.getTime()) {
            freeSlots.push({
              start: new Date(candidate),
              end: candidateEnd,
              durationMinutes,
            });
          }
        }

        candidate.setMinutes(candidate.getMinutes() + 30); // passo de 30min
      }
    }

    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return freeSlots;
}
