// Types: Journal / Diário

export type JournalEntryType = 'daily' | 'reflection' | 'gratitude' | 'freeform' | 'weekly_review';

export type JournalEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  type: JournalEntryType;
  content: string;
  mood: number | null; // 1-10
  energy: number | null; // 1-10
  tags: string[];
  metadata: JournalMetadata;
  created_at: string;
  updated_at: string;
};

export type JournalMetadata = {
  highlight_of_day?: string;
  challenge_of_day?: string;
  top3?: string[]; // top 3 tarefas/intenções do dia
  gratitudes?: string[]; // lista de gratidões
  [key: string]: unknown;
};

export type CreateJournalEntryInput = {
  content: string;
  date?: string; // default hoje
  type?: JournalEntryType; // default 'daily'
  mood?: number;
  energy?: number;
  tags?: string[];
  metadata?: JournalMetadata;
};

export type UpdateJournalEntryInput = {
  content?: string;
  mood?: number;
  energy?: number;
  tags?: string[];
  metadata?: JournalMetadata;
};

export type JournalStats = {
  total_entries: number;
  avg_mood: number | null;
  avg_energy: number | null;
  entries_this_week: number;
  entries_this_month: number;
  current_streak: number; // dias consecutivos com entry
};
