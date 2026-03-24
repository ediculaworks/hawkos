'use client';

import { ReadingQueue } from '@/components/knowledge/reading-queue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  fetchBooks,
  fetchKnowledgeStats,
  removeBook,
  setBookRating,
  setBookStatus,
} from '@/lib/actions/knowledge';
import { fetchMemoryStats } from '@/lib/actions/memory';
import { cn } from '@/lib/utils/cn';
import type { BookStatus } from '@hawk/module-knowledge/types';
import type { Book } from '@hawk/module-knowledge/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  reading: 'Lendo',
  want_to_read: 'Quero ler',
  completed: 'Concluído',
  abandoned: 'Abandonado',
};

const STATUS_ORDER: BookStatus[] = ['reading', 'want_to_read', 'completed', 'abandoned'];

// ── Sub-components ─────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function StarRating({
  rating,
  bookId,
  onRate,
  isPending,
}: {
  rating: number | null;
  bookId: string;
  onRate: (id: string, rating: number) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-[var(--space-0-5)]">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={isPending}
          onClick={() => onRate(bookId, star)}
          className="cursor-pointer transition-transform hover:scale-110 disabled:opacity-40"
          title={`${star} estrela${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'h-3 w-3',
              rating !== null && star <= rating
                ? 'text-[var(--color-warning)] fill-[var(--color-warning)]'
                : 'text-[var(--color-surface-3)]',
            )}
          />
        </button>
      ))}
    </div>
  );
}

function BookCard({
  book,
  onStatusChange,
  onRate,
  onDelete,
  statusPending,
  ratePending,
  deletePending: _deletePending,
}: {
  book: Book;
  onStatusChange: (id: string, status: BookStatus) => void;
  onRate: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
  statusPending: boolean;
  ratePending: boolean;
  deletePending: boolean;
}) {
  const showRating = book.status === 'reading' || book.status === 'completed';

  return (
    <Card className="group transition-shadow hover:shadow-[var(--shadow-md)]">
      <CardContent className="pt-[var(--space-4)]">
        <div className="flex items-start gap-[var(--space-3)]">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <BookMarked className="h-4 w-4 text-[var(--color-mod-knowledge)]" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title + actions */}
            <div className="flex items-start justify-between gap-[var(--space-2)]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
                  {book.title}
                </p>
                {book.author && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-0-5)]">
                    {book.author}
                  </p>
                )}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <RecordActions onDelete={() => onDelete(book.id)} deleteConfirmLabel="Excluir?" />
              </div>
            </div>

            {/* Notes */}
            {book.notes && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-[var(--space-2)] line-clamp-2">
                {book.notes}
              </p>
            )}

            {/* Metadata row */}
            <div className="flex items-center gap-[var(--space-3)] mt-[var(--space-2)] flex-wrap">
              {/* Key insights count */}
              {book.key_insights.length > 0 && (
                <span className="text-[10px] px-1.5 py-px rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  {book.key_insights.length} insight{book.key_insights.length > 1 ? 's' : ''}
                </span>
              )}

              {/* Star rating */}
              {showRating && (
                <StarRating
                  rating={book.rating}
                  bookId={book.id}
                  onRate={onRate}
                  isPending={ratePending}
                />
              )}
            </div>

            {/* Status transition buttons */}
            <div className="flex items-center gap-[var(--space-1-5)] mt-[var(--space-3)] flex-wrap">
              {book.status === 'want_to_read' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={statusPending}
                  onClick={() => onStatusChange(book.id, 'reading')}
                  className="text-[10px] h-6 px-[var(--space-2)]"
                >
                  Começar
                </Button>
              )}
              {book.status === 'reading' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={statusPending}
                    onClick={() => onStatusChange(book.id, 'completed')}
                    className="text-[10px] h-6 px-[var(--space-2)]"
                  >
                    Concluir
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={statusPending}
                    onClick={() => onStatusChange(book.id, 'abandoned')}
                    className="text-[10px] h-6 px-[var(--space-2)] text-[var(--color-text-muted)]"
                  >
                    Abandonar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookGroup({
  status,
  books,
  onStatusChange,
  onRate,
  onDelete,
  statusPendingId,
  ratePendingId,
  deletePendingId,
}: {
  status: BookStatus;
  books: Book[];
  onStatusChange: (id: string, status: BookStatus) => void;
  onRate: (id: string, rating: number) => void;
  onDelete: (id: string) => void;
  statusPendingId: string | null;
  ratePendingId: string | null;
  deletePendingId: string | null;
}) {
  if (books.length === 0) return null;

  return (
    <div className="space-y-[var(--space-3)]">
      {/* Group header */}
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {BOOK_STATUS_LABELS[status]}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{books.length}</span>
        <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--space-3)]">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onStatusChange={onStatusChange}
            onRate={onRate}
            onDelete={onDelete}
            statusPending={statusPendingId === book.id}
            ratePending={ratePendingId === book.id}
            deletePending={deletePendingId === book.id}
          />
        ))}
      </div>
    </div>
  );
}

function LibrarySidebar({
  readingBooks,
}: {
  readingBooks: Book[];
}) {
  const { data: knowledgeStats } = useQuery({
    queryKey: ['knowledge', 'stats'],
    queryFn: fetchKnowledgeStats,
  });

  const { data: memoryStats } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: fetchMemoryStats,
  });

  return (
    <aside className="hidden lg:block w-56 flex-shrink-0 space-y-[var(--space-5)]">
      {/* Stats card */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-[var(--space-4)] space-y-[var(--space-2)]">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Biblioteca
        </span>
        {knowledgeStats ? (
          <div className="space-y-[var(--space-1-5)]">
            <StatRow
              label="Total livros"
              value={String(
                Object.values(knowledgeStats.books_by_status).reduce((a, b) => a + b, 0),
              )}
            />
            <StatRow label="Lendo" value={String(knowledgeStats.books_by_status.reading ?? 0)} />
            <StatRow
              label="Concluídos"
              value={String(knowledgeStats.books_by_status.completed ?? 0)}
            />
            <StatRow label="Notas esta semana" value={String(knowledgeStats.notes_this_week)} />
          </div>
        ) : (
          <div className="space-y-[var(--space-1-5)]">
            {[...Array(4)].map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                key={i}
                className="h-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] animate-pulse"
              />
            ))}
          </div>
        )}

        {memoryStats && (
          <div className="pt-[var(--space-1-5)] border-t border-[var(--color-border-subtle)]">
            <StatRow label="Memórias" value={String(memoryStats.total)} />
          </div>
        )}
      </div>

      {/* Lendo agora */}
      {readingBooks.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-[var(--space-4)] space-y-[var(--space-3)]">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Lendo agora
          </span>
          <div className="space-y-[var(--space-2)]">
            {readingBooks.map((book) => (
              <div key={book.id} className="flex items-start gap-[var(--space-2)]">
                <BookMarked className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-[var(--color-mod-knowledge)]" />
                <div className="min-w-0">
                  <p className="text-xs text-[var(--color-text-primary)] leading-snug line-clamp-2">
                    {book.title}
                  </p>
                  {book.author && (
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                      {book.author}
                    </p>
                  )}
                  {book.rating !== null && (
                    <div className="flex items-center gap-[var(--space-0-5)] mt-[var(--space-0-5)]">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'h-2.5 w-2.5',
                            s <= (book.rating ?? 0)
                              ? 'text-[var(--color-warning)] fill-[var(--color-warning)]'
                              : 'text-[var(--color-surface-3)]',
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reading queue */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-[var(--space-4)]">
        <ReadingQueue />
      </div>
    </aside>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LibraryTab() {
  const queryClient = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ['knowledge', 'books'],
    queryFn: () => fetchBooks(),
  });

  // Track which book IDs are mutating for per-card pending state
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookStatus }) => setBookStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => setBookRating(id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
    onError: () => {
      toast.error('Erro ao salvar avaliação');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeBook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['memory'] });
      toast.success('Livro removido');
    },
    onError: () => {
      toast.error('Erro ao remover livro');
    },
  });

  const booksByStatus = (books ?? []).reduce<Record<BookStatus, Book[]>>(
    (acc, book) => {
      acc[book.status].push(book);
      return acc;
    },
    { reading: [], want_to_read: [], completed: [], abandoned: [] },
  );

  const readingBooks = booksByStatus.reading;

  const handleStatusChange = (id: string, status: BookStatus) => {
    statusMutation.mutate({ id, status });
  };

  const handleRate = (id: string, rating: number) => {
    rateMutation.mutate({ id, rating });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const isEmpty = !isLoading && (books ?? []).length === 0;

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="flex gap-[var(--space-6)] items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-[var(--space-8)]">
          {isLoading ? (
            <ListSkeleton items={4} />
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-[var(--space-16)] text-center">
              <BookMarked className="h-10 w-10 text-[var(--color-text-muted)] mb-[var(--space-4)]" />
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Nenhum livro na biblioteca
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-1)]">
                Adicione livros via chat com o Hawk
              </p>
            </div>
          ) : (
            STATUS_ORDER.map((status) => (
              <BookGroup
                key={status}
                status={status}
                books={booksByStatus[status]}
                onStatusChange={handleStatusChange}
                onRate={handleRate}
                onDelete={handleDelete}
                statusPendingId={
                  statusMutation.isPending
                    ? ((statusMutation.variables as { id: string } | undefined)?.id ?? null)
                    : null
                }
                ratePendingId={
                  rateMutation.isPending
                    ? ((rateMutation.variables as { id: string } | undefined)?.id ?? null)
                    : null
                }
                deletePendingId={
                  deleteMutation.isPending
                    ? ((deleteMutation.variables as string | undefined) ?? null)
                    : null
                }
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <LibrarySidebar readingBooks={readingBooks} />
      </div>
    </div>
  );
}
