-- Migration: Career / Carreira
-- Módulo: career

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('employment', 'company', 'freelance')),
  active BOOLEAN DEFAULT true,
  hourly_rate DECIMAL(8,2),
  monthly_income DECIMAL(10,2),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  start_date DATE,
  end_date DATE,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  github_repo TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  description TEXT,
  billable BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_workspaces_active ON workspaces(active) WHERE active = true;
CREATE INDEX idx_projects_status ON projects(status) WHERE status = 'active';
CREATE INDEX idx_work_logs_date ON work_logs(date DESC);
CREATE INDEX idx_work_logs_workspace ON work_logs(workspace_id, date DESC);
