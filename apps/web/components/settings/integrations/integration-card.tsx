'use client';

import { Switch } from '@/components/ui/switch';
import type { IntegrationSummary } from '@/lib/actions/integrations';
import { Settings2 } from 'lucide-react';
import type { IntegrationDefinition } from './registry';

interface IntegrationCardProps {
  definition: IntegrationDefinition;
  summary: IntegrationSummary | undefined;
  onConfigure: () => void;
  onToggle: (enabled: boolean) => void;
}

const STATUS_CONFIG = {
  connected: {
    text: 'Conectado',
    className: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  },
  disabled: {
    text: 'Desativado',
    className: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  },
  not_configured: {
    text: 'Não configurado',
    className: 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]',
  },
  coming_soon: {
    text: 'Em breve',
    className: 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]',
  },
} as const;

function getStatus(_definition: IntegrationDefinition, summary: IntegrationSummary | undefined) {
  if (!summary?.configured) return STATUS_CONFIG.not_configured;
  if (!summary.enabled) return STATUS_CONFIG.disabled;
  return STATUS_CONFIG.connected;
}

export function IntegrationCard({
  definition,
  summary,
  onConfigure,
  onToggle,
}: IntegrationCardProps) {
  const Icon = definition.icon;
  const status = getStatus(definition, summary);
  const isGoogle = definition.provider === 'google';
  const isConfigured = summary?.configured ?? false;

  return (
    <div className="flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)]">
      <div className="flex items-center gap-[var(--space-3)] flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${definition.color}20` }}
        >
          <Icon className="h-4 w-4" style={{ color: definition.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--space-2)]">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {definition.name}
            </span>
            <span
              className={`text-xs px-[var(--space-2)] py-[var(--space-0-5)] rounded-full ${status.className}`}
            >
              {status.text}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {definition.description}
            {summary?.maskedHint && (
              <span className="ml-2 font-mono opacity-60">{summary.maskedHint}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-2)] shrink-0 ml-[var(--space-2)]">
        {isConfigured && !isGoogle && (
          <Switch checked={summary?.enabled ?? false} onCheckedChange={onToggle} />
        )}
        {isGoogle ? (
          <a
            href="/api/integrations/google-calendar/connect"
            className="px-2 py-1 text-xs rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
          >
            {isConfigured ? 'Reconectar' : 'Conectar'}
          </a>
        ) : (
          <button
            type="button"
            onClick={onConfigure}
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
