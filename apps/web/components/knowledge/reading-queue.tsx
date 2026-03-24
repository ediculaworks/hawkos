'use client';

import { fetchUnreadNotes, markAsRead } from '@/lib/actions/knowledge';
import type { KnowledgeNote, NoteType } from '@hawk/module-knowledge/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, BookOpen, ExternalLink } from 'lucide-react';

const TYPE_LABELS: Partial<Record<NoteType, string>> = {
  bookmark: 'Link',
  reference: 'Ref',
  note: 'Nota',
  insight: 'Insight',
  book_note: 'Livro',
  quote: 'Citação',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

function NoteRow({
  note,
  onMarkRead,
  isPending,
}: {
  note: KnowledgeNote;
  onMarkRead: (id: string) => void;
  isPending: boolean;
}) {
  const label = note.title ?? note.url ?? note.content.slice(0, 60);
  const typeLabel = TYPE_LABELS[note.type] ?? note.type;

  return (
    <div className="flex items-center gap-[var(--space-2)] py-[var(--space-1-5)] group">
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onMarkRead(note.id)}
        disabled={isPending}
        title="Marcar como lido"
        className="h-4 w-4 flex-shrink-0 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-0)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] disabled:opacity-40 cursor-pointer"
        aria-label="Marcar como lido"
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs text-[var(--color-text-primary)]">{label}</span>
        <div className="flex items-center gap-[var(--space-1-5)] mt-[var(--space-0-5)]">
          <span className="text-[10px] px-1 py-px rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
            {typeLabel}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {timeAgo(note.created_at)}
          </span>
          {note.reading_time_minutes && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {note.reading_time_minutes} min
            </span>
          )}
        </div>
      </div>

      {/* External link */}
      {note.url && (
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-accent)] transition-all"
          title="Abrir link"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export function ReadingQueue() {
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['knowledge', 'unread'],
    queryFn: () => fetchUnreadNotes(8),
  });

  const markReadMutation = useMutation({
    mutationFn: markAsRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['knowledge', 'unread'] });
      const prev = queryClient.getQueryData<KnowledgeNote[]>(['knowledge', 'unread']);
      queryClient.setQueryData<KnowledgeNote[]>(
        ['knowledge', 'unread'],
        (old) => old?.filter((n) => n.id !== id) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['knowledge', 'unread'], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'unread'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'stats'] });
    },
  });

  const unreadCount = notes?.length ?? 0;

  return (
    <div className="space-y-[var(--space-2)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-1-5)]">
        <BookOpen className="h-3.5 w-3.5 text-[var(--color-mod-knowledge)]" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Para Ler
        </span>
        {unreadCount > 0 && (
          <span className="rounded-[var(--radius-full)] bg-[var(--color-accent)] px-1.5 py-px text-[10px] font-medium text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-[var(--space-2)]">
          {[...Array(3)].map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              key={i}
              className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-surface-1)] animate-pulse"
            />
          ))}
        </div>
      ) : unreadCount === 0 ? (
        <div className="flex items-center gap-[var(--space-2)] py-[var(--space-3)]">
          <BookMarked className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs text-[var(--color-text-muted)]">Tudo lido!</span>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {notes?.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              isPending={markReadMutation.isPending && markReadMutation.variables === note.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
