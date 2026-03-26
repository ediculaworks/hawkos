'use client';

import {
  type IntegrationSummary,
  fetchIntegrations,
  saveIntegration,
} from '@/lib/actions/integrations';
import type { IntegrationProvider } from '@hawk/admin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { IntegrationCard } from './integrations/integration-card';
import { IntegrationForm } from './integrations/integration-form';
import { INTEGRATION_REGISTRY } from './integrations/registry';

export function SectionIntegrations() {
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState<IntegrationProvider | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['settings', 'integrations'],
    queryFn: fetchIntegrations,
    staleTime: 30_000,
  });

  const handleToggle = useCallback(
    async (provider: IntegrationProvider, enabled: boolean) => {
      // Optimistic update
      queryClient.setQueryData<IntegrationSummary[]>(['settings', 'integrations'], (prev) =>
        prev?.map((i) => (i.provider === provider ? { ...i, enabled } : i)),
      );

      const existing = integrations?.find((i) => i.provider === provider);
      if (existing?.configured) {
        await saveIntegration(provider, {}, enabled);
      }
    },
    [integrations, queryClient],
  );

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'integrations'] });
  }, [queryClient]);

  const editingDefinition = editingProvider
    ? INTEGRATION_REGISTRY.find((d) => d.provider === editingProvider)
    : null;

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Integrações</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Serviços conectados ao Hawk OS. Configure as credenciais de cada integração.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <div className="space-y-[var(--space-2)] max-w-lg">
          {INTEGRATION_REGISTRY.map((definition) => {
            const summary = integrations?.find((i) => i.provider === definition.provider);
            return (
              <IntegrationCard
                key={definition.provider}
                definition={definition}
                summary={summary}
                onConfigure={() => setEditingProvider(definition.provider)}
                onToggle={(enabled) => handleToggle(definition.provider, enabled)}
              />
            );
          })}
        </div>
      )}

      {editingDefinition && (
        <IntegrationForm
          definition={editingDefinition}
          open={!!editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
