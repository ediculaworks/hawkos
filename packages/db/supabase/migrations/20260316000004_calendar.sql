-- =============================================================================
-- Migration 0004: Schema Calendar
-- Módulo de agenda: eventos, lembretes, sincronização Google Calendar
-- =============================================================================

BEGIN;

-- Eventos do calendário
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'tentative')),
  organizer_email TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_events_start_at ON calendar_events(start_at DESC);
CREATE INDEX idx_calendar_events_end_at ON calendar_events(end_at DESC);
CREATE INDEX idx_calendar_events_google_event_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_is_recurring ON calendar_events(is_recurring);

-- Lembretes para eventos
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('notification', 'email', 'sms')),
  minutes_before INT NOT NULL DEFAULT 15,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_reminders_event_id ON calendar_reminders(event_id);
CREATE INDEX idx_calendar_reminders_status ON calendar_reminders(status);

-- Participantes/convidados de evento
CREATE TABLE IF NOT EXISTS calendar_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  response_status TEXT DEFAULT 'needsAction' CHECK (response_status IN ('accepted', 'declined', 'tentative', 'needsAction')),
  is_organizer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_attendees_event_id ON calendar_attendees(event_id);
CREATE INDEX idx_calendar_attendees_email ON calendar_attendees(email);

-- Configuração de sincronização com Google Calendar
CREATE TABLE IF NOT EXISTS calendar_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id TEXT NOT NULL UNIQUE,
  calendar_name TEXT,
  google_calendar_id TEXT UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_sync_config_sync_enabled ON calendar_sync_config(sync_enabled);
CREATE INDEX idx_calendar_sync_config_last_sync_at ON calendar_sync_config(last_sync_at);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON calendar_events FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON calendar_reminders FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON calendar_attendees FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON calendar_sync_config FOR ALL TO authenticated USING (true);

ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_reminders FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_attendees FORCE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_config FORCE ROW LEVEL SECURITY;

-- Triggers para atualizar updated_at
CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER calendar_sync_config_updated_at
  BEFORE UPDATE ON calendar_sync_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
