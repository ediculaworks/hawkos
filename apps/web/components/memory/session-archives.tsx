'use client';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchSessionArchives } from '@/lib/actions/memory';
import { cn } from '@/lib/utils/cn';
import type { SessionArchive } from '@hawk/module-memory/types';
import { useQuery } from '@tanstack/react-query';
import { Brain, ChevronDown, ChevronRight, Hash, MessageSquare } from 'lucide-react';
import { useState } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Agora';
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const CHANNEL_COLORS: Record<string, string> = {
  discord: 'var(--color-accent)',
  web: 'var(--color-success)',
};

function getChannelColor(channel: string): string {
  const key = channel.toLowerCase();
  return CHANNEL_COLORS[key] ?? 'var(--color-text-muted)';
}

function _getChannelVariant(channel: string): 'default' | 'success' | 'muted' {
  const key = channel.toLowerCase();
  if (key === 'discord') return 'default';
  if (key === 'web') return 'success';
  return 'muted';
}

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-full)] text-[11px] font-medium transition-colors cursor-pointer',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
          : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
      )}
    >
      {label}
    </button>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SessionArchive }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        'transition-colors cursor-pointer hover:border-[var(--color-accent)]/50',
        expanded && 'border-[var(--color-accent)]/30',
      )}
    >
      {/* Header row */}
      <button
        type="button"
        className="w-full text-left p-[var(--space-3)] focus:outline-none"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-[var(--space-2)]">
          {/* Expand chevron */}
          <div className="mt-0.5 flex-shrink-0 text-[var(--color-text-muted)]">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-[var(--space-2)] mb-[var(--space-1)]">
              {/* Channel badge */}
              <span
                className="inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${getChannelColor(session.channel)} 15%, transparent)`,
                  color: getChannelColor(session.channel),
                }}
              >
                {session.channel}
              </span>

              {/* Date */}
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {formatSessionDate(session.created_at)}
              </span>

              {/* Divider */}
              <span className="text-[var(--color-border-subtle)]">·</span>

              {/* Message count */}
              <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]">
                <MessageSquare className="h-3 w-3" />
                {session.message_count}
              </span>

              {/* Memories count */}
              {session.memories_extracted > 0 && (
                <>
                  <span className="text-[var(--color-border-subtle)]">·</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]">
                    <Brain className="h-3 w-3" />
                    {session.memories_extracted}
                  </span>
                </>
              )}

              {/* Token count */}
              {session.token_count != null && (
                <>
                  <span className="text-[var(--color-border-subtle)]">·</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-muted)]">
                    <Hash className="h-3 w-3" />
                    {session.token_count.toLocaleString('pt-BR')}
                  </span>
                </>
              )}
            </div>

            {/* Abstract */}
            {session.abstract && (
              <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                {session.abstract}
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded overview */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        {expanded && session.overview && (
          <CardContent className="pt-0 pb-[var(--space-3)] px-[var(--space-3)]">
            <div className="border-t border-[var(--color-border-subtle)] pt-[var(--space-3)] ml-5">
              <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-[var(--space-2)]">
                Resumo da sessão
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                {session.overview}
              </p>

              {/* Session ID subtle reference */}
              <p className="mt-[var(--space-2)] text-[10px] text-[var(--color-text-muted)] font-mono truncate">
                {session.session_id}
              </p>
            </div>
          </CardContent>
        )}
      </div>
    </Card>
  );
}

// ── Session list skeleton ─────────────────────────────────────────────────────

function SessionListSkeleton() {
  return (
    <div className="space-y-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)]">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
          key={i}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-[var(--space-3)]"
        >
          <div className="flex items-start gap-[var(--space-2)]">
            <div className="skeleton-shimmer rounded h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-[var(--space-2)]">
              <div className="flex items-center gap-[var(--space-2)]">
                <div className="skeleton-shimmer rounded-full h-4 w-16" />
                <div className="skeleton-shimmer rounded h-3 w-10" />
                <div className="skeleton-shimmer rounded h-3 w-8" />
              </div>
              <div className="skeleton-shimmer rounded h-3 w-full" />
              <div className="skeleton-shimmer rounded h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ChannelFilter = '' | 'discord' | 'web';

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'discord', label: 'Discord' },
  { value: 'web', label: 'Web' },
];

const PAGE_SIZE = 20;

export function SessionArchives() {
  const [channel, setChannel] = useState<ChannelFilter>('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: sessions, isLoading } = useQuery<SessionArchive[]>({
    queryKey: ['memory', 'sessions', channel, limit],
    queryFn: () => fetchSessionArchives(limit, channel || undefined),
  });

  const hasMore = sessions?.length === limit;

  return (
    <div className="flex flex-col h-full">
      {/* Channel filter bar */}
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] flex-shrink-0">
        {CHANNEL_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            label={f.label}
            active={channel === f.value}
            onClick={() => {
              setChannel(f.value);
              setLimit(PAGE_SIZE);
            }}
          />
        ))}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-[var(--space-4)] py-[var(--space-3)] space-y-[var(--space-2)]">
        {isLoading && !sessions ? (
          <SessionListSkeleton />
        ) : !sessions || sessions.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma sessão arquivada"
            description="Sessões expiradas são automaticamente compactadas a cada hora"
          />
        ) : (
          <>
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-[var(--space-2)] pb-[var(--space-4)] flex justify-center">
                <button
                  type="button"
                  onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                  className="px-[var(--space-4)] py-[var(--space-2)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer"
                >
                  Carregar mais
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
