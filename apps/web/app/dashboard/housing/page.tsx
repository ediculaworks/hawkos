'use client';

import { BillsList } from '@/components/housing/bills-list';
import { HousingHeader, type HousingTab } from '@/components/housing/housing-header';
import { MaintenanceList } from '@/components/housing/maintenance-list';
import { useState } from 'react';

type Tab = HousingTab;

export default function HousingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('today');

  return (
    <div className="space-y-[var(--space-6)]">
      <HousingHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'today' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
          <BillsList />
          <MaintenanceList />
        </div>
      )}

      {activeTab === 'bills' && <BillsList />}

      {activeTab === 'maintenance' && <MaintenanceList />}
    </div>
  );
}
