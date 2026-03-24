'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export interface AgentSettings {
  temperature: number;
  maxTokens: number;
  agentTier: string;
  memoryType: string;
  identity: string;
  systemPrompt: string;
}

interface ModelSettingsProps {
  settings: AgentSettings;
  onSettingsChange: (settings: AgentSettings) => void;
}

const TOKEN_PRESETS = [512, 1024, 2048, 4096, 8192];

const TIER_OPTIONS = [
  { id: 'orchestrator', label: 'Orchestrador' },
  { id: 'specialist', label: 'Especialista' },
  { id: 'worker', label: 'Worker' },
];

const MEMORY_OPTIONS = [
  { id: 'shared', label: 'Compartilhada' },
  { id: 'agent', label: 'Por Agente' },
  { id: 'session', label: 'Por Sessão' },
];

export function ModelSettings({ settings, onSettingsChange }: ModelSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<AgentSettings>) => {
    onSettingsChange({ ...settings, ...partial });
  };

  return (
    <div className="space-y-[var(--space-5)] mt-[var(--space-5)]">
      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-[var(--space-2)]">
          <label
            htmlFor="temperature"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Temperatura
          </label>
          <span className="text-sm font-mono text-[var(--color-text-muted)]">
            {settings.temperature.toFixed(2)}
          </span>
        </div>
        <input
          id="temperature"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.temperature}
          onChange={(e) => update({ temperature: Number.parseFloat(e.target.value) })}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-[var(--space-1)]">
          <span>Focado</span>
          <span>Criativo</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <label
          htmlFor="max-tokens"
          className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
        >
          Tokens Máximos
        </label>
        <div className="flex flex-wrap gap-[var(--space-2)] mb-[var(--space-2)]">
          {TOKEN_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => update({ maxTokens: preset })}
              className={`px-[var(--space-3)] py-[var(--space-1)] rounded-full text-sm transition-colors ${
                settings.maxTokens === preset
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]'
              }`}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>
        <input
          id="max-tokens"
          type="number"
          min="64"
          max="32768"
          value={settings.maxTokens}
          onChange={(e) => update({ maxTokens: Number.parseInt(e.target.value) || 4096 })}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Agent Tier */}
      <div>
        <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block">
          Tier do Agente
        </span>
        <div className="flex gap-[var(--space-2)]">
          {TIER_OPTIONS.map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => update({ agentTier: tier.id })}
              className={`flex-1 px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
                settings.agentTier === tier.id
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Type */}
      <div>
        <label
          htmlFor="memory-type"
          className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
        >
          Tipo de Memória
        </label>
        <select
          id="memory-type"
          value={settings.memoryType}
          onChange={(e) => update({ memoryType: e.target.value })}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          {MEMORY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced Section */}
      <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-[var(--space-2)] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Avançado
        </button>

        {showAdvanced && (
          <div className="space-y-[var(--space-4)] mt-[var(--space-4)]">
            {/* Identity */}
            <div>
              <label
                htmlFor="agent-identity"
                className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
              >
                Bloco de Identidade
              </label>
              <textarea
                id="agent-identity"
                value={settings.identity}
                onChange={(e) => update({ identity: e.target.value })}
                placeholder="Instrução de identidade do agente..."
                className="w-full h-40 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-1)]">
                Usado como bloco de system prompt para o agente. Separado de knowledge/philosophy.
              </p>
            </div>

            {/* System Prompt Override */}
            <div>
              <label
                htmlFor="agent-system-prompt"
                className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-2)] block"
              >
                System Prompt (Override Total)
              </label>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-[var(--space-3)] py-[var(--space-2)] mb-[var(--space-2)]">
                <p className="text-xs text-[var(--color-warning)]">
                  Se preenchido, substitui TUDO: identity, knowledge, philosophy e personality. Use
                  apenas se souber o que está fazendo.
                </p>
              </div>
              <textarea
                id="agent-system-prompt"
                value={settings.systemPrompt}
                onChange={(e) => update({ systemPrompt: e.target.value })}
                placeholder="System prompt completo (override)..."
                className="w-full h-40 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
