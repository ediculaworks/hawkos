-- Migration: People / CRM
-- Módulo: people

CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  relationship TEXT CHECK (relationship IN ('family', 'friend', 'colleague', 'romantic', 'professional', 'medical')),
  role TEXT,                          -- 'mother', 'grandmother', 'cofounder', 'psychiatrist', etc.
  phone TEXT,
  email TEXT,
  birthday DATE,
  city TEXT,
  notes TEXT,
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  contact_frequency TEXT CHECK (contact_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'as_needed')),
  last_interaction TIMESTAMPTZ,
  next_contact_reminder DATE,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'meeting', 'message', 'visit', 'email')),
  channel TEXT CHECK (channel IN ('whatsapp', 'discord', 'phone', 'in_person', 'email', 'other')),
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  duration_minutes INTEGER,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_people_active ON people(active) WHERE active = true;
CREATE INDEX idx_people_next_reminder ON people(next_contact_reminder) WHERE next_contact_reminder IS NOT NULL;
CREATE INDEX idx_people_birthday ON people(birthday) WHERE birthday IS NOT NULL;
CREATE INDEX idx_interactions_person ON interactions(person_id, date DESC);

-- Trigger: atualizar last_interaction e calcular next_contact_reminder após interação
CREATE OR REPLACE FUNCTION after_interaction_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_frequency TEXT;
  v_next_date DATE;
BEGIN
  SELECT contact_frequency INTO v_frequency
  FROM people WHERE id = NEW.person_id;

  v_next_date := CASE v_frequency
    WHEN 'weekly'     THEN CURRENT_DATE + 7
    WHEN 'biweekly'   THEN CURRENT_DATE + 14
    WHEN 'monthly'    THEN CURRENT_DATE + 30
    WHEN 'quarterly'  THEN CURRENT_DATE + 90
    ELSE NULL
  END;

  UPDATE people
  SET
    last_interaction = NEW.date,
    next_contact_reminder = v_next_date,
    updated_at = now()
  WHERE id = NEW.person_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER interactions_update_person
  AFTER INSERT ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION after_interaction_insert();

-- Trigger updated_at para people
CREATE OR REPLACE FUNCTION set_people_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW
  EXECUTE FUNCTION set_people_updated_at();
