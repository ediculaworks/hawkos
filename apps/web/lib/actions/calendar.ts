'use server';

import {
  createEvent,
  deleteEvent,
  getDayEvents,
  getEvent,
  getEventAttendees,
  getUpcomingEvents,
  listEvents,
  updateEvent,
} from '@hawk/module-calendar/queries';
import type {
  CalendarAttendee,
  CalendarEvent,
  CreateEventInput,
} from '@hawk/module-calendar/types';
import { withTenant } from '../supabase/with-tenant';

import { CreateEventSchema, EventListSchema, UpdateEventSchema } from '../schemas';

export async function fetchEvents(options?: unknown): Promise<CalendarEvent[]> {
  return withTenant(async () => {
    if (options) {
      const result = EventListSchema.safeParse(options);
      if (!result.success)
        throw new Error(`fetchEvents: ${result.error.issues.map((e) => e.message).join('; ')}`);
      return listEvents(result.data);
    }
    return listEvents();
  });
}

export async function fetchUpcomingEvents(days = 7): Promise<CalendarEvent[]> {
  return withTenant(async () => getUpcomingEvents(days));
}

export async function fetchDayEvents(date: string): Promise<CalendarEvent[]> {
  return withTenant(async () => getDayEvents(date));
}

export async function fetchEvent(id: string): Promise<CalendarEvent> {
  return withTenant(async () => getEvent(id));
}

export async function fetchEventAttendees(eventId: string): Promise<CalendarAttendee[]> {
  return withTenant(async () => getEventAttendees(eventId));
}

export async function addEvent(input: unknown): Promise<CalendarEvent> {
  return withTenant(async () => {
    const result = CreateEventSchema.safeParse(input);
    if (!result.success)
      throw new Error(`addEvent: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return createEvent(result.data as CreateEventInput);
  });
}

export async function editEvent(id: string, updates: unknown): Promise<CalendarEvent> {
  return withTenant(async () => {
    const result = UpdateEventSchema.safeParse(updates);
    if (!result.success)
      throw new Error(`editEvent: ${result.error.issues.map((e) => e.message).join('; ')}`);
    return updateEvent(id, result.data);
  });
}

export async function removeEvent(id: string): Promise<void> {
  return withTenant(async () => deleteEvent(id));
}

export async function fetchMonthEvents(year: number, month: number): Promise<CalendarEvent[]> {
  return withTenant(async () => {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    return listEvents({ startDate, endDate, limit: 200 });
  });
}
