export type CalendarEvent = {
  id: string;
  google_event_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: 'confirmed' | 'cancelled' | 'tentative';
  organizer_email?: string;
  tags?: string[];
  is_recurring: boolean;
  recurrence_rule?: string;
  created_at: string;
  updated_at: string;
};

export type CreateEventInput = {
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  tags?: string[];
};

export type CalendarReminder = {
  id: string;
  event_id: string;
  type: 'notification' | 'email' | 'sms';
  minutes_before: number;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
};

export type CalendarAttendee = {
  id: string;
  event_id: string;
  email: string;
  display_name?: string;
  response_status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  is_organizer: boolean;
};

export type CalendarSyncConfig = {
  id: string;
  calendar_id: string;
  calendar_name?: string;
  google_calendar_id?: string;
  sync_enabled: boolean;
  last_sync_at?: string;
};

export type EventListOptions = {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  upcomingOnly?: boolean;
};

// ── Availability (Cal.com pattern) ─────────────────────────

export type AvailabilitySlot = {
  id: string;
  schedule_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type AvailabilitySchedule = {
  id: string;
  name: string;
  timezone: string;
  is_default: boolean;
  availability_slots?: AvailabilitySlot[];
  created_at: string;
};

export type FreeSlot = {
  start: Date;
  end: Date;
  durationMinutes: number;
};
