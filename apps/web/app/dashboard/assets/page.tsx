'use client';

import { AssetsHeader, type AssetsTab } from '@/components/assets/assets-header';
import { AssetsList } from '@/components/assets/assets-list';
import { DocumentsList, ExpiringDocuments } from '@/components/assets/documents-list';
import { useState } from 'react';

export default function AssetsPage() {
  const [activeTab, setActiveTab] = useState<AssetsTab>('today');

  return (
    <div className="space-y-[var(--space-6)]">
      <AssetsHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'today' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
          <ExpiringDocuments />
          <AssetsList />
        </div>
      )}

      {activeTab === 'assets' && <AssetsList />}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
          <DocumentsList />
          <ExpiringDocuments />
        </div>
      )}
    </div>
  );
}
