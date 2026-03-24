// Types: Demands — sistema de execução multi-agent

export type DemandStatus =
  | 'draft'
  | 'triaging'
  | 'planned'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DemandPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DemandOrigin = 'chat' | 'web' | 'automation' | 'agent';

export type StepExecutionType = 'sequential' | 'parallel' | 'conditional' | 'checkpoint';

export type StepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_human'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type LogType =
  | 'info'
  | 'agent_action'
  | 'agent_comms'
  | 'tool_call'
  | 'error'
  | 'retry'
  | 'checkpoint'
  | 'human_input'
  | 'status_change';

export type ArtifactType = 'text' | 'data' | 'file' | 'task' | 'memory' | 'note';

// --- Entities ---

export type Demand = {
  id: string;
  title: string;
  description: string | null;
  status: DemandStatus;
  priority: DemandPriority;
  module: string | null;
  tags: string[];
  progress: number;
  total_steps: number;
  completed_steps: number;
  orchestrator_agent_id: string | null;
  objective_id: string | null;
  origin: DemandOrigin;
  origin_session_id: string | null;
  origin_message: string | null;
  scheduled_at: string | null;
  deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  triage_result: TriageResult | Record<string, never>;
  execution_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DemandStep = {
  id: string;
  demand_id: string;
  title: string;
  description: string | null;
  step_order: number;
  execution_type: StepExecutionType;
  condition_rule: ConditionRule | null;
  status: StepStatus;
  assigned_agent_id: string | null;
  depends_on: string[];
  tool_name: string | null;
  tool_args: Record<string, unknown>;
  result: string | null;
  result_metadata: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  estimated_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type DemandLog = {
  id: string;
  demand_id: string;
  step_id: string | null;
  log_type: LogType;
  agent_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DemandArtifact = {
  id: string;
  demand_id: string;
  step_id: string | null;
  artifact_type: ArtifactType;
  title: string;
  content: string | null;
  reference_id: string | null;
  reference_table: string | null;
  file_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// --- Composite ---

export type DemandWithSteps = Demand & { steps: DemandStep[] };
export type DemandFull = DemandWithSteps & { logs: DemandLog[]; artifacts: DemandArtifact[] };

// --- DTOs ---

export type CreateDemandInput = {
  title: string;
  description?: string;
  priority?: DemandPriority;
  module?: string;
  objective_id?: string;
  origin?: DemandOrigin;
  origin_session_id?: string;
  origin_message?: string;
  deadline?: string;
};

export type UpdateDemandInput = Partial<
  Pick<
    Demand,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'progress'
    | 'completed_steps'
    | 'total_steps'
    | 'execution_summary'
    | 'started_at'
    | 'completed_at'
    | 'triage_result'
    | 'metadata'
  >
>;

export type CreateStepInput = {
  title: string;
  description?: string;
  step_order: number;
  execution_type?: StepExecutionType;
  condition_rule?: ConditionRule;
  assigned_agent_id?: string;
  depends_on?: string[];
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  estimated_duration_minutes?: number;
};

export type UpdateStepInput = Partial<
  Pick<
    DemandStep,
    | 'status'
    | 'result'
    | 'result_metadata'
    | 'error_message'
    | 'retry_count'
    | 'started_at'
    | 'completed_at'
  >
>;

export type CreateLogInput = {
  log_type: LogType;
  agent_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type CreateArtifactInput = {
  artifact_type: ArtifactType;
  title: string;
  content?: string;
  reference_id?: string;
  reference_table?: string;
  file_url?: string;
  metadata?: Record<string, unknown>;
};

// --- Triage ---

export type ConditionRule = {
  if_step: string;
  status: 'completed' | 'failed';
  then: 'run' | 'skip';
};

export type TriageResult = {
  analysis: string;
  estimated_complexity: 'simple' | 'medium' | 'complex';
  estimated_duration_hours: number;
  suggested_agents: string[];
  steps: TriageStep[];
  requires_approval: boolean;
};

export type TriageStep = {
  title: string;
  description: string;
  execution_type: StepExecutionType;
  assigned_agent_name: string;
  depends_on_indices: number[];
  tool_hint?: string;
  estimated_minutes?: number;
};
