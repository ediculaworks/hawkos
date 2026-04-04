'use client';

import { QuickSaveBar } from '@/components/knowledge/quick-save-bar';
import { ReadingQueue } from '@/components/knowledge/reading-queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EditSheet } from '@/components/ui/edit-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { MentionText } from '@/components/ui/mention-text';
import { RecordActions } from '@/components/ui/record-actions';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  editNote,
  fetchBooks,
  fetchKnowledgeStats,
  fetchNotes,
  promoteNoteToMemory,
  removeNote,
  searchNotesAction,
} from '@/lib/actions/knowledge';
import { fetchMemoryStats } from '@/lib/actions/memory';
import { MODULE_CONFIG } from '@/lib/modules';
import { cn } from '@/lib/utils/cn';
import type { KnowledgeNote, NoteType, UpdateNoteInput } from '@hawk/module-knowledge/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookMarked,
  BookOpen,
  Brain,
  FileText,
  Lightbulb,
  Link2,
  MessageSquareQuote,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

// ── Config ──────────────────────────────────────────────────────────────────

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: typeof FileText; label: string; color: string }> =
  {
    insight: { icon: Lightbulb, label: 'Insight', color: 'var(--color-warning)' },
    note: { icon: FileText, label: 'Nota', color: 'var(--color-text-secondary)' },
    reference: { icon: Link2, label: 'Referência', color: 'var(--color-accent)' },
    book_note: { icon: BookOpen, label: 'Livro', color: 'var(--color-mod-knowledge)' },
    quote: { icon: MessageSquareQuote, label: 'Citação', color: 'var(--color-accent)' },
    bookmark: { icon: BookMarked, label: 'Bookmark', color: 'var(--color-accent)' },
  };

const ALL_TYPES: NoteType[] = ['insight', 'note', 'reference', 'book_note', 'quote', 'bookmark'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByType(notes: KnowledgeNote[]): Map<NoteType, KnowledgeNote[]> {
  const map = new Map<NoteType, KnowledgeNote[]>();
  for (const note of notes) {
    const key = note.type;
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(note);
  }
  return map;
}

function getModuleLabel(moduleId: string | null): string | null {
  if (!moduleId) return null;
  return MODULE_CONFIG.find((m) => m.id === moduleId)?.label ?? moduleId;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onDelete,
  onPromote,
  isPromoting,
}: {
  note: KnowledgeNote;
  onEdit: (note: KnowledgeNote) => void;
  onDelete: (id: string) => void;
  onPromote: (note: KnowledgeNote) => void;
  isPromoting: boolean;
}) {
  const moduleLabel = getModuleLabel(note.module);

  return (
    <Card className="border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors group">
      <CardContent className="px-[var(--space-4)] py-[var(--space-3)] space-y-[var(--space-2)]">
        {/* Header row */}
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="min-w-0 flex-1">
            {note.title && (
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {note.title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-[var(--space-1)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onPromote(note)}
              disabled={isPromoting}
              title="Promover para memória"
              className="h-6 w-6 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            >
              <Brain className="h-3 w-3" />
            </Button>
            <RecordActions
              onEdit={() => onEdit(note)}
              onDelete={() => onDelete(note.id)}
              deleteConfirmLabel="Excluir nota?"
            />
          </div>
        </div>

        {/* Content preview */}
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">
          <MentionText text={note.content} />
        </p>

        {/* Footer row */}
        <div className="flex items-center gap-[var(--space-2)] flex-wrap">
          {/* Module badge */}
          {moduleLabel && (
            <span className="text-[10px] px-[var(--space-1-5)] py-px rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              {moduleLabel}
            </span>
          )}

          {/* Source */}
          {note.source && (
            <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[120px]">
              via {note.source}
            </span>
          )}

          {/* URL link */}
          {note.url && (
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--color-accent)] hover:underline truncate max-w-[160px]"
            >
              {note.url.replace(/^https?:\/\//, '').slice(0, 40)}
            </a>
          )}

          {/* Tags */}
          {note.tags.length > 0 && (
            <div className="flex items-center gap-[var(--space-1)] flex-wrap">
              {note.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="muted" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {note.tags.length > 4 && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  +{note.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EditNoteForm({
  note,
  onSave,
  isSaving,
}: {
  note: KnowledgeNote;
  onSave: (id: string, input: UpdateNoteInput) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(note.title ?? '');
  const [content, setContent] = useState(note.content);
  const [tagsStr, setTagsStr] = useState(note.tags.join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onSave(note.id, { title: title || undefined, content, tags });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-[var(--space-4)]">
      <div className="space-y-[var(--space-1-5)]">
        <label
          htmlFor="note-title"
          className="text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Título
        </label>
        <input
          id="note-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="space-y-[var(--space-1-5)]">
        <label
          htmlFor="note-content"
          className="text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Conteúdo
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Conteúdo da nota..."
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
        />
      </div>

      <div className="space-y-[var(--space-1-5)]">
        <label
          htmlFor="note-tags"
          className="text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Tags (separadas por vírgula)
        </label>
        <input
          id="note-tags"
          type="text"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          placeholder="ex: aprendizado, leitura, ideia"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <Button type="submit" size="sm" disabled={isSaving || !content.trim()} className="w-full">
        {isSaving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}

function StatsSidebar({
  notesByType,
  totalMemories,
  totalNotes,
}: {
  notesByType: Record<string, number>;
  totalMemories: number;
  totalNotes: number;
}) {
  return (
    <div className="space-y-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-[var(--space-4)]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        Estatísticas
      </p>

      <div className="space-y-[var(--space-2)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">Total de notas</span>
          <span className="text-xs font-medium text-[var(--color-text-primary)]">{totalNotes}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">Memórias</span>
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {totalMemories}
          </span>
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] pt-[var(--space-3)] space-y-[var(--space-2)]">
        {ALL_TYPES.map((type) => {
          const config = NOTE_TYPE_CONFIG[type];
          const Icon = config.icon;
          const count = notesByType[type] ?? 0;
          if (count === 0) return null;
          return (
            <div key={type} className="flex items-center gap-[var(--space-2)]">
              <Icon className="h-3 w-3 flex-shrink-0" style={{ color: config.color }} />
              <span className="flex-1 text-xs text-[var(--color-text-secondary)]">
                {config.label}
              </span>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function NotesTab() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<NoteType | ''>('');
  const [filterModule, setFilterModule] = useState('');
  const [editingNote, setEditingNote] = useState<KnowledgeNote | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ['knowledge', 'notes', filterType, filterModule, search],
    queryFn: () => {
      if (search.trim()) return searchNotesAction(search);
      return fetchNotes(filterType || undefined, filterModule || undefined, 80);
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['knowledge', 'stats'],
    queryFn: fetchKnowledgeStats,
  });

  const { data: memStats } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: fetchMemoryStats,
  });

  // Fetch books to keep the books-aware context (not displayed here but keeps
  // the query cache warm for other tabs that may render concurrently)
  useQuery({
    queryKey: ['knowledge', 'books'],
    queryFn: () => fetchBooks(),
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: removeNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      toast.success('Nota excluída');
    },
    onError: () => toast.error('Erro ao excluir nota'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNoteInput }) => editNote(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setEditingNote(null);
      toast.success('Nota atualizada');
    },
    onError: () => toast.error('Erro ao salvar nota'),
  });

  const promoteMutation = useMutation({
    mutationFn: promoteNoteToMemory,
    onMutate: (note) => setPromotingId(note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['memory'] });
      setPromotingId(null);
      toast.success('Nota promovida para memória');
    },
    onError: () => {
      setPromotingId(null);
      toast.error('Erro ao promover nota');
    },
  });

  // ── Derived state ────────────────────────────────────────────────────────

  const grouped = groupByType(notes ?? []);
  const totalNotes = stats?.total_notes ?? notes?.length ?? 0;
  const totalMemories = memStats?.total ?? 0;
  const notesByType = stats?.notes_by_type ?? {};

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveEdit = (id: string, input: UpdateNoteInput) => {
    editMutation.mutate({ id, input });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-w-0 overflow-y-auto space-y-[var(--space-5)]">
      {/* Quick save bar */}
      <QuickSaveBar />

      {/* Search + filters */}
      <div className="space-y-[var(--space-2)]">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-[var(--space-3)] top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] pl-9 pr-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-[var(--space-1)] flex-wrap items-center">
          <FilterChip label="Todas" active={!filterType} onClick={() => setFilterType('')} />
          {ALL_TYPES.map((type) => {
            const config = NOTE_TYPE_CONFIG[type];
            return (
              <FilterChip
                key={type}
                label={config.label}
                active={filterType === type}
                onClick={() => setFilterType(filterType === type ? '' : type)}
                color={filterType === type ? config.color : undefined}
              />
            );
          })}

          {/* Module filter */}
          {filterModule && (
            <button
              type="button"
              onClick={() => setFilterModule('')}
              className="flex items-center gap-[var(--space-1)] px-2 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium bg-[var(--color-accent)] text-[var(--color-surface-0)] cursor-pointer"
            >
              {getModuleLabel(filterModule) ?? filterModule}
              <span className="opacity-70">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Main layout: content + sidebar */}
      <div className="flex gap-[var(--space-6)] items-start">
        {/* Notes grouped by type */}
        <div className="flex-1 min-w-0 space-y-[var(--space-6)]">
          {notesLoading ? (
            <ListSkeleton items={4} />
          ) : !notes || notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma nota encontrada"
              description={
                search
                  ? 'Tente uma busca diferente ou limpe os filtros'
                  : 'Use a barra acima para salvar uma URL ou peça ao Hawk para criar notas'
              }
            />
          ) : (
            <>
              {ALL_TYPES.filter((type) => grouped.has(type)).map((type) => {
                const typeNotes = grouped.get(type)!;
                const config = NOTE_TYPE_CONFIG[type];
                const Icon = config.icon;

                return (
                  <section key={type} className="space-y-[var(--space-2)]">
                    {/* Section header */}
                    <div className="flex items-center gap-[var(--space-2)]">
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: config.color }} />
                      <span className="text-xs font-medium" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        ({typeNotes.length})
                      </span>
                      <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
                    </div>

                    {/* Cards */}
                    <div className="space-y-[var(--space-2)]">
                      {typeNotes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          onEdit={setEditingNote}
                          onDelete={(id) => deleteMutation.mutate(id)}
                          onPromote={(n) => promoteMutation.mutate(n)}
                          isPromoting={promotingId === note.id}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>

        {/* Sidebar — hidden on small screens */}
        <div className="hidden lg:flex flex-col gap-[var(--space-5)] w-56 flex-shrink-0">
          <StatsSidebar
            notesByType={notesByType}
            totalNotes={totalNotes}
            totalMemories={totalMemories}
          />
          <ReadingQueue />
        </div>
      </div>

      {/* Edit sheet */}
      <EditSheet
        open={editingNote !== null}
        onClose={() => setEditingNote(null)}
        title="Editar Nota"
      >
        {editingNote && (
          <EditNoteForm
            note={editingNote}
            onSave={handleSaveEdit}
            isSaving={editMutation.isPending}
          />
        )}
      </EditSheet>
    </div>
  );
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  // When a custom color is provided (type chips), use inline style for the
  // active state so the exact brand color is applied. The inactive state always
  // falls back to the generic surface/muted palette.
  const activeStyle = active && color ? { background: `${color}20`, color } : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      style={activeStyle}
      className={cn(
        'px-2 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium transition-colors cursor-pointer',
        active && !color && 'bg-[var(--color-accent)] text-[var(--color-surface-0)]',
        !active &&
          'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
      )}
    >
      {label}
    </button>
  );
}
