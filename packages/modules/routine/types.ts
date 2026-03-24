// Types: Routine / Hábitos

export type HabitFrequency = 'daily' | 'weekly_2x' | 'weekly_3x' | 'weekdays';
export type HabitDifficulty = 'trivial' | 'easy' | 'medium' | 'hard';

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  target_days: number | null;
  module: string | null;
  icon: string | null;
  active: boolean;
  current_streak: number;
  best_streak: number;
  total_completions: number;
  // Habitica enhancements
  difficulty: HabitDifficulty;
  is_positive: boolean;
  streak_freeze_count: number;
  last_completed_date: string | null;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  notes: string | null;
  created_at: string;
};

export type HabitWithLog = Habit & {
  completed_today: boolean;
  log_today: HabitLog | null;
};

export type HabitWeekSummary = {
  habit: Habit;
  week_completions: number;
  week_target: number;
  completion_rate: number; // 0-100
  logs: HabitLog[];
};

export type LogHabitInput = {
  habit_id: string;
  date?: string; // YYYY-MM-DD, default hoje
  completed?: boolean; // default true
  notes?: string;
};

export type CreateHabitInput = {
  name: string;
  description?: string;
  frequency: HabitFrequency;
  target_days?: number;
  module?: string;
  icon?: string;
  difficulty?: HabitDifficulty;
  is_positive?: boolean;
};

export type UpdateHabitInput = {
  name?: string;
  description?: string;
  frequency?: HabitFrequency;
  target_days?: number;
  icon?: string;
};

// ── Streak Engine (Habitica pattern) ───────────────────────

export type HabitScore = {
  score: number; // 0-100
  completed_30d: number;
  expected_30d: number;
  completion_rate: number; // 0-100 com decimal
  trend: 'up' | 'down' | 'stable';
};

export type HabitAtRisk = {
  habit_id: string;
  habit_name: string;
  current_streak: number;
  last_completed_date: string;
  frequency: string;
  difficulty: HabitDifficulty;
};
