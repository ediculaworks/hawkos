// Módulos do sistema
export const MODULES = [
  'finances',
  'health',
  'people',
  'career',
  'objectives',
  'knowledge',
  'routine',
  'assets',
  'entertainment',
  'legal',
  'social',
  'spirituality',
  'housing',
  'security',
  'calendar',
  'journal',
] as const;

export type ModuleId = (typeof MODULES)[number];

// Thresholds de alerta (configuráveis via profile.metadata no futuro)
export const ALERT_THRESHOLDS = {
  monthlySpendingLimit: 4000,
  cannabisMonthlyLimit: 500,
  lowBalanceThreshold: 500,
  debtDueSoonDays: 7,
  noExerciseDays: 14,
  lowSleepHours: 6,
  lowSleepConsecutiveDays: 3,
} as const;

// Modelo AI padrão (via OpenRouter)
export const AI_MODEL = process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.6-plus:free';
