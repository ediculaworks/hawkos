// Types: Objectives + Tasks

export type ObjectiveTimeframe = 'short' | 'medium' | 'long';
export type ObjectiveStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type Objective = {
  id: string;
  title: string;
  description: string | null;
  timeframe: ObjectiveTimeframe;
  module: string | null;
  status: ObjectiveStatus;
  target_date: string | null; // YYYY-MM-DD
  progress: number; // 0-100
  parent_id: string | null;
  priority: number; // 1-10
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  objective_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null; // YYYY-MM-DD
  completed_at: string | null;
  module: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ObjectiveWithTasks = Objective & {
  tasks: Task[];
  open_tasks: number;
  done_tasks: number;
};

export type CreateObjectiveInput = {
  title: string;
  description?: string;
  timeframe: ObjectiveTimeframe;
  module?: string;
  target_date?: string;
  priority?: number;
  parent_id?: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  objective_id?: string;
  priority?: TaskPriority;
  due_date?: string;
  module?: string;
  tags?: string[];
};

export type UpdateObjectiveInput = {
  title?: string;
  progress?: number;
  status?: ObjectiveStatus;
  description?: string;
  target_date?: string;
  priority?: number;
  timeframe?: ObjectiveTimeframe;
};

export type UpdateTaskInput = {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  description?: string;
  tags?: string[];
};

// ── Plane-inspired Issue States & Cycles ──────────────────

export type IssueStateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export type IssueState = {
  id: string;
  objective_id: string | null;
  name: string;
  color: string;
  type: IssueStateType;
  position: number;
};

export type Cycle = {
  id: string;
  objective_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'current' | 'completed';
  velocity_estimate: number | null;
  velocity_actual: number | null;
  created_at: string;
};

export type CycleWithTasks = Cycle & {
  tasks: Task[];
  completed_count: number;
  total_count: number;
  completion_pct: number;
};
