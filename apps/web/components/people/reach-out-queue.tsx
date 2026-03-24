'use client';

import { AnimatedItem, AnimatedList } from '@/components/motion/animated-list';
import { RecordActions } from '@/components/ui/record-actions';
import { addInteraction, removePerson } from '@/lib/actions/people';
import { cn } from '@/lib/utils/cn';
import type { Person } from '@hawk/module-people/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, MessageSquare, Phone, Video } from 'lucide-react';
import toast from 'react-hot-toast';

type Props = {
  contacts: Person[];
  onSelect: (id: string) => void;
};

export function ReachOutQueue({ contacts, onSelect }: Props) {
  const queryClient = useQueryClient();

  const quickLog = useMutation({
    mutationFn: (input: {
      person_id: string;
      type: 'message' | 'call' | 'meeting';
      channel?: 'whatsapp' | 'phone' | 'in_person';
    }) =>
      addInteraction({
        person_id: input.person_id,
        type: input.type,
        channel: input.channel,
        sentiment: 'neutral',
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Contato removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover contato: ${err.message}`);
    },
  });

  if (contacts.length === 0) {
    return (
      <div className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] px-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-success)]/20 bg-[var(--color-success)]/5">
        <CheckCircle className="h-3.5 w-3.5 text-[var(--color-success)]/70" />
        <span className="text-xs text-[var(--color-success)]/80">Nenhum contato pendente</span>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-1)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Entrar em contato
      </span>
      <AnimatedList>
        {contacts.map((person) => {
          const daysOverdue = person.next_contact_reminder
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(person.next_contact_reminder).getTime()) / 86400000,
                ),
              )
            : 0;

          return (
            <AnimatedItem key={person.id}>
              <div
                className={cn(
                  'flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] transition-colors group',
                  daysOverdue >= 8
                    ? 'border-l-[3px] border-[var(--color-danger)] bg-[var(--color-danger-muted)]/50'
                    : daysOverdue >= 4
                      ? 'border-l-[3px] border-[var(--color-warning)]'
                      : 'border-l-[3px] border-[var(--color-surface-3)]',
                )}
              >
                {/* Avatar */}
                <button
                  type="button"
                  onClick={() => onSelect(person.id)}
                  className="w-8 h-8 rounded-full bg-[var(--color-mod-people)]/15 text-[var(--color-mod-people)] flex items-center justify-center text-xs font-semibold cursor-pointer flex-shrink-0 hover:bg-[var(--color-mod-people)]/25 transition-colors"
                >
                  {person.name.charAt(0).toUpperCase()}
                </button>

                {/* Info */}
                <button
                  type="button"
                  onClick={() => onSelect(person.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span className="text-sm text-[var(--color-text-primary)] truncate block">
                    {person.name}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {person.role ?? person.relationship ?? ''}
                    {daysOverdue > 0 && (
                      <span
                        className={cn(
                          'ml-1',
                          daysOverdue >= 8
                            ? 'text-[var(--color-danger)]'
                            : 'text-[var(--color-warning)]',
                        )}
                      >
                        · {daysOverdue}d atrasado
                      </span>
                    )}
                  </span>
                </button>

                {/* Quick actions */}
                <div className="flex gap-[var(--space-1)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      quickLog.mutate({
                        person_id: person.id,
                        type: 'message',
                        channel: 'whatsapp',
                      })
                    }
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-success)] hover:bg-[var(--color-success-muted)] transition-colors cursor-pointer"
                    title="Mandei mensagem"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickLog.mutate({ person_id: person.id, type: 'call', channel: 'phone' })
                    }
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-colors cursor-pointer"
                    title="Liguei"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickLog.mutate({
                        person_id: person.id,
                        type: 'meeting',
                        channel: 'in_person',
                      })
                    }
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-mod-people)] hover:bg-[var(--color-mod-people)]/10 transition-colors cursor-pointer"
                    title="Encontrei"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </button>
                  <RecordActions
                    onDelete={() => deleteMutation.mutate(person.id)}
                    deleteConfirmLabel="Remover"
                  />
                </div>
              </div>
            </AnimatedItem>
          );
        })}
      </AnimatedList>
    </div>
  );
}
