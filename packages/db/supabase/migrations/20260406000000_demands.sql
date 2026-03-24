-- Demands: sistema de execução multi-agent para tarefas de longa duração
BEGIN;

-- ============================================================
-- DEMANDS: requests de alto nível do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- criada, aguardando triage
    'triaging',     -- Hawk analisando e decompondo
    'planned',      -- plano criado, aguardando aprovação
    'running',      -- execução em andamento
    'paused',       -- pausada pelo usuário ou checkpoint
    'completed',    -- todas as etapas concluídas
    'failed',       -- falha irrecuperável
    'cancelled'     -- cancelada pelo usuário
  )),

  -- Priority and categorization
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  module TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Execution tracking
  progress SMALLINT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_steps SMALLINT DEFAULT 0,
  completed_steps SMALLINT DEFAULT 0,

  -- Agent ownership
  orchestrator_agent_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL
    DEFAULT '00000000-0000-0000-0000-000000000001',

  -- Linkage to objectives
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,

  -- Origin tracking
  origin TEXT DEFAULT 'chat' CHECK (origin IN ('chat', 'web', 'automation', 'agent')),
  origin_session_id TEXT,
  origin_message TEXT,

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  triage_result JSONB DEFAULT '{}'::jsonb,
  execution_summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demands_status ON demands(status);
CREATE INDEX idx_demands_priority ON demands(priority, status);
CREATE INDEX idx_demands_module ON demands(module) WHERE module IS NOT NULL;
CREATE INDEX idx_demands_objective ON demands(objective_id) WHERE objective_id IS NOT NULL;
CREATE INDEX idx_demands_created ON demands(created_at DESC);

ALTER TABLE demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demands_public_read"
  ON demands FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "demands_service_write"
  ON demands FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER demands_updated_at
  BEFORE UPDATE ON demands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DEMAND_STEPS: etapas executáveis dentro de uma demand
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,

  -- Step definition
  title TEXT NOT NULL,
  description TEXT,
  step_order SMALLINT NOT NULL DEFAULT 0,

  -- Execution mode
  execution_type TEXT NOT NULL DEFAULT 'sequential' CHECK (execution_type IN (
    'sequential',
    'parallel',
    'conditional',
    'checkpoint'
  )),
  condition_rule JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'ready',
    'running',
    'waiting_human',
    'completed',
    'failed',
    'skipped',
    'cancelled'
  )),

  -- Agent assignment
  assigned_agent_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL,

  -- Dependencies
  depends_on UUID[] DEFAULT '{}',

  -- Tool execution
  tool_name TEXT,
  tool_args JSONB DEFAULT '{}'::jsonb,

  -- Results
  result TEXT,
  result_metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  retry_count SMALLINT DEFAULT 0,
  max_retries SMALLINT DEFAULT 2,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_duration_minutes INT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_steps_demand ON demand_steps(demand_id);
CREATE INDEX idx_demand_steps_status ON demand_steps(status);
CREATE INDEX idx_demand_steps_agent ON demand_steps(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX idx_demand_steps_order ON demand_steps(demand_id, step_order);

ALTER TABLE demand_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_steps_public_read"
  ON demand_steps FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "demand_steps_service_write"
  ON demand_steps FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER demand_steps_updated_at
  BEFORE UPDATE ON demand_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DEMAND_LOGS: feed de atividade e comunicação inter-agent
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  step_id UUID REFERENCES demand_steps(id) ON DELETE SET NULL,

  log_type TEXT NOT NULL DEFAULT 'info' CHECK (log_type IN (
    'info',
    'agent_action',
    'agent_comms',
    'tool_call',
    'error',
    'retry',
    'checkpoint',
    'human_input',
    'status_change'
  )),

  agent_id UUID REFERENCES agent_templates(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_logs_demand ON demand_logs(demand_id);
CREATE INDEX idx_demand_logs_step ON demand_logs(step_id) WHERE step_id IS NOT NULL;
CREATE INDEX idx_demand_logs_type ON demand_logs(demand_id, log_type);
CREATE INDEX idx_demand_logs_created ON demand_logs(created_at DESC);

ALTER TABLE demand_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_logs_public_read"
  ON demand_logs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "demand_logs_service_write"
  ON demand_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- DEMAND_ARTIFACTS: outputs produzidos pelas demands
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  step_id UUID REFERENCES demand_steps(id) ON DELETE SET NULL,

  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'text',
    'data',
    'file',
    'task',
    'memory',
    'note'
  )),

  title TEXT NOT NULL,
  content TEXT,
  reference_id UUID,
  reference_table TEXT,
  file_url TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_artifacts_demand ON demand_artifacts(demand_id);
CREATE INDEX idx_demand_artifacts_step ON demand_artifacts(step_id) WHERE step_id IS NOT NULL;

ALTER TABLE demand_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_artifacts_public_read"
  ON demand_artifacts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "demand_artifacts_service_write"
  ON demand_artifacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
