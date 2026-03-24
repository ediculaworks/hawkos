// Module: Knowledge / Second Brain
// Notas, insights, referências, livros com full-text search

export type {
  KnowledgeNote,
  Book,
  CreateNoteInput,
  CreateBookInput,
  UpdateNoteInput,
  NoteType,
  BookStatus,
} from './types';
export {
  createNote,
  searchNotes,
  searchKnowledge,
  listRecentNotes,
  createBook,
  findBookByTitle,
  updateBookStatus,
  listBooks,
  extractTagsFromContent,
  findNoteByChecksum,
  markNoteRead,
  toggleNoteStarred,
  listUnreadNotes,
  listCollections,
  addNoteToCollection,
  listNotesInCollection,
  getBacklinks,
  createNoteRelation,
  updateNote,
  deleteNote,
  deleteBook,
} from './queries';
export { notaCommand, livroCommand, handleNota, handleLivro } from './commands';
export { loadL0, loadL1, loadL2 } from './context';
