import { db } from '@hawk/db';
import { HawkError, ValidationError, createLogger } from '@hawk/shared';
import { z } from 'zod';

const CreateNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});
import type {
  Book,
  BookStatus,
  CreateBookInput,
  CreateNoteInput,
  KnowledgeCollection,
  KnowledgeNote,
  KnowledgeStats,
  NoteRelation,
  UpdateNoteInput,
} from './types';

const logger = createLogger('knowledge');

export async function createNote(input: CreateNoteInput): Promise<KnowledgeNote> {
  const parsed = CreateNoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    );
  }
  // Se tem URL, extrair tags do conteúdo automaticamente
  const inlineTags = input.content ? extractTagsFromContent(input.content) : [];
  const allTags = [...new Set([...(input.tags ?? []), ...inlineTags])];

  const { data, error } = await db
    .from('knowledge_notes')
    .insert({
      content: input.content,
      title: input.title ?? null,
      type: input.url ? 'bookmark' : (input.type ?? 'note'),
      source: input.source ?? input.url ?? null,
      url: input.url ?? null,
      tags: allTags,
      module: input.module ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create note');
    throw new HawkError(`Failed to create note: ${error.message}`, 'DB_INSERT_FAILED');
  }

  // Enfileirar para processamento assíncrono se for bookmark com auto_tag
  if (input.url && input.auto_tag !== false) {
    // biome-ignore lint/suspicious/noExplicitAny: knowledge_processing_queue not in generated types
    await (db as any)
      .from('knowledge_processing_queue')
      .insert({
        note_id: (data as KnowledgeNote).id,
        tasks: ['summarize', 'auto_tag'],
      })
      .throwOnError();
  }

  return data as KnowledgeNote;
}

/**
 * Parseia #tags inline do conteúdo (Memos pattern)
 */
export function extractTagsFromContent(content: string): string[] {
  const tagPattern = /#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)/g;
  const matches = content.matchAll(tagPattern);
  return [...new Set([...matches].map((m) => m[1]?.toLowerCase()).filter(Boolean) as string[])];
}

/**
 * Verifica duplicata por checksum SHA256 (Paperless/Hoarder pattern)
 */
export async function findNoteByChecksum(checksum: string): Promise<KnowledgeNote | null> {
  const { data } = await db
    .from('knowledge_notes')
    .select('id, title, url, created_at')
    .eq('checksum', checksum)
    .maybeSingle();
  return data as KnowledgeNote | null;
}

/**
 * Busca full-text avançada: título + conteúdo + summary
 */
export async function searchKnowledge(
  query: string,
  limit = 20,
  opts?: { type?: string; starred?: boolean; unread?: boolean },
): Promise<KnowledgeNote[]> {
  let q = db
    .from('knowledge_notes')
    .select('id, title, url, summary, tags, type, is_read, is_starred, created_at')
    .textSearch('title, content', query, { type: 'websearch', config: 'portuguese' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.type) q = q.eq('type', opts.type);
  if (opts?.starred) q = q.eq('is_starred', true);
  if (opts?.unread) q = q.eq('is_read', false);

  const { data, error } = await q;
  if (error) {
    logger.error({ error: error.message }, 'Failed to search knowledge');
    throw new HawkError(`Failed to search knowledge: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as KnowledgeNote[];
}

/**
 * Marca nota como lida
 */
export async function markNoteRead(id: string): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: is_read not in generated types
  await (db as any).from('knowledge_notes').update({ is_read: true }).eq('id', id).throwOnError();
}

/**
 * Toggle starred
 */
export async function toggleNoteStarred(id: string, starred: boolean): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: is_starred not in generated types
  await (db as any)
    .from('knowledge_notes')
    .update({ is_starred: starred })
    .eq('id', id)
    .throwOnError();
}

/**
 * Notas não lidas (reading queue)
 */
export async function listUnreadNotes(limit = 20): Promise<KnowledgeNote[]> {
  const { data, error } = await db
    .from('knowledge_notes')
    .select('id, title, url, summary, tags, type, reading_time_minutes, created_at')
    .eq('is_read', false)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to list unread notes');
    throw new HawkError(`Failed to list unread notes: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as KnowledgeNote[];
}

// ============================================================
// COLLECTIONS
// ============================================================

export async function listCollections(parentId?: string | null): Promise<KnowledgeCollection[]> {
  // biome-ignore lint/suspicious/noExplicitAny: knowledge_collections not in generated types
  let q = (db as any)
    .from('knowledge_collections')
    .select('*')
    .order('sort_order', { ascending: true });

  if (parentId === null) {
    q = q.is('parent_id', null); // raiz
  } else if (parentId) {
    q = q.eq('parent_id', parentId);
  }

  const { data, error } = await q;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list collections');
    throw new HawkError(`Failed to list collections: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as KnowledgeCollection[];
}

export async function addNoteToCollection(noteId: string, collectionId: string): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: knowledge_note_collections not in generated types
  await (db as any)
    .from('knowledge_note_collections')
    .upsert({ note_id: noteId, collection_id: collectionId })
    .throwOnError();
}

export async function listNotesInCollection(
  collectionId: string,
  limit = 50,
): Promise<KnowledgeNote[]> {
  // biome-ignore lint/suspicious/noExplicitAny: knowledge_note_collections not in generated types
  const { data, error } = await (db as any)
    .from('knowledge_note_collections')
    .select('knowledge_notes(*)')
    .eq('collection_id', collectionId)
    .limit(limit);
  if (error) {
    logger.error({ error: error.message }, 'Failed to list notes in collection');
    throw new HawkError(`Failed to list notes in collection: ${error.message}`, 'DB_QUERY_FAILED');
  }
  // biome-ignore lint/suspicious/noExplicitAny: knowledge_note_collections returns untyped join
  return (data ?? []).map((r: any) => r.knowledge_notes) as KnowledgeNote[];
}

// ============================================================
// BACKLINKS (Memos pattern)
// ============================================================

export async function getBacklinks(
  targetId: string,
  targetType: NoteRelation['target_type'],
): Promise<NoteRelation[]> {
  // biome-ignore lint/suspicious/noExplicitAny: note_relations not in generated types
  const { data, error } = await (db as any)
    .from('note_relations')
    .select('*')
    .eq('target_id', targetId)
    .eq('target_type', targetType);
  if (error) {
    logger.error({ error: error.message }, 'Failed to get backlinks');
    throw new HawkError(`Failed to get backlinks: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as unknown as NoteRelation[];
}

export async function createNoteRelation(
  sourceId: string,
  sourceType: NoteRelation['source_type'],
  targetId: string,
  targetType: NoteRelation['target_type'],
  relationType = 'reference',
): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: note_relations not in generated types
  await (db as any)
    .from('note_relations')
    .upsert({
      source_id: sourceId,
      source_type: sourceType,
      target_id: targetId,
      target_type: targetType,
      relation_type: relationType,
    })
    .throwOnError();
}

/**
 * Busca full-text em notas (português)
 */
export async function searchNotes(query: string, limit = 10): Promise<KnowledgeNote[]> {
  const { data, error } = await db
    .from('knowledge_notes')
    .select('*')
    .textSearch('content', query, { type: 'plain', config: 'portuguese' })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search notes');
    throw new HawkError(`Failed to search notes: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as KnowledgeNote[];
}

export async function listRecentNotes(limit = 10, type?: string): Promise<KnowledgeNote[]> {
  let query = db
    .from('knowledge_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list notes');
    throw new HawkError(`Failed to list notes: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as KnowledgeNote[];
}

export async function createBook(input: CreateBookInput): Promise<Book> {
  const { data, error } = await db
    .from('books')
    .insert({
      title: input.title,
      author: input.author ?? null,
      status: input.status ?? 'want_to_read',
    })
    .select()
    .single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to create book');
    throw new HawkError(`Failed to create book: ${error.message}`, 'DB_INSERT_FAILED');
  }
  return data as Book;
}

export async function findBookByTitle(title: string): Promise<Book | null> {
  const { data, error } = await db
    .from('books')
    .select('*')
    .ilike('title', `%${title}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error: error.message }, 'Failed to find book');
    throw new HawkError(`Failed to find book: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return data as Book | null;
}

export async function updateBookStatus(
  id: string,
  status: BookStatus,
  notes?: string,
): Promise<Book> {
  const updates: Record<string, unknown> = { status };
  if (status === 'reading') updates.started_at = new Date().toISOString().split('T')[0];
  if (status === 'completed') updates.finished_at = new Date().toISOString().split('T')[0];
  if (notes) updates.notes = notes;

  const { data, error } = await db.from('books').update(updates).eq('id', id).select().single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update book');
    throw new HawkError(`Failed to update book: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Book;
}

export async function listBooks(status?: BookStatus): Promise<Book[]> {
  let query = db.from('books').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    logger.error({ error: error.message }, 'Failed to list books');
    throw new HawkError(`Failed to list books: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Book[];
}

export async function searchBooks(query: string, limit = 5): Promise<Book[]> {
  const { data, error } = await db
    .from('books')
    .select('*')
    .or(`title.ilike.%${query}%,author.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to search books');
    throw new HawkError(`Failed to search books: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as Book[];
}

export async function listNotesByModule(module: string, limit = 20): Promise<KnowledgeNote[]> {
  const { data, error } = await db
    .from('knowledge_notes')
    .select('*')
    .eq('module', module)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error: error.message }, 'Failed to list notes by module');
    throw new HawkError(`Failed to list notes by module: ${error.message}`, 'DB_QUERY_FAILED');
  }
  return (data ?? []) as KnowledgeNote[];
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString();

  // Use count queries instead of loading all records into memory
  const [
    { count: totalNotes },
    { data: noteTypes },
    { count: notesThisWeek },
    { data: bookStatuses },
    { count: currentlyReading },
  ] = await Promise.all([
    db.from('knowledge_notes').select('id', { count: 'exact', head: true }),
    db.from('knowledge_notes').select('type').limit(10000),
    db
      .from('knowledge_notes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekStr),
    db.from('books').select('status').limit(5000),
    db.from('books').select('id', { count: 'exact', head: true }).eq('status', 'reading'),
  ]);

  const notes_by_type: Record<string, number> = {};
  for (const n of noteTypes ?? []) {
    const t = (n.type as string) ?? 'note';
    notes_by_type[t] = (notes_by_type[t] ?? 0) + 1;
  }

  const books_by_status: Record<string, number> = {};
  for (const b of bookStatuses ?? []) {
    const s = (b.status as string) ?? 'want_to_read';
    books_by_status[s] = (books_by_status[s] ?? 0) + 1;
  }

  return {
    total_notes: totalNotes ?? 0,
    notes_by_type,
    books_by_status,
    notes_this_week: notesThisWeek ?? 0,
    currently_reading: currentlyReading ?? 0,
  };
}

export async function updateBookRating(id: string, rating: number): Promise<Book> {
  const { data, error } = await db.from('books').update({ rating }).eq('id', id).select().single();

  if (error) {
    logger.error({ error: error.message }, 'Failed to update book rating');
    throw new HawkError(`Failed to update book rating: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as Book;
}

export async function updateNote(id: string, input: UpdateNoteInput): Promise<KnowledgeNote> {
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.note_type !== undefined) updates.type = input.note_type;

  const { data, error } = await db
    .from('knowledge_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ error: error.message }, 'Failed to update note');
    throw new HawkError(`Failed to update note: ${error.message}`, 'DB_UPDATE_FAILED');
  }
  return data as KnowledgeNote;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await db.from('knowledge_notes').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete note');
    throw new HawkError(`Failed to delete note: ${error.message}`, 'DB_DELETE_FAILED');
  }
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await db.from('books').delete().eq('id', id);
  if (error) {
    logger.error({ error: error.message }, 'Failed to delete book');
    throw new HawkError(`Failed to delete book: ${error.message}`, 'DB_DELETE_FAILED');
  }
}
