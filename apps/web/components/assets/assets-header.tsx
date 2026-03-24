'use client';

import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import { Briefcase, FileText, Package } from 'lucide-react';

export type AssetsTab = 'today' | 'assets' | 'documents';

interface AssetsHeaderProps {
  activeTab: AssetsTab;
  onTabChange: (tab: AssetsTab) => void;
  onAddAsset?: () => void;
  onAddDocument?: () => void;
}

const tabs: TabItem<AssetsTab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'assets', label: 'Bens' },
  { id: 'documents', label: 'Documentos' },
];

export function AssetsHeader({
  activeTab,
  onTabChange,
  onAddAsset,
  onAddDocument,
}: AssetsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Bens e Documentos</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Inventário de bens e documentos pessoais
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {(activeTab === 'today' || activeTab === 'assets') && onAddAsset && (
          <button
            type="button"
            onClick={onAddAsset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <Package className="h-3.5 w-3.5" />+ Bem
          </button>
        )}
        {(activeTab === 'today' || activeTab === 'documents') && onAddDocument && (
          <button
            type="button"
            onClick={onAddDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />+ Documento
          </button>
        )}
        <TabBar tabs={tabs} active={activeTab} onChange={onTabChange} />
      </div>
    </div>
  );
}
