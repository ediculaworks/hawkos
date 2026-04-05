'use client';

import { fetchIntegrations } from '@/lib/actions/integrations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { IntegrationCard } from './integrations/integration-card';
import { IntegrationForm } from './integrations/integration-form';
import { INTEGRATION_REGISTRY, type IntegrationDefinition } from './integrations/registry';

export function SectionIntegrations() {
  const queryClient = useQueryClient();
  const [configuring, setConfiguring] = useState<IntegrationDefinition | null>(null);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
    staleTime: 30_000,
  });

  // Toggle is handled by opening the form and resaving — no dedicated toggle endpoint
  const handleToggle = (_provider: string, _enabled: boolean) => {
    // no-op: configure via the settings form
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['integrations'] });
    setConfiguring(null);
  };

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Integrações
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Configure suas chaves de API e integrações externas.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-2)]">
          {INTEGRATION_REGISTRY.map((definition) => {
            const summary = integrations?.find((i) => i.provider === definition.provider);
            return (
              <IntegrationCard
                key={definition.provider}
                definition={definition}
                summary={summary}
                onConfigure={() => setConfiguring(definition)}
                onToggle={(enabled) => handleToggle(definition.provider, enabled)}
              />
            );
          })}
        </div>
      )}

      {configuring && (
        <IntegrationForm
          definition={configuring}
          open={true}
          onClose={() => setConfiguring(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
