'use client';

import { AnimatedPage } from '@/components/motion/animated-page';
import { ActivityFeed } from '@/components/people/activity-feed';
import { AddPersonForm } from '@/components/people/add-person-form';
import { CrmHeader, type CrmView } from '@/components/people/crm-header';
import { PersonProfile } from '@/components/people/person-profile';
import { ReachOutQueue } from '@/components/people/reach-out-queue';
import { RelationshipPulse } from '@/components/people/relationship-pulse';
import { Badge } from '@/components/ui/badge';
import { EditSheet } from '@/components/ui/edit-sheet';
import { CardSkeleton, ListSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';
import {
  fetchNetworkStats,
  fetchOverdueContacts,
  fetchPeople,
  fetchRecentInteractions,
  fetchUpcomingBirthdays,
} from '@/lib/actions/people';
import { cn } from '@/lib/utils/cn';
import type { ContactFrequency, Relationship } from '@hawk/module-people/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cake, Star } from 'lucide-react';
import { useState } from 'react';

const REL_LABELS: Record<Relationship, string> = {
  family: 'Família',
  friend: 'Amigo',
  colleague: 'Colega',
  romantic: 'Romântico',
  professional: 'Profissional',
  medical: 'Médico',
};
const REL_COLORS: Record<Relationship, string> = {
  family: 'var(--color-danger)',
  friend: 'var(--color-success)',
  colleague: 'var(--color-accent)',
  romantic: 'var(--color-mod-people)',
  professional: 'var(--color-mod-career)',
  medical: 'var(--color-mod-health)',
};
const FREQ_LABELS: Record<ContactFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  as_needed: 'Sob demanda',
};

export default function PeoplePage() {
  const [view, setView] = useState<CrmView>('focus');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: peopleResult, isLoading: peopleLoading } = useQuery({
    queryKey: ['people', 'list'],
    queryFn: () => fetchPeople(50),
  });
  const people = peopleResult?.data;
  const { data: overdue, isLoading: overdueLoading } = useQuery({
    queryKey: ['people', 'overdue'],
    queryFn: () => fetchOverdueContacts(),
  });
  const { data: birthdays } = useQuery({
    queryKey: ['people', 'birthdays'],
    queryFn: () => fetchUpcomingBirthdays(60),
  });
  const { data: recentActivity } = useQuery({
    queryKey: ['people', 'activity'],
    queryFn: () => fetchRecentInteractions(20),
  });
  const { data: stats } = useQuery({
    queryKey: ['people', 'stats'],
    queryFn: () => fetchNetworkStats(),
  });

  const _invalidate = () => queryClient.invalidateQueries({ queryKey: ['people'] });
  const pageLoading = peopleLoading && overdueLoading;

  // Person drill-down replaces main content
  if (selectedPersonId) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AnimatedPage>
          <PersonProfile personId={selectedPersonId} onBack={() => setSelectedPersonId(null)} />
        </AnimatedPage>
      </Suspense>
    );
  }

  if (pageLoading) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AnimatedPage className="space-y-[var(--space-5)]">
          <CrmHeader view={view} onViewChange={setView} onAddPerson={() => setAddOpen(true)} />
          <div className="flex gap-[var(--space-6)] items-start">
            <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
              <ListSkeleton items={6} />
            </div>
            <div className="w-56 flex-shrink-0 hidden lg:block">
              <CardSkeleton />
            </div>
          </div>
        </AnimatedPage>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
    <AnimatedPage className="space-y-[var(--space-5)]">
      <CrmHeader view={view} onViewChange={setView} onAddPerson={() => setAddOpen(true)} />

      {/* Add person sheet */}
      <EditSheet open={addOpen} onClose={() => setAddOpen(false)} title="Novo contato">
        <AddPersonForm onToggle={undefined} expanded={true} />
      </EditSheet>

      <div className="flex gap-[var(--space-6)] items-start">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
          {/* FOCUS VIEW */}
          {view === 'focus' && (
            <>
              <ReachOutQueue contacts={overdue ?? []} onSelect={setSelectedPersonId} />

              {/* Birthdays */}
              {birthdays && birthdays.length > 0 && (
                <div className="space-y-[var(--space-2)]">
                  <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-[var(--space-1-5)]">
                    <Cake className="h-3 w-3" /> Aniversários
                  </span>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    {birthdays.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPersonId(p.id)}
                        className={cn(
                          'flex items-center gap-[var(--space-1-5)] px-[var(--space-3)] py-[var(--space-1-5)] rounded-[var(--radius-full)] text-xs cursor-pointer transition-colors',
                          p.days_until === 0
                            ? 'bg-[var(--color-mod-people)]/20 text-[var(--color-mod-people)] font-medium'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]',
                        )}
                      >
                        {p.name}
                        <span
                          className={cn(
                            p.days_until === 0
                              ? 'text-[var(--color-mod-people)]'
                              : 'text-[var(--color-text-muted)]',
                          )}
                        >
                          {p.days_until === 0
                            ? 'hoje!'
                            : p.days_until === 1
                              ? 'amanhã'
                              : `em ${p.days_until}d`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ActivityFeed
                interactions={recentActivity ?? []}
                onSelectPerson={setSelectedPersonId}
              />
            </>
          )}

          {/* NETWORK VIEW — grouped by relationship */}
          {view === 'network' &&
            people &&
            (
              [
                'family',
                'friend',
                'colleague',
                'professional',
                'romantic',
                'medical',
              ] as Relationship[]
            ).map((rel) => {
              const group = people.filter((p) => p.relationship === rel);
              if (group.length === 0) return null;
              return (
                <div key={rel}>
                  <span
                    className="text-[11px] font-medium uppercase tracking-wider mb-[var(--space-2)] block"
                    style={{ color: REL_COLORS[rel] }}
                  >
                    {REL_LABELS[rel]} ({group.length})
                  </span>
                  <div className="grid grid-cols-2 gap-[var(--space-2)] lg:grid-cols-3">
                    {group.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPersonId(p.id)}
                        className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer text-left"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                          style={{ background: `${REL_COLORS[rel]}20`, color: REL_COLORS[rel] }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-[var(--color-text-primary)] truncate block">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {p.role ?? ''}
                          </span>
                        </div>
                        {p.importance >= 8 && (
                          <Star className="h-3 w-3 text-[var(--color-warning)] fill-[var(--color-warning)] flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

          {/* ALL VIEW — full list */}
          {view === 'all' && people && (
            <div className="space-y-[var(--space-1)]">
              {people.map((p) => {
                const rel = p.relationship as Relationship | null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersonId(p.id)}
                    className="flex w-full items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-2)]/50 transition-colors cursor-pointer text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{
                        background: rel ? `${REL_COLORS[rel]}20` : 'var(--color-surface-3)',
                        color: rel ? REL_COLORS[rel] : 'var(--color-text-muted)',
                      }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--color-text-primary)] truncate block">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {rel ? REL_LABELS[rel] : ''}
                        {p.role ? ` · ${p.role}` : ''}
                        {p.city ? ` · ${p.city}` : ''}
                      </span>
                    </div>
                    {p.importance >= 8 && (
                      <Star className="h-3 w-3 text-[var(--color-warning)] fill-[var(--color-warning)] flex-shrink-0" />
                    )}
                    {p.contact_frequency && (
                      <Badge variant="muted">
                        {FREQ_LABELS[p.contact_frequency as ContactFrequency]}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-56 flex-shrink-0 space-y-[var(--space-5)] hidden lg:block">
          {stats && <RelationshipPulse stats={stats} />}
        </div>
      </div>
    </AnimatedPage>
    </Suspense>
  );
}
