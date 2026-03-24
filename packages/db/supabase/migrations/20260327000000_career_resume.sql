-- Career Module: Resumo Profissional, Currículo e LinkedIn
-- Tabelas: career_profiles, career_experiences, career_educations, career_skills, career_certifications

-- career_profiles: perfil principal do usuário (headline, resumo, links)
CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  headline TEXT,
  summary TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  location TEXT,
  phone TEXT,
  email TEXT,
  open_to_work BOOLEAN DEFAULT false,
  preferred_job_types TEXT[] DEFAULT '{}',
  salary_expectation NUMERIC(12, 2),
  target_industry TEXT,
  target_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id)
);

-- career_experiences: experiências profissionais vinculadas a workspaces existentes
CREATE TABLE IF NOT EXISTS career_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_url TEXT,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  achievements TEXT[] DEFAULT '{}',
  industry TEXT,
  employment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- career_educations: formação acadêmica
CREATE TABLE IF NOT EXISTS career_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  grade TEXT,
  activities TEXT[] DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- career_skills: habilidades com nível e categoria
CREATE TABLE IF NOT EXISTS career_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER CHECK (level BETWEEN 1 AND 5),
  category TEXT CHECK (category IN ('technical', 'soft', 'language', 'tool', 'domain')),
  years_experience INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, name)
);

-- career_certifications: certificações e cursos
CREATE TABLE IF NOT EXISTS career_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON career_profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON career_experiences FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON career_educations FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON career_skills FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON career_certifications FOR ALL TO authenticated USING (true);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS career_experiences_profile_id_idx ON career_experiences(profile_id);
CREATE INDEX IF NOT EXISTS career_experiences_start_date_idx ON career_experiences(start_date DESC);
CREATE INDEX IF NOT EXISTS career_educations_profile_id_idx ON career_educations(profile_id);
CREATE INDEX IF NOT EXISTS career_skills_profile_id_idx ON career_skills(profile_id);
CREATE INDEX IF NOT EXISTS career_skills_category_idx ON career_skills(category);
CREATE INDEX IF NOT EXISTS career_certifications_profile_id_idx ON career_certifications(profile_id);
