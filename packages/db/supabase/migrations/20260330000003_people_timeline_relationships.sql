-- Migration: People — Activity Timeline + Relationships
-- Referência: docs/repositorios/twenty.md
-- Tasks: I1.1.1–3
-- Nota: I1.1.4–6 (Monica) já feito em 20260328000000_monica_people.sql

BEGIN;

-- ============================================================
-- ACTIVITY TIMELINE UNIVERSAL (Twenty pattern)
-- ============================================================
-- Tabela polimórfica: registra qualquer ação sobre qualquer entidade
-- Entidades: person, company, deal, task, contract, etc.

CREATE TABLE IF NOT EXISTS entity_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person', 'company', 'deal', 'task', 'contract', 'asset', 'event', 'workspace'
  )),
  entity_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'note', 'interaction', 'task_created', 'task_completed',
    'meeting', 'call', 'email', 'message', 'status_change',
    'deal_stage', 'document_signed', 'reminder_triggered'
  )),
  title TEXT,
  body TEXT,
  author TEXT DEFAULT 'user',    -- quem fez (para multi-user futuro)
  metadata JSONB DEFAULT '{}',   -- dados extras específicos do activity_type
  occurred_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_activity_entity ON entity_activity_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_activity_type ON entity_activity_log(activity_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_activity_occurred ON entity_activity_log(occurred_at DESC);

ALTER TABLE entity_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage entity activity" ON entity_activity_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PEOPLE RELATIONSHIPS (Twenty pattern)
-- ============================================================

CREATE TABLE IF NOT EXISTS people_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_a UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'colleague', 'friend', 'mentor', 'mentee', 'family',
    'investor', 'partner', 'client', 'supplier', 'acquaintance', 'other'
  )),
  strength INT DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),  -- 1=fraco, 5=forte
  notes TEXT,
  since_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(person_a, person_b, relationship_type),
  CHECK (person_a <> person_b)  -- não pode ter relação consigo mesmo
);

CREATE INDEX IF NOT EXISTS idx_people_relationships_a ON people_relationships(person_a);
CREATE INDEX IF NOT EXISTS idx_people_relationships_b ON people_relationships(person_b);

ALTER TABLE people_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage people relationships" ON people_relationships FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- METADATA + CUSTOM FIELDS em PEOPLE (Twenty pattern)
-- ============================================================

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_schema JSONB DEFAULT '[]',  -- definição de campos customizados
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT CHECK (preferred_contact_method IN (
    'whatsapp', 'telegram', 'email', 'phone', 'instagram', 'linkedin', 'other'
  ));

-- Índice para busca por company/role (network profissional)
CREATE INDEX IF NOT EXISTS idx_people_company ON people(company) WHERE company IS NOT NULL;

-- ============================================================
-- COMPANIES (estrutura básica para o CRM)
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  website TEXT,
  linkedin_url TEXT,
  description TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain) WHERE domain IS NOT NULL;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage companies" ON companies FOR ALL USING (true) WITH CHECK (true);

-- Ligar people → company
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_people_company_id ON people(company_id) WHERE company_id IS NOT NULL;

-- Trigger updated_at em companies
CREATE OR REPLACE FUNCTION update_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_companies_updated_at();

COMMIT;
