-- Migration: Monica People Enhancement (special_dates, contact_reminders, how_we_met)
-- Referência: docs/repositorios/monica.md

BEGIN;

-- Colunas "how we met" em people
ALTER TABLE people ADD COLUMN IF NOT EXISTS how_we_met TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS first_met_at DATE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS first_met_location TEXT;

-- Tabela special_dates (aniversários, anniversários, datas especiais)
CREATE TABLE IF NOT EXISTS special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (label IN ('birthday', 'anniversary', 'first_met', 'death')),
  date DATE NOT NULL,
  is_year_unknown BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE special_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read special_dates"
  ON special_dates FOR SELECT
  USING (true);

CREATE POLICY "Users can insert special_dates"
  ON special_dates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update special_dates"
  ON special_dates FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete special_dates"
  ON special_dates FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_special_dates_person ON special_dates(person_id);
CREATE INDEX IF NOT EXISTS idx_special_dates_date ON special_dates(date) WHERE label = 'birthday';

-- Tabela contact_reminders (follow-up robusto com frequência)
CREATE TABLE IF NOT EXISTS contact_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('once', 'week', 'month', 'year')),
  frequency_value INT DEFAULT 1,
  initial_date DATE NOT NULL,
  next_expected_date DATE,
  last_triggered_at TIMESTAMPTZ,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contact_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read contact_reminders"
  ON contact_reminders FOR SELECT
  USING (true);

CREATE POLICY "Users can insert contact_reminders"
  ON contact_reminders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update contact_reminders"
  ON contact_reminders FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete contact_reminders"
  ON contact_reminders FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_contact_reminders_person ON contact_reminders(person_id);
CREATE INDEX IF NOT EXISTS idx_contact_reminders_next ON contact_reminders(next_expected_date) WHERE active = true;

COMMIT;
