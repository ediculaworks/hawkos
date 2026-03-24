'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { fetchDormantContacts } from '@/lib/actions/people';
import type { Person, Relationship } from '@hawk/module-people/types';
import { useQuery } from '@tanstack/react-query';
import { Phone, Users } from 'lucide-react';

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  family: 'Família',
  friend: 'Amigo',
  colleague: 'Colega',
  romantic: 'Romântico',
  professional: 'Profissional',
  medical: 'Médico',
};

const RELATIONSHIP_COLORS: Record<Relationship, string> = {
  family: 'var(--color-danger)',
  friend: 'var(--color-accent)',
  colleague: 'var(--color-warning)',
  romantic: '#e879f9',
  professional: 'var(--color-text-secondary)',
  medical: '#22d3ee',
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysSince(days: number | null): string {
  if (days === null) return 'nunca';
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-2 py-2 animate-pulse">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-4 w-28 rounded bg-[var(--color-surface-3)]" />
        <div className="h-4 w-16 rounded-full bg-[var(--color-surface-3)]" />
      </div>
      <div className="h-4 w-16 rounded bg-[var(--color-surface-3)]" />
    </div>
  );
}

function RelationshipChip({ rel }: { rel: Relationship | null }) {
  if (!rel) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{
        color: RELATIONSHIP_COLORS[rel],
        backgroundColor: `color-mix(in srgb, ${RELATIONSHIP_COLORS[rel]} 12%, transparent)`,
      }}
    >
      {RELATIONSHIP_LABELS[rel]}
    </span>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // silently fail on non-secure contexts
  }
}

interface DormantContactsProps {
  days?: number;
  maxItems?: number;
}

export default function DormantContacts({ days = 30, maxItems = 5 }: DormantContactsProps) {
  const { data, isLoading } = useQuery<Person[]>({
    queryKey: ['people', 'dormant', days],
    queryFn: () => fetchDormantContacts(days),
    staleTime: 5 * 60 * 1000,
  });

  const all = data ?? [];
  const visible = all.slice(0, maxItems);
  const overflow = all.length - maxItems;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Contatos Dormentes
          </span>
        </div>
        {!isLoading && all.length > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">
            {all.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 py-[var(--space-1)]">
        {isLoading ? (
          <div className="space-y-0.5">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todos os contatos ativos!"
            description="Nenhum contato sem interação nos últimos 30 dias."
          />
        ) : (
          <div className="space-y-0.5">
            {visible.map((person) => {
              const age = daysSince(person.last_interaction);
              return (
                <div
                  key={person.id}
                  className="group flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-[var(--space-2)] min-w-0">
                    <span className="text-sm text-[var(--color-text-primary)] truncate">
                      {person.name}
                    </span>
                    <RelationshipChip rel={person.relationship} />
                  </div>
                  <div className="flex items-center gap-[var(--space-2)] flex-shrink-0">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {formatDaysSince(age)}
                    </span>
                    {person.phone && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(person.phone as string)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                        title="Copiar telefone"
                        aria-label={`Copiar telefone de ${person.name}`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!person.phone && <div className="w-[28px]" />}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && (
              <div className="text-center py-[var(--space-2)]">
                <span className="text-xs text-[var(--color-text-muted)]">+{overflow} mais</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
