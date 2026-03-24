'use client';

import { SectionAgent } from '@/components/settings/section-agent';
import { SectionAppearance } from '@/components/settings/section-appearance';
import { SectionAutomations } from '@/components/settings/section-automations';
import { SectionData } from '@/components/settings/section-data';
import { SectionGeneral } from '@/components/settings/section-general';
import { SectionIntegrations } from '@/components/settings/section-integrations';
import { SectionModules } from '@/components/settings/section-modules';
import { SectionProfile } from '@/components/settings/section-profile';
import { SettingsNav, type SettingsSection } from '@/components/settings/settings-nav';
import type { ModuleRow } from '@/lib/actions/settings';
import { fetchModules, fetchProfileSettings } from '@/lib/actions/settings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('general');
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: fetchProfileSettings,
    staleTime: 60_000,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: fetchModules,
    staleTime: 60_000,
  });

  const handleProfileSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const handleModuleToggle = (id: string, enabled: boolean) => {
    queryClient.setQueryData<ModuleRow[]>(['settings', 'modules'], (prev) =>
      prev?.map((m) => (m.id === id ? { ...m, enabled } : m)),
    );
  };

  const isLoading = profileLoading || modulesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)] h-full">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Settings className="h-6 w-6 text-[var(--color-accent)]" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Configurações</h1>
      </div>

      {/* Layout: sidebar + content */}
      <div className="flex gap-[var(--space-8)] flex-1 min-h-0">
        <SettingsNav active={section} onSelect={setSection} />

        <div className="flex-1 overflow-y-auto pb-[var(--space-8)]">
          <div className="max-w-2xl">
            {section === 'general' && profile && (
              <SectionGeneral profile={profile} onSaved={handleProfileSaved} />
            )}
            {section === 'profile' && profile && (
              <SectionProfile profile={profile} onSaved={handleProfileSaved} />
            )}
            {section === 'agent' && <SectionAgent />}
            {section === 'modules' && modules && (
              <SectionModules modules={modules} onToggle={handleModuleToggle} />
            )}
            {section === 'appearance' && <SectionAppearance />}
            {section === 'automations' && <SectionAutomations />}
            {section === 'integrations' && <SectionIntegrations />}
            {section === 'data' && <SectionData />}
          </div>
        </div>
      </div>
    </div>
  );
}
