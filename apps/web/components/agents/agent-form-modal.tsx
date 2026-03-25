'use client';

import { Button } from '@/components/ui/button';
import { ModelSelector } from './model-selector';
import { ModelSettings, type AgentSettings } from './model-settings';
import { ModuleSelector } from './module-selector';
import type { Agent } from '@/lib/agent-chat';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AgentFormModalProps {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  tagline: string;
  agent_tier: string;
  llm_model: string;
  enabled_tools: string[];
  is_user_facing: boolean;
  settings: AgentSettings;
}

const DEFAULT_SETTINGS: AgentSettings = {
  temperature: 0.7,
  maxTokens: 4096,
  agentTier: 'specialist',
  memoryType: 'shared',
  identity: '',
  systemPrompt: '',
};

const DEFAULT_MODULES = [
  'finances', 'calendar', 'routine', 'objectives',
  'health', 'people', 'career', 'assets',
];

type TabId = 'basic' | 'model' | 'modules' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'basic', label: 'Básico' },
  { id: 'model', label: 'Modelo' },
  { id: 'modules', label: 'Módulos' },
  { id: 'settings', label: 'Configurações' },
];

function agentToForm(agent: Agent): FormState {
  return {
    name: agent.name,
    tagline: agent.tagline ?? '',
    agent_tier: agent.agent_tier ?? 'specialist',
    llm_model: agent.llm_model ?? '',
    enabled_tools: agent.enabled_tools ?? [],
    is_user_facing: agent.is_user_facing,
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      agentTier: agent.agent_tier ?? 'specialist',
      memoryType: 'shared',
      identity: '',
      systemPrompt: '',
    },
  };
}

export function AgentFormModal({ open, agent, onClose, onSaved }: AgentFormModalProps) {
  const isEdit = Boolean(agent);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() =>
    agent
      ? agentToForm(agent)
      : {
          name: '',
          tagline: '',
          agent_tier: 'specialist',
          llm_model: '',
          enabled_tools: DEFAULT_MODULES,
          is_user_facing: true,
          settings: DEFAULT_SETTINGS,
        },
  );

  // Sync form when agent changes
  useEffect(() => {
    if (agent) {
      setForm(agentToForm(agent));
    } else {
      setForm({
        name: '',
        tagline: '',
        agent_tier: 'specialist',
        llm_model: '',
        enabled_tools: DEFAULT_MODULES,
        is_user_facing: true,
        settings: DEFAULT_SETTINGS,
      });
    }
    setActiveTab('basic');
    setError(null);
  }, [agent]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose],
  );

  const toggleModule = (moduleId: string) => {
    setForm((prev) => ({
      ...prev,
      enabled_tools: prev.enabled_tools.includes(moduleId)
        ? prev.enabled_tools.filter((m) => m !== moduleId)
        : [...prev.enabled_tools, moduleId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Nome é obrigatório');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        agent_tier: form.agent_tier,
        llm_model: form.llm_model.trim() || null,
        enabled_tools: form.enabled_tools,
        is_user_facing: form.is_user_facing,
      };

      const url = isEdit ? `/api/agents/${agent!.id}` : '/api/agents';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Erro ao salvar agente');
      }

      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar agente');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 m-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0 shadow-2xl backdrop:bg-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {isEdit ? `Editar ${agent!.name}` : 'Novo agente'}
        </h2>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="agent-name"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block"
                >
                  Nome <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Hawk, Bull, Wolf..."
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label
                  htmlFor="agent-tagline"
                  className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block"
                >
                  Tagline
                </label>
                <input
                  id="agent-tagline"
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
                  placeholder="Descrição curta do agente"
                  className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                  Tier
                </span>
                <div className="flex gap-2">
                  {[
                    { id: 'orchestrator', label: 'Orquestrador' },
                    { id: 'specialist', label: 'Especialista' },
                    { id: 'worker', label: 'Worker' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, agent_tier: tier.id }))}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-[var(--radius-md)] transition-colors cursor-pointer ${
                        form.agent_tier === tier.id
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_user_facing}
                  onClick={() => setForm((p) => ({ ...p, is_user_facing: !p.is_user_facing }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    form.is_user_facing ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      form.is_user_facing ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Visível para o utilizador
                </span>
              </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Selecione o modelo de linguagem para este agente.
              </p>
              <ModelSelector
                selectedModel={form.llm_model}
                onModelChange={(model) => setForm((p) => ({ ...p, llm_model: model }))}
              />
            </div>
          )}

          {activeTab === 'modules' && (
            <div>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Selecione quais módulos este agente pode aceder.
              </p>
              <ModuleSelector
                selectedModules={form.enabled_tools}
                onToggleModule={toggleModule}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <ModelSettings
              settings={form.settings}
              onSettingsChange={(settings) => setForm((p) => ({ ...p, settings }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar agente'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
