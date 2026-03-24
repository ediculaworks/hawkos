-- Migration: Calendar — Availability Schedules + Event Types
-- Referência: docs/repositorios/calcom.md
-- Tasks: I1.7.1–4

BEGIN;

-- ============================================================
-- AVAILABILITY SCHEDULES (Cal.com pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS availability_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Padrão',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir apenas um schedule padrão por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_schedules_default
  ON availability_schedules(is_default)
  WHERE is_default = true;

ALTER TABLE availability_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage availability schedules" ON availability_schedules FOR ALL USING (true) WITH CHECK (true);

-- Slots recorrentes por dia da semana
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Dom, 1=Seg, ..., 6=Sáb
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_slot_time CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_schedule ON availability_slots(schedule_id, day_of_week);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage availability slots" ON availability_slots FOR ALL USING (true) WITH CHECK (true);

-- Overrides para datas específicas (feriados, férias, exceções pontuais)
CREATE TABLE IF NOT EXISTS availability_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_unavailable BOOLEAN DEFAULT false,  -- true = dia inteiro bloqueado
  start_time TIME,                       -- NULL se is_unavailable = true
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_id, date),
  CONSTRAINT valid_override CHECK (
    is_unavailable = true OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_availability_overrides_date ON availability_date_overrides(schedule_id, date);

ALTER TABLE availability_date_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage availability overrides" ON availability_date_overrides FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- EVENT TYPES (Cal.com pattern)
-- Tipos de reunião pré-configurados (1:1, consulta, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  buffer_before_minutes INT DEFAULT 0,
  buffer_after_minutes INT DEFAULT 15,
  location_type TEXT DEFAULT 'online' CHECK (location_type IN (
    'online', 'phone', 'in_person', 'custom'
  )),
  location_value TEXT,           -- URL do Meet/Zoom ou endereço
  schedule_id UUID REFERENCES availability_schedules(id) ON DELETE SET NULL,
  minimum_booking_notice_minutes INT DEFAULT 60,
  max_bookings_per_day INT,
  is_hidden BOOLEAN DEFAULT false,
  color TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_event_types_visible ON event_types(is_hidden) WHERE is_hidden = false;

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage event types" ON event_types FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Schedule padrão (Seg-Sex, 09:00–18:00)
-- ============================================================

INSERT INTO availability_schedules (name, timezone, is_default)
VALUES ('Semana de Trabalho', 'America/Sao_Paulo', true)
ON CONFLICT DO NOTHING;

-- Inserir slots Seg-Sex (dia 1 a 5) para o schedule padrão
WITH schedule AS (
  SELECT id FROM availability_schedules WHERE is_default = true LIMIT 1
)
INSERT INTO availability_slots (schedule_id, day_of_week, start_time, end_time)
SELECT
  s.id,
  d.day,
  '09:00'::TIME,
  '18:00'::TIME
FROM schedule s
CROSS JOIN (SELECT generate_series(1, 5) AS day) d
ON CONFLICT DO NOTHING;

-- Triggers updated_at
CREATE OR REPLACE FUNCTION update_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER availability_schedules_updated_at
  BEFORE UPDATE ON availability_schedules
  FOR EACH ROW EXECUTE FUNCTION update_availability_updated_at();

CREATE TRIGGER event_types_updated_at
  BEFORE UPDATE ON event_types
  FOR EACH ROW EXECUTE FUNCTION update_availability_updated_at();

COMMIT;
