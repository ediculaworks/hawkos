// Module: Journal
// Diário pessoal com mood tracking, tipos de entrada e context engine

export type {
  JournalEntry,
  JournalEntryType,
  JournalMetadata,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalStats,
} from './types';

export {
  upsertJournalEntry,
  getTodayEntry,
  getEntryByDate,
  listRecentEntries,
  listEntriesByPeriod,
  updateJournalEntry,
  getJournalStats,
} from './queries';

export { diarioCommand, handleDiario } from './commands';

export { loadL0, loadL1, loadL2 } from './context';
