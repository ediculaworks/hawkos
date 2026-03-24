'use client';

import { fetchPendingFollowups, fetchUpcomingBirthdaysShort } from '@/lib/actions/people';
import type { ContactReminder, Person } from '@hawk/module-people/types';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';

function formatDaysUntil(n: number): string {
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  return `em ${n}d`;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d atraso`;
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  return `em ${diff}d`;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 animate-pulse">
      <div className="h-3.5 w-32 rounded bg-[var(--color-surface-3)]" />
      <div className="h-3.5 w-14 rounded bg-[var(--color-surface-3)]" />
    </div>
  );
}

interface BirthdayRowProps {
  person: Person & { days_until: number };
}

function BirthdayRow({ person }: BirthdayRowProps) {
  return (
    <div className="flex items-center justify-between px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] transition-colors group">
      <div className="flex items-center gap-[var(--space-2)] min-w-0">
        <span className="text-sm text-[var(--color-text-primary)] truncate">{person.name}</span>
        {person.days_until === 0 && (
          <span className="text-[10px] font-bold text-[var(--color-accent)]">HOJE</span>
        )}
      </div>
      <span
        className="text-xs flex-shrink-0"
        style={{
          color: person.days_until <= 3 ? 'var(--color-warning)' : 'var(--color-text-muted)',
          fontWeight: person.days_until <= 3 ? 600 : 400,
        }}
      >
        {formatDaysUntil(person.days_until)}
      </span>
    </div>
  );
}

interface FollowupRowProps {
  reminder: ContactReminder & { person_name: string };
}

function FollowupRow({ reminder }: FollowupRowProps) {
  const overdue = isOverdue(reminder.next_expected_date);
  return (
    <div className="flex items-center justify-between px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] transition-colors">
      <div className="min-w-0">
        <span className="text-sm text-[var(--color-text-primary)] truncate block">
          {reminder.person_name}
        </span>
        {reminder.description && (
          <span className="text-[10px] text-[var(--color-text-muted)] truncate block">
            {reminder.description}
          </span>
        )}
      </div>
      <span
        className="text-xs flex-shrink-0 ml-2"
        style={{ color: overdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
      >
        {formatDueDate(reminder.next_expected_date)}
      </span>
    </div>
  );
}

function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-[var(--space-1)] px-[var(--space-3)] pt-[var(--space-2)] pb-[var(--space-1)]">
      <span className="text-xs">{emoji}</span>
      <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
        {label}
      </span>
    </div>
  );
}

export default function UpcomingContacts() {
  const { data: birthdays, isLoading: loadingBirthdays } = useQuery<
    Array<Person & { days_until: number }>
  >({
    queryKey: ['people', 'upcoming-birthdays'],
    queryFn: () => fetchUpcomingBirthdaysShort(14),
    staleTime: 10 * 60 * 1000,
  });

  const { data: followups, isLoading: loadingFollowups } = useQuery<
    Array<ContactReminder & { person_name: string }>
  >({
    queryKey: ['people', 'followups'],
    queryFn: () => fetchPendingFollowups(),
    staleTime: 5 * 60 * 1000,
  });

  const birthdayList = (birthdays ?? []).slice(0, 5);
  const followupList = (followups ?? []).slice(0, 5);
  const isLoading = loadingBirthdays || loadingFollowups;
  const totalCount = birthdayList.length + followupList.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-[var(--space-3)] py-[var(--space-2)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <Calendar className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            Esta Semana
          </span>
        </div>
        {!isLoading && totalCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">
            {totalCount}
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
            <SkeletonRow />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-7 w-7 text-[var(--color-text-muted)] mb-2" />
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">Tudo em ordem</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Nenhum aniversário ou follow-up pendente.
            </p>
          </div>
        ) : (
          <div>
            {birthdayList.length > 0 && (
              <section>
                <SectionHeader emoji="🎂" label="Aniversários" />
                {birthdayList.map((person) => (
                  <BirthdayRow key={person.id} person={person} />
                ))}
              </section>
            )}
            {followupList.length > 0 && (
              <section className={birthdayList.length > 0 ? 'mt-[var(--space-2)]' : undefined}>
                <SectionHeader emoji="📋" label="Follow-ups" />
                {followupList.map((reminder) => (
                  <FollowupRow key={reminder.id} reminder={reminder} />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
