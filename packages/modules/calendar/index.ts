// Module: Calendar
// Gestão de agenda: eventos, lembretes, sincronização Google Calendar

export type {
  CalendarEvent,
  CreateEventInput,
  CalendarReminder,
  CalendarAttendee,
  CalendarSyncConfig,
  EventListOptions,
} from './types';

export {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getEventAttendees,
  addAttendee,
  getUpcomingEvents,
  getDayEvents,
} from './queries';

export {
  eventCommand,
  agendaCommand,
  remindCommand,
  handleEvent,
  handleAgenda,
  handleRemind,
} from './commands';

export { loadL0, loadL1, loadL2 } from './context';
