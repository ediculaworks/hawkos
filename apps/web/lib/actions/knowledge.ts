'use server';

import {
  createBook,
  createNote,
  deleteBook,
  deleteNote,
  getKnowledgeStats,
  listBooks,
  listNotesByModule,
  listRecentNotes,
  listUnreadNotes,
  markNoteRead,
  searchKnowledge,
  searchNotes,
  updateBookRating,
  updateBookStatus,
  updateNote,
} from '@hawk/module-knowledge/queries';
import type {
  Book,
  BookStatus,
  CreateBookInput,
  CreateNoteInput,
  KnowledgeNote,
  KnowledgeStats,
  UpdateNoteInput,
} from '@hawk/module-knowledge/types';
import { createMemory } from '@hawk/module-memory/queries';
import { withTenant } from '../supabase/with-tenant';

export async function fetchNotes(
  type?: string,
  module?: string,
  limit = 50,
): Promise<KnowledgeNote[]> {
  return withTenant(async () => {
    if (module) return listNotesByModule(module, limit);
    return listRecentNotes(limit, type);
  });
}

export async function fetchBooks(status?: BookStatus): Promise<Book[]> {
  return withTenant(async () => listBooks(status));
}

export async function fetchKnowledgeStats(): Promise<KnowledgeStats> {
  return withTenant(async () => getKnowledgeStats());
}

export async function searchNotesAction(query: string): Promise<KnowledgeNote[]> {
  return withTenant(async () => searchNotes(query, 20));
}

export async function addNote(input: CreateNoteInput): Promise<KnowledgeNote> {
  return withTenant(async () => createNote(input));
}

export async function addBook(input: CreateBookInput): Promise<Book> {
  return withTenant(async () => createBook(input));
}

export async function setBookStatus(id: string, status: BookStatus, notes?: string): Promise<Book> {
  return withTenant(async () => updateBookStatus(id, status, notes));
}

export async function setBookRating(id: string, rating: number): Promise<Book> {
  return withTenant(async () => updateBookRating(id, rating));
}

export async function quickSaveUrl(url: string, note?: string): Promise<KnowledgeNote> {
  return withTenant(async () =>
    createNote({
      content: note ?? url,
      url,
      type: 'bookmark',
      auto_tag: true,
    }),
  );
}

export async function fetchUnreadNotes(limit = 8): Promise<KnowledgeNote[]> {
  return withTenant(async () => listUnreadNotes(limit));
}

export async function fetchSearchResults(query: string): Promise<KnowledgeNote[]> {
  return withTenant(async () => {
    if (!query.trim()) return [];
    return searchKnowledge(query, 20);
  });
}

export async function markAsRead(id: string): Promise<void> {
  return withTenant(async () => markNoteRead(id));
}

export async function editNote(id: string, input: UpdateNoteInput): Promise<KnowledgeNote> {
  return withTenant(async () => updateNote(id, input));
}

export async function removeNote(id: string): Promise<void> {
  return withTenant(async () => deleteNote(id));
}

export async function removeBook(id: string): Promise<void> {
  return withTenant(async () => deleteBook(id));
}

export async function promoteNoteToMemory(note: KnowledgeNote): Promise<void> {
  return withTenant(async () => {
    const categoryMap: Record<string, string> = {
      insight: 'insight',
      note: 'fact',
      reference: 'fact',
      book_note: 'insight',
      quote: 'insight',
    };

    await createMemory({
      category: (categoryMap[note.type] ?? 'fact') as 'insight' | 'fact',
      content: note.title ? `${note.title}: ${note.content}` : note.content,
      module: note.module ?? 'knowledge',
      related_modules: note.module ? ['knowledge', note.module] : ['knowledge'],
      importance: note.type === 'insight' ? 7 : 5,
      status: 'active',
      tags: note.tags,
    });
  });
}
