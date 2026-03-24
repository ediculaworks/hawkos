'use client';

import { Badge } from '@/components/ui/badge';
import { MentionText } from '@/components/ui/mention-text';
import { cn } from '@/lib/utils/cn';
import { formatRelativeDay } from '@/lib/utils/format';
import type { InteractionWithPerson } from '@hawk/module-people/types';

type Props = {
  interactions: InteractionWithPerson[];
  onSelectPerson: (personId: string) => void;
};

const SENTIMENT_COLORS = {
  positive: 'bg-[var(--color-success)]',
  neutral: 'bg-[var(--color-text-muted)]',
  negative: 'bg-[var(--color-danger)]',
};

const TYPE_LABELS: Record<string, string> = {
  call: 'ligou',
  meeting: 'encontrou',
  message: 'mensagem',
  visit: 'visitou',
  email: 'email',
};

export function ActivityFeed({ interactions, onSelectPerson }: Props) {
  if (interactions.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-[var(--space-3)]">
        Sem interações recentes
      </p>
    );
  }

  return (
    <div className="space-y-[var(--space-1)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Atividade recente
      </span>
      {interactions.map((inter) => (
        <div key={inter.id} className="flex items-start gap-[var(--space-2)] py-[var(--space-1-5)]">
          <div
            className={cn(
              'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
              SENTIMENT_COLORS[inter.sentiment ?? 'neutral'],
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[var(--space-1-5)] flex-wrap">
              <button
                type="button"
                onClick={() => onSelectPerson(inter.person_id)}
                className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-mod-people)] cursor-pointer"
              >
                {inter.person_name}
              </button>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {TYPE_LABELS[inter.type] ?? inter.type}
              </span>
              {inter.channel && <Badge variant="muted">{inter.channel}</Badge>}
              <span className="text-[10px] text-[var(--color-text-muted)] ml-auto flex-shrink-0">
                {formatRelativeDay(inter.date)}
              </span>
            </div>
            {inter.summary && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                <MentionText text={inter.summary} />
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
