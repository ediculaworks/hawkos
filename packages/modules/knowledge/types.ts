// Types: Knowledge / Second Brain

export type NoteType = 'note' | 'insight' | 'reference' | 'book_note' | 'quote' | 'bookmark';
export type BookStatus = 'want_to_read' | 'reading' | 'completed' | 'abandoned';

export type KnowledgeNote = {
  id: string;
  title: string | null;
  content: string;
  type: NoteType;
  source: string | null;
  url: string | null;
  summary: string | null;
  tags: string[];
  module: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  auto_tagged: boolean;
  reading_time_minutes: number | null;
  screenshot_url: string | null;
  author: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeCollection = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
};

export type NoteRelation = {
  id: string;
  source_id: string;
  source_type: 'knowledge' | 'journal' | 'book';
  target_id: string;
  target_type: 'knowledge' | 'journal' | 'book';
  relation_type: string;
  created_at: string;
};

export type Book = {
  id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  started_at: string | null;
  finished_at: string | null;
  rating: number | null; // 1-5
  notes: string | null;
  key_insights: string[];
  created_at: string;
};

export type CreateNoteInput = {
  content: string;
  title?: string;
  type?: NoteType;
  source?: string;
  url?: string;
  tags?: string[];
  module?: string;
  auto_tag?: boolean; // disparar auto-tagging via LLM após criar
};

export type KnowledgeStats = {
  total_notes: number;
  notes_by_type: Record<string, number>;
  books_by_status: Record<string, number>;
  notes_this_week: number;
  currently_reading: number;
};

export type CreateBookInput = {
  title: string;
  author?: string;
  status?: BookStatus;
};

export type UpdateNoteInput = {
  title?: string;
  content?: string;
  tags?: string[];
  note_type?: string;
};
