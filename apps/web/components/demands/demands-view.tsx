'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { fetchActiveDemands, fetchDemands } from '@/lib/actions/demands';
import type { DemandStatus } from '@hawk/module-demands/types';
import { useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { useState } from 'react';
import { DemandCard } from './demand-card';
import { DemandCreateForm } from './demand-create-form';

type Props = {
  showCreateForm: boolean;
  onCloseCreateForm: () => void;
};

export function DemandsView({ showCreateForm, onCloseCreateForm }: Props) {
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const { data: activeDemands, isLoading: activeLoading } = useQuery({
    queryKey: ['demands', 'active'],
    queryFn: () => fetchActiveDemands(),
  });

  const { data: historyDemands, isLoading: historyLoading } = useQuery({
    queryKey: ['demands', 'history'],
    queryFn: () => fetchDemands(['completed', 'failed', 'cancelled'] as DemandStatus[]),
    enabled: tab === 'history',
  });

  const demands = tab === 'active' ? activeDemands : historyDemands;
  const isLoading = tab === 'active' ? activeLoading : historyLoading;

  return (
    <div className="space-y-[var(--space-4)]">
      {/* Sub-tabs */}
      <div className="flex gap-[var(--space-1)]">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-[var(--radius-md)] transition-colors ${
              tab === t
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-medium'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t === 'active' ? 'Ativas' : 'Historico'}
          </button>
        ))}
      </div>

      {showCreateForm && <DemandCreateForm onClose={onCloseCreateForm} />}

      {isLoading && <ListSkeleton items={3} />}

      {!isLoading && demands && demands.length > 0 && (
        <div className="space-y-[var(--space-2)]">
          {demands.map((d) => (
            <DemandCard key={d.id} demand={d} />
          ))}
        </div>
      )}

      {!isLoading && (!demands || demands.length === 0) && (
        <EmptyState
          icon={Rocket}
          title={tab === 'active' ? 'Nenhuma demanda ativa' : 'Nenhuma demanda no historico'}
          description={
            tab === 'active'
              ? 'Crie uma demanda via chat ou pelo botao acima. Hawk vai analisar e decompor em etapas.'
              : 'Demandas concluidas, canceladas ou que falharam aparecerao aqui.'
          }
        />
      )}
    </div>
  );
}
