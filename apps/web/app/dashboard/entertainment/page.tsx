'use client';

import {
  EntertainmentHeader,
  type EntertainmentTab,
} from '@/components/entertainment/entertainment-header';
import { HobbiesList } from '@/components/entertainment/hobbies-list';
import { MediaList } from '@/components/entertainment/media-list';
import { useState } from 'react';

type Tab = EntertainmentTab;

export default function EntertainmentPage() {
  const [activeTab, setActiveTab] = useState<Tab>('today');

  return (
    <div className="space-y-[var(--space-6)]">
      <EntertainmentHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'today' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
          <MediaList />
          <HobbiesList />
        </div>
      )}

      {activeTab === 'media' && <MediaList />}

      {activeTab === 'hobbies' && <HobbiesList />}
    </div>
  );
}
