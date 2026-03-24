'use client';

import type { Agent } from '@/lib/agent-chat';

const MODULE_LABELS: Record<string, string> = {
  finances: 'Finanças',
  health: 'Saúde',
  people: 'Pessoas',
  career: 'Carreira',
  objectives: 'Metas',
  knowledge: 'Conhecimento',
  routine: 'Rotina',
  assets: 'Patrimônio',
  entertainment: 'Entretenimento',
  legal: 'Jurídico',
  social: 'Social',
  spirituality: 'Espiritualidade',
  housing: 'Moradia',
  security: 'Segurança',
  calendar: 'Agenda',
  journal: 'Diário',
};

function getModelShortName(model?: string | null): string {
  if (!model) return '';
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  return name.replace(':free', '').replace(/:.*$/, '');
}

interface ChatHeaderProps {
  agent: Agent | null;
  connected: boolean;
}

export function ChatHeader({ agent, connected }: ChatHeaderProps) {
  if (!agent) {
    return (
      <div className="flex items-center justify-center px-4 py-4 border-b border-[var(--color-border-subtle)]">
        <span className="text-sm text-[var(--color-text-muted)]">
          Selecione um agente para conversar
        </span>
      </div>
    );
  }

  const modules = agent.enabled_tools ?? [];
  const maxModules = 5;
  const visibleModules = modules.slice(0, maxModules);
  const hiddenCount = modules.length - maxModules;

  return (
    <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
      <div className="flex items-center gap-3">
        {/* Agent indicator */}
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {agent.name}
            </span>
            {agent.llm_model && (
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">
                {getModelShortName(agent.llm_model)}
              </span>
            )}
          </div>
          {agent.tagline && (
            <p className="text-xs text-[var(--color-text-muted)] truncate">{agent.tagline}</p>
          )}
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="relative">
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
            />
            {connected && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-[var(--color-success)] animate-ping opacity-40" />
            )}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Module badges */}
      {visibleModules.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pl-[44px]">
          {visibleModules.map((mod) => (
            <span
              key={mod}
              className="text-[9px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded"
            >
              {MODULE_LABELS[mod] ?? mod}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[9px] text-[var(--color-text-muted)]">+{hiddenCount}</span>
          )}
        </div>
      )}
    </div>
  );
}
