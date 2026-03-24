// Module: Routine
// Gestão de hábitos diários com streaks e automação de check-ins

export type {
  Habit,
  HabitLog,
  HabitWithLog,
  HabitWeekSummary,
  LogHabitInput,
  CreateHabitInput,
  UpdateHabitInput,
  HabitFrequency,
  HabitDifficulty,
  HabitScore,
  HabitAtRisk,
} from './types';

export {
  listHabitsWithTodayStatus,
  findHabitByName,
  logHabit,
  unlogHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  getWeekSummary,
  getHabitLogs,
  completeHabit,
  getHabitScore,
  getHabitsAtRisk,
  getWeeklyRoutineScore,
  addStreakFreeze,
} from './queries';

export { habitoCommand, handleHabito } from './commands';

export { loadL0, loadL1, loadL2 } from './context';
