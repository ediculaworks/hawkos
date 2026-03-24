-- Migration: Health / Saúde
-- Módulo: health
-- Arquitetura: 2 camadas
--   Camada 1: health_observations (FHIR-inspired, universal, wearable-ready)
--   Camada 2: entidades estruturadas (sleep, workout, nutrition, body, lab, substance, meds, conditions)
-- Wearable-ready: campo source + external_id + raw_payload em todas as tabelas de dados passivos

-- ─────────────────────────────────────────────
-- CAMADA 1: Observações universais (FHIR Observation-inspired)
-- Landing zone para qualquer métrica: manual ou wearable
-- ─────────────────────────────────────────────

CREATE TABLE health_observations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identificação da observação (LOINC-compatible codes)
  code          TEXT NOT NULL,     -- 'body-weight', 'heart-rate', 'steps', 'sleep-duration', 'blood-glucose'
  display       TEXT NOT NULL,     -- 'Peso corporal', 'Frequência cardíaca'
  category      TEXT NOT NULL,     -- 'vital-signs' | 'activity' | 'laboratory' | 'survey' | 'substance'

  -- Valor (apenas um campo preenchido por observação)
  value_number  DECIMAL(12,4),
  value_text    TEXT,
  value_bool    BOOLEAN,
  unit          TEXT,              -- UCUM units: kg, bpm, h, kcal, /d, %, mmHg

  -- Origem dos dados
  source        TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'garmin', 'oura', 'withings', 'apple_health', 'fitbit', 'import')),
  external_id   TEXT,              -- ID no sistema do wearable (para deduplicação)
  raw_payload   JSONB,             -- Payload original do dispositivo

  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE (source, external_id)    -- previne duplicatas de sync
);

CREATE INDEX idx_health_obs_code_time   ON health_observations (code, observed_at DESC);
CREATE INDEX idx_health_obs_category    ON health_observations (category, observed_at DESC);
CREATE INDEX idx_health_obs_source      ON health_observations (source, observed_at DESC);
CREATE INDEX idx_health_obs_date        ON health_observations (observed_at DESC);

-- ─────────────────────────────────────────────
-- CAMADA 2: Entidades estruturadas
-- ─────────────────────────────────────────────

-- Sono
CREATE TABLE sleep_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_start     TIMESTAMPTZ,
  sleep_end       TIMESTAMPTZ,
  duration_h      DECIMAL(4,2),       -- horas (calculado ou manual)
  quality         INTEGER CHECK (quality BETWEEN 1 AND 10),
  deep_pct        DECIMAL(5,2),       -- % sono profundo (wearable)
  rem_pct         DECIMAL(5,2),       -- % REM (wearable)
  light_pct       DECIMAL(5,2),       -- % sono leve (wearable)
  interruptions   INTEGER DEFAULT 0,
  hr_avg          INTEGER,            -- FC média noturna (wearable)
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'garmin', 'oura', 'withings', 'apple_health', 'fitbit', 'import')),
  external_id     TEXT,
  raw_payload     JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, source)               -- uma sessão por noite por fonte
);

CREATE INDEX idx_sleep_date ON sleep_sessions (date DESC);

-- Treinos
CREATE TABLE workout_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  type          TEXT NOT NULL
                CHECK (type IN ('musculacao', 'corrida', 'ciclismo', 'natacao', 'caminhada', 'skate', 'futebol', 'outro')),
  duration_m    INTEGER,             -- minutos
  calories      INTEGER,             -- kcal (wearable)
  avg_hr        INTEGER,             -- bpm (wearable)
  max_hr        INTEGER,             -- bpm (wearable)
  distance_km   DECIMAL(8,3),        -- para corrida/ciclismo (wearable)
  source        TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'garmin', 'oura', 'withings', 'apple_health', 'fitbit', 'strava', 'import')),
  external_id   TEXT,
  raw_payload   JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX idx_workout_date ON workout_sessions (date DESC);
CREATE INDEX idx_workout_type ON workout_sessions (type);

-- Séries de musculação (detalhe do treino)
CREATE TABLE workout_sets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id      UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name   TEXT NOT NULL,       -- 'Supino', 'Agachamento', 'Barra fixa'
  set_number      INTEGER NOT NULL,
  reps            INTEGER,
  weight_kg       DECIMAL(6,2),
  duration_s      INTEGER,             -- para isometria (prancha, etc.)
  rpe             INTEGER CHECK (rpe BETWEEN 1 AND 10), -- Rating of Perceived Exertion
  notes           TEXT
);

CREATE INDEX idx_workout_sets_workout ON workout_sets (workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets (exercise_name);

-- Nutrição
CREATE TABLE nutrition_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_type     TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  description   TEXT NOT NULL,
  calories      INTEGER,
  protein_g     DECIMAL(7,2),
  carbs_g       DECIMAL(7,2),
  fat_g         DECIMAL(7,2),
  fiber_g       DECIMAL(7,2),
  source        TEXT NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'cronometer', 'myfitnesspal', 'import')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nutrition_date ON nutrition_logs (logged_at DESC);

-- Medidas corporais
CREATE TABLE body_measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg       DECIMAL(5,2),
  height_cm       DECIMAL(5,2),
  body_fat_pct    DECIMAL(5,2),
  muscle_mass_kg  DECIMAL(6,2),
  waist_cm        DECIMAL(5,2),
  hip_cm          DECIMAL(5,2),
  chest_cm        DECIMAL(5,2),
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'withings', 'garmin', 'import')),
  external_id     TEXT,
  raw_payload     JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_body_date ON body_measurements (measured_at DESC);

-- Exames laboratoriais
CREATE TABLE lab_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_at    DATE NOT NULL,
  name            TEXT NOT NULL,         -- 'Hemograma', 'TSH', 'Testosterona Total', 'HbA1c'
  value_number    DECIMAL(12,4),
  value_text      TEXT,
  unit            TEXT,                  -- 'mg/dL', 'mU/L', 'ng/dL', '%'
  reference_min   DECIMAL(12,4),
  reference_max   DECIMAL(12,4),
  status          TEXT                   -- 'normal' | 'elevated' | 'low' | 'critical'
                  CHECK (status IN ('normal', 'elevated', 'low', 'critical', 'unknown')),
  lab_name        TEXT,
  exam_type       TEXT,                  -- 'blood' | 'urine' | 'imaging' | 'other'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lab_date     ON lab_results (collected_at DESC);
CREATE INDEX idx_lab_name     ON lab_results (name);

-- Substâncias (tracking com integração implícita com finanças)
CREATE TABLE substance_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  substance     TEXT NOT NULL
                CHECK (substance IN ('cannabis', 'tobacco', 'alcohol', 'caffeine', 'other')),
  quantity      DECIMAL(8,3),
  unit          TEXT,                    -- 'g', 'cigarettes', 'ml', 'doses', 'cups'
  cost_brl      DECIMAL(8,2),            -- custo (pode integrar com finances)
  route         TEXT                     -- 'smoked', 'oral', 'vaporized', 'insufflated'
                CHECK (route IN ('smoked', 'oral', 'vaporized', 'insufflated', 'other')),
  context       TEXT,                    -- 'social', 'solo', 'work', 'anxiety', 'sleep'
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_substance_date      ON substance_logs (logged_at DESC);
CREATE INDEX idx_substance_type      ON substance_logs (substance, logged_at DESC);

-- Medicamentos
CREATE TABLE medications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,           -- 'Venvanse 50mg', 'Ritalina LA 20mg'
  active_ingredient TEXT,                -- 'Lisdexanfetamina', 'Metilfenidato'
  dosage        TEXT,                    -- '50mg', '20mg'
  frequency     TEXT NOT NULL
                CHECK (frequency IN ('daily', 'twice_daily', 'three_times_daily', 'as_needed', 'weekly', 'other')),
  route         TEXT DEFAULT 'oral'
                CHECK (route IN ('oral', 'sublingual', 'topical', 'inhaled', 'injected', 'other')),
  indication    TEXT,                    -- 'TDAH', 'ansiedade', 'dor crônica'
  start_date    DATE,
  end_date      DATE,
  active        BOOLEAN DEFAULT true,
  prescriber    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_medications_active ON medications (active) WHERE active = true;

-- Logs de aderência
CREATE TABLE medication_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  taken           BOOLEAN NOT NULL DEFAULT true,
  taken_at        TIMESTAMPTZ,
  dose_actual     TEXT,                  -- se diferente da dose padrão
  skipped_reason  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_med_logs_medication ON medication_logs (medication_id, scheduled_at DESC);
CREATE INDEX idx_med_logs_date       ON medication_logs (scheduled_at DESC);

-- Condições e comorbidades
CREATE TABLE conditions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,         -- 'TDAH', 'Miopia', 'Lombalgia'
  icd10_code          TEXT,                  -- 'F90.0', 'H52.1', 'M54.5'
  category            TEXT,                  -- 'mental', 'neurological', 'musculoskeletal', 'sensory'
  diagnosed_at        DATE,
  status              TEXT DEFAULT 'active'
                      CHECK (status IN ('active', 'managed', 'resolved', 'suspected')),
  treating_professional TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TRIGGERS: alimentar health_observations a partir das entidades
-- ─────────────────────────────────────────────

-- Peso → observation
CREATE OR REPLACE FUNCTION sync_body_weight_observation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL THEN
    INSERT INTO health_observations (observed_at, code, display, category, value_number, unit, source, external_id)
    VALUES (NEW.measured_at, 'body-weight', 'Peso corporal', 'vital-signs', NEW.weight_kg, 'kg', NEW.source, NEW.external_id)
    ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER body_measurement_sync_weight
  AFTER INSERT ON body_measurements
  FOR EACH ROW EXECUTE FUNCTION sync_body_weight_observation();

-- Duração do sono → observation
CREATE OR REPLACE FUNCTION sync_sleep_observation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.duration_h IS NOT NULL THEN
    INSERT INTO health_observations (observed_at, code, display, category, value_number, unit, source, external_id)
    VALUES (
      COALESCE(NEW.sleep_end, (NEW.date + INTERVAL '7 hours')::TIMESTAMPTZ),
      'sleep-duration', 'Duração do sono', 'activity',
      NEW.duration_h, 'h', NEW.source, NEW.external_id
    )
    ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sleep_session_sync_obs
  AFTER INSERT ON sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_sleep_observation();

-- ─────────────────────────────────────────────
-- VIEW: resumo diário de saúde (correlações cross-module)
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_health_summary AS
SELECT
  d::DATE                                                          AS date,

  -- Sono
  sl.duration_h                                                    AS sleep_hours,
  sl.quality                                                       AS sleep_quality,

  -- Corpo
  bm.weight_kg                                                     AS weight_kg,

  -- Treino
  (SELECT COUNT(*) > 0 FROM workout_sessions w WHERE w.date = d::DATE)  AS exercised,
  (SELECT type FROM workout_sessions w WHERE w.date = d::DATE LIMIT 1)  AS workout_type,
  (SELECT SUM(duration_m) FROM workout_sessions w WHERE w.date = d::DATE) AS workout_min,

  -- Nutrição
  (SELECT SUM(calories) FROM nutrition_logs n WHERE n.logged_at::DATE = d::DATE) AS calories_total,

  -- Substâncias
  (SELECT SUM(quantity) FROM substance_logs s
   WHERE s.logged_at::DATE = d::DATE AND s.substance = 'cannabis')      AS cannabis_g,
  (SELECT SUM(quantity) FROM substance_logs s
   WHERE s.logged_at::DATE = d::DATE AND s.substance = 'tobacco')       AS tobacco_qty,
  (SELECT SUM(cost_brl) FROM substance_logs s
   WHERE s.logged_at::DATE = d::DATE)                                   AS substance_cost,

  -- Medicações (aderência)
  (SELECT COUNT(*) FROM medication_logs ml
   WHERE ml.scheduled_at::DATE = d::DATE AND ml.taken = true)          AS meds_taken,
  (SELECT COUNT(*) FROM medication_logs ml
   WHERE ml.scheduled_at::DATE = d::DATE AND ml.taken = false)         AS meds_skipped,

  -- Humor/energia (do módulo journal)
  je.mood                                                          AS mood,
  je.energy                                                        AS energy

FROM generate_series(
  GREATEST(
    (SELECT MIN(date) FROM sleep_sessions),
    (SELECT MIN(logged_at::DATE) FROM substance_logs),
    CURRENT_DATE - INTERVAL '90 days'
  ),
  CURRENT_DATE,
  '1 day'::INTERVAL
) AS d
LEFT JOIN sleep_sessions sl         ON sl.date = d::DATE
LEFT JOIN LATERAL (
  SELECT weight_kg FROM body_measurements
  WHERE measured_at::DATE <= d::DATE
  ORDER BY measured_at DESC LIMIT 1
) bm ON true
LEFT JOIN journal_entries je        ON je.date = d::DATE AND je.type = 'daily';

-- ─────────────────────────────────────────────
-- Habilitar módulo health
-- ─────────────────────────────────────────────

UPDATE modules SET enabled = true WHERE id = 'health';
