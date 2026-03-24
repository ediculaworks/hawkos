'use client';

import { Calendar, MessageSquare, Plug } from 'lucide-react';

interface IntegrationCard {
  name: string;
  description: string;
  icon: typeof MessageSquare;
  status: 'connected' | 'available' | 'coming_soon';
  color: string;
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    name: 'Discord',
    description: 'Canal principal do agente',
    icon: MessageSquare,
    status: 'connected',
    color: '#5865F2',
  },
  {
    name: 'Google Calendar',
    description: 'Sincronização de eventos e agenda',
    icon: Calendar,
    status: 'connected',
    color: '#4285F4',
  },
  {
    name: 'GitHub',
    description: 'Repositórios, issues e PRs',
    icon: Plug,
    status: 'coming_soon',
    color: '#8B5CF6',
  },
  {
    name: 'Notion',
    description: 'Importar notas e databases',
    icon: Plug,
    status: 'coming_soon',
    color: '#E6E6E6',
  },
];

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  connected: {
    text: 'Conectado',
    className: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  },
  available: {
    text: 'Disponível',
    className: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
  },
  coming_soon: {
    text: 'Em breve',
    className: 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]',
  },
};

export function SectionIntegrations() {
  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Integrações</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Serviços conectados ao Hawk OS.
        </p>
      </div>

      <div className="space-y-[var(--space-2)] max-w-lg">
        {INTEGRATIONS.map((integration) => {
          const status = STATUS_LABELS[integration.status] as { text: string; className: string };
          const Icon = integration.icon;
          return (
            <div
              key={integration.name}
              className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)]"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <div
                  className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
                  style={{ backgroundColor: `${integration.color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: integration.color }} />
                </div>
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {integration.name}
                  </span>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {integration.description}
                  </p>
                </div>
              </div>
              <span
                className={`text-xs px-[var(--space-2)] py-[var(--space-0-5)] rounded-full ${status.className}`}
              >
                {status.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
