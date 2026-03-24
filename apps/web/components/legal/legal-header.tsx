'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Plus, Scale } from 'lucide-react';

export type LegalTab = 'today' | 'obligations' | 'contracts' | 'entities';

interface LegalHeaderProps {
  activeTab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
  onAddObligation?: () => void;
  onAddContract?: () => void;
  onAddEntity?: () => void;
}

const tabs: TabItem<LegalTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'obligations', label: 'Obrigações' },
  { id: 'contracts', label: 'Contratos' },
  { id: 'entities', label: 'Entidades' },
];

export function LegalHeader({
  activeTab,
  onTabChange,
  onAddObligation,
  onAddContract,
  onAddEntity,
}: LegalHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Jurídico</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Obrigações fiscais, contratos e entidades
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {activeTab === 'obligations' && onAddObligation && (
          <button
            type="button"
            onClick={onAddObligation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Obrigação
          </button>
        )}
        {(activeTab === 'contracts' || activeTab === 'today') && onAddContract && (
          <button
            type="button"
            onClick={onAddContract}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Contrato
          </button>
        )}
        {(activeTab === 'entities' || activeTab === 'contracts') && onAddEntity && (
          <button
            type="button"
            onClick={onAddEntity}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Entidade
          </button>
        )}

        <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      </div>
    </div>
  );
}
