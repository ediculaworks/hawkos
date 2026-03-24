// Types: Career / Carreira

export type WorkspaceType = 'employment' | 'company' | 'freelance';
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  active: boolean;
  hourly_rate: number | null;
  monthly_income: number | null;
  metadata: Record<string, unknown>;
};

export type Project = {
  id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  github_repo: string | null;
  metadata: Record<string, unknown>;
};

export type WorkLog = {
  id: string;
  workspace_id: string | null;
  project_id: string | null;
  date: string;
  duration_minutes: number;
  description: string | null;
  billable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WorkSummary = {
  workspace: Workspace;
  total_minutes_week: number;
  total_minutes_month: number;
  total_hours_week: number;
  total_hours_month: number;
  logs: WorkLog[];
};

export type CreateWorkspaceInput = {
  name: string;
  type: WorkspaceType;
  hourly_rate?: number;
  monthly_income?: number;
  metadata?: Record<string, unknown>;
};

export type CreateProjectInput = {
  name: string;
  workspace_id?: string;
  description?: string;
  priority?: number;
  github_repo?: string;
  start_date?: string;
};

export type CareerTemplate = {
  id: string;
  label: string;
  description: string;
  icon: string;
  workspaces: Array<{
    name: string;
    type: WorkspaceType;
    hourly_rate?: number;
    monthly_income?: number;
  }>;
  projects: Array<{
    name: string;
    workspace_name: string;
    description?: string;
    priority?: number;
  }>;
  integrations: string[];
};

export type LogWorkInput = {
  workspace_name: string;
  duration_minutes: number;
  project_name?: string;
  description?: string;
  date?: string;
  billable?: boolean;
};
