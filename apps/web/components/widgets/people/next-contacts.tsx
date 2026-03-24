'use client';

import { addInteraction, fetchOverdueContacts, fetchUpcomingBirthdays } from '@/lib/actions/people';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, Phone, UserMinus, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NextContactsWidget() {
  const queryClient = useQueryClient();

  const contactMutation = useMutation({
    mutationFn: (personId: string) =>
      addInteraction({
        person_id: personId,
        type: 'message',
        summary: 'Contato rápido via dashboard',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Interação registrada');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const { data: overdue } = useQuery({
    queryKey: ['people', 'overdue'],
    queryFn: () => fetchOverdueContacts(),
  });

  const { data: birthdays } = useQuery({
    queryKey: ['people', 'birthdays'],
    queryFn: () => fetchUpcomingBirthdays(30),
  });

  const overdueCount = overdue?.length ?? 0;
  const birthdayCount = birthdays?.length ?? 0;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <ContactCard
          label="Atrasados"
          count={overdueCount}
          icon={UserMinus}
          color={overdueCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
          subtext={overdueCount > 0 ? 'precisam de contato' : 'todos em dia'}
        />
        <ContactCard
          label="Aniversário"
          count={birthdayCount}
          icon={Calendar}
          color={birthdayCount > 0 ? 'var(--color-warning)' : 'var(--color-accent)'}
          subtext={birthdayCount > 0 ? 'nos próximos 30d' : 'nenhum próximo'}
        />
      </div>

      {overdue && overdue.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Contatar
          </div>
          {overdue.slice(0, 4).map((person) => (
            <div
              key={person.id}
              className="group flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <span className="truncate text-[var(--color-text-primary)]">{person.name}</span>
              <div className="flex items-center gap-[var(--space-1)]">
                <Phone className="h-3 w-3 text-[var(--color-text-muted)] flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => contactMutation.mutate(person.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-success)] hover:bg-[var(--color-success-muted)] rounded transition-all cursor-pointer"
                  title="Registrar contato"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {overdue.length > 4 && (
            <div className="text-xs text-[var(--color-text-muted)] text-center">
              +{overdue.length - 4} mais
            </div>
          )}
        </div>
      )}

      {birthdays && birthdays.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Celebrar
          </div>
          {birthdays.slice(0, 3).map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-[var(--color-text-primary)]">{person.name}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                  {person.days_until === 0
                    ? 'hoje!'
                    : person.days_until === 1
                      ? 'amanhã'
                      : `${person.days_until}d`}
                </span>
              </div>
              <UserPlus className="h-3 w-3 text-[var(--color-warning)] flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactCard({
  label,
  count,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  count: number;
  icon: typeof UserMinus;
  color: string;
  subtext: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {count}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">{subtext}</span>
    </div>
  );
}
