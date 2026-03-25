'use client';

import { Button } from '@/components/ui/button';
import type { Agent } from '@/lib/agent-chat';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AgentFormModalProps {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}

type TabId = 'identity' | 'personality' | 'knowledge' | 'config' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'identity', label: 'Identidade' },
  { id: 'personality', label: 'Personalidade' },
  { id: 'knowledge', label: 'Conhecimento' },
  { id: 'config', label: 'Configuração' },
  { id: 'advanced', label: 'Avançado' },
];

const ALL_MODULES = [
  'finances',
  'health',
  'people',
  'career',
  'objectives',
  'routine',
  'assets',
  'entertainment',
  'legal',
  'housing',
  'calendar',
] as const;

const MODULE_LABELS: Record<string, string> = {
  finances: 'Finanças',
  health: 'Saúde',
  people: 'Pessoas',
  career: 'Carreira',
  objectives: 'Objetivos',
  routine: 'Rotina',
  assets: 'Patrimônio',
  entertainment: 'Entretenimento',
  legal: 'Jurídico',
  housing: 'Moradia',
  calendar: 'Agenda',
};

const LLM_MODELS = [
  { value: 'openrouter/auto', label: 'Auto (OpenRouter)' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'openai/gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
  { value: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B' },
];

interface FormState {
  // Identidade
  name: string;
  description: string;
  identity: string;
  // Personalidade
  traits: string; // comma-separated input
  tone: string;
  phrases: string; // comma-separated input
  // Conhecimento
  knowledge: string;
  philosophy: string;
  // Configuração
  llm_model: string;
  llm_model_custom: string;
  agent_tier: string;
  temperature: number;
  max_tokens: number;
  memory_type: string;
  is_user_facing: boolean;
  enabled_tools: string[];
  // Avançado
  system_prompt: string;
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  identity: '',
  traits: '',
  tone: '',
  phrases: '',
  knowledge: '',
  philosophy: '',
  llm_model: 'openrouter/auto',
  llm_model_custom: '',
  agent_tier: 'specialist',
  temperature: 0.7,
  max_tokens: 4096,
  memory_type: 'shared',
  is_user_facing: true,
  enabled_tools: [...ALL_MODULES],
  system_prompt: '',
};

function agentToForm(agent: Agent): FormState {
  const knownModels = LLM_MODELS.map((m) => m.value);
  const model = agent.llm_model ?? 'openrouter/auto';
  const isKnown = knownModels.includes(model);

  return {
    name: agent.name,
    description: agent.tagline ?? '',
    identity: (agent as AgentFull).identity ?? '',
    traits: ((agent as AgentFull).traits ?? []).join(', '),
    tone: (agent as AgentFull).tone ?? '',
    phrases: ((agent as AgentFull).phrases ?? []).join(', '),
    knowledge: (agent as AgentFull).knowledge ?? '',
    philosophy: (agent as AgentFull).philosophy ?? '',
    llm_model: isKnown ? model : '__custom__',
    llm_model_custom: isKnown ? '' : model,
    agent_tier: agent.agent_tier ?? 'specialist',
    temperature: (agent as AgentFull).temperature ?? 0.7,
    max_tokens: (agent as AgentFull).max_tokens ?? 4096,
    memory_type: (agent as AgentFull).memory_type ?? 'shared',
    is_user_facing: agent.is_user_facing ?? true,
    enabled_tools: agent.enabled_tools ?? [...ALL_MODULES],
    system_prompt: (agent as AgentFull).system_prompt ?? '',
  };
}

// Extended Agent type used for edit mode — carries all template fields
interface AgentFull extends Agent {
  identity?: string;
  tone?: string;
  phrases?: string[];
  knowledge?: string;
  philosophy?: string;
  temperature?: number;
  max_tokens?: number;
  memory_type?: string;
  system_prompt?: string;
}

const inputCls =
  'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';

const labelCls = 'text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block';

const hintCls = 'text-xs text-[var(--color-text-muted)] mt-1';

export function AgentFormModal({ open, agent, onClose, onSaved }: AgentFormModalProps) {
  const isEdit = Boolean(agent);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedContent, setShowAdvancedContent] = useState(false);

  const [form, setForm] = useState<FormState>(() =>
    agent ? agentToForm(agent) : { ...DEFAULT_FORM },
  );

  useEffect(() => {
    if (agent) {
      setForm(agentToForm(agent));
    } else {
      setForm({ ...DEFAULT_FORM });
    }
    setActiveTab('identity');
    setError(null);
    setShowAdvancedContent(false);
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

  const set = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

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
      setActiveTab('identity');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const resolvedModel =
        form.llm_model === '__custom__' ? form.llm_model_custom.trim() : form.llm_model;

      const payload = {
        name: form.name.trim(),
        tagline: form.description.trim(),
        identity: form.identity.trim(),
        traits: form.traits
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        tone: form.tone.trim(),
        phrases: form.phrases
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        knowledge: form.knowledge.trim(),
        philosophy: form.philosophy.trim(),
        llmModel: resolvedModel || null,
        agentTier: form.agent_tier,
        temperature: form.temperature,
        maxTokens: form.max_tokens,
        memoryType: form.memory_type,
        isUserFacing: form.is_user_facing,
        enabledTools: form.enabled_tools,
        systemPrompt: form.system_prompt.trim() || null,
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
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t transition-colors cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
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

          {/* TAB: Identidade */}
          {activeTab === 'identity' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="agent-name" className={labelCls}>
                  Nome <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Ex: Hawk, Bull, Wolf..."
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="agent-description" className={labelCls}>
                  Descrição
                </label>
                <input
                  id="agent-description"
                  type="text"
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Tagline curta do agente"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="agent-identity" className={labelCls}>
                  Identidade
                </label>
                <textarea
                  id="agent-identity"
                  rows={4}
                  value={form.identity}
                  onChange={(e) => set({ identity: e.target.value })}
                  placeholder="Bloco de identidade para o system prompt..."
                  className={`${inputCls} resize-none`}
                />
                <p className={hintCls}>
                  Bloco principal de identidade usado na construção do system prompt.
                </p>
              </div>
            </div>
          )}

          {/* TAB: Personalidade */}
          {activeTab === 'personality' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="agent-traits" className={labelCls}>
                  Traços
                </label>
                <input
                  id="agent-traits"
                  type="text"
                  value={form.traits}
                  onChange={(e) => set({ traits: e.target.value })}
                  placeholder="direto, analítico, proativo"
                  className={inputCls}
                />
                <p className={hintCls}>Separe com vírgulas.</p>
              </div>

              <div>
                <label htmlFor="agent-tone" className={labelCls}>
                  Tom
                </label>
                <input
                  id="agent-tone"
                  type="text"
                  value={form.tone}
                  onChange={(e) => set({ tone: e.target.value })}
                  placeholder="profissional mas acessível"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="agent-phrases" className={labelCls}>
                  Frases típicas
                </label>
                <input
                  id="agent-phrases"
                  type="text"
                  value={form.phrases}
                  onChange={(e) => set({ phrases: e.target.value })}
                  placeholder="Sem problema., Vou verificar isso."
                  className={inputCls}
                />
                <p className={hintCls}>Separe com vírgulas.</p>
              </div>
            </div>
          )}

          {/* TAB: Conhecimento */}
          {activeTab === 'knowledge' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="agent-knowledge" className={labelCls}>
                  Conhecimento especializado
                </label>
                <textarea
                  id="agent-knowledge"
                  rows={6}
                  value={form.knowledge}
                  onChange={(e) => set({ knowledge: e.target.value })}
                  placeholder="Domínios de conhecimento, expertise, fontes de referência..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label htmlFor="agent-philosophy" className={labelCls}>
                  Filosofia e regras
                </label>
                <textarea
                  id="agent-philosophy"
                  rows={6}
                  value={form.philosophy}
                  onChange={(e) => set({ philosophy: e.target.value })}
                  placeholder="Princípios, regras de comportamento, o que nunca fazer..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          )}

          {/* TAB: Configuração */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              {/* LLM Model */}
              <div>
                <label htmlFor="agent-model" className={labelCls}>
                  Modelo LLM
                </label>
                <select
                  id="agent-model"
                  value={form.llm_model}
                  onChange={(e) => set({ llm_model: e.target.value })}
                  className={inputCls}
                >
                  {LLM_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  <option value="__custom__">Personalizado...</option>
                </select>
                {form.llm_model === '__custom__' && (
                  <input
                    type="text"
                    value={form.llm_model_custom}
                    onChange={(e) => set({ llm_model_custom: e.target.value })}
                    placeholder="provider/model-name"
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>

              {/* Agent Tier */}
              <div>
                <span className={labelCls}>Tier</span>
                <div className="flex gap-2">
                  {[
                    { id: 'orchestrator', label: 'Orquestrador' },
                    { id: 'specialist', label: 'Especialista' },
                    { id: 'worker', label: 'Worker' },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => set({ agent_tier: tier.id })}
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

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="agent-temperature" className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Temperatura
                  </label>
                  <span className="text-sm font-mono text-[var(--color-text-muted)]">
                    {form.temperature.toFixed(1)}
                  </span>
                </div>
                <input
                  id="agent-temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => set({ temperature: Number.parseFloat(e.target.value) })}
                  className="w-full accent-[var(--color-accent)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
                  <span>Focado</span>
                  <span>Criativo</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label htmlFor="agent-max-tokens" className={labelCls}>
                  Tokens máximos
                </label>
                <select
                  id="agent-max-tokens"
                  value={form.max_tokens}
                  onChange={(e) => set({ max_tokens: Number(e.target.value) })}
                  className={inputCls}
                >
                  {[1024, 2048, 4096, 8192].map((n) => (
                    <option key={n} value={n}>
                      {n.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Memory Type */}
              <div>
                <label htmlFor="agent-memory-type" className={labelCls}>
                  Tipo de memória
                </label>
                <select
                  id="agent-memory-type"
                  value={form.memory_type}
                  onChange={(e) => set({ memory_type: e.target.value })}
                  className={inputCls}
                >
                  <option value="shared">Compartilhada</option>
                  <option value="agent">Por agente</option>
                  <option value="session">Por sessão</option>
                </select>
              </div>

              {/* Is user facing */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_user_facing}
                  onClick={() => set({ is_user_facing: !form.is_user_facing })}
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

              {/* Modules */}
              <div>
                <span className={labelCls}>Módulos habilitados</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ALL_MODULES.map((mod) => {
                    const active = form.enabled_tools.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleModule(mod)}
                        className={`py-1.5 px-3 text-sm rounded-[var(--radius-md)] transition-colors cursor-pointer text-left ${
                          active
                            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
                            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/30'
                        }`}
                      >
                        {MODULE_LABELS[mod]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Avançado */}
          {activeTab === 'advanced' && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvancedContent(!showAdvancedContent)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer mb-4"
              >
                {showAdvancedContent ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                System Prompt (override total)
              </button>

              {showAdvancedContent && (
                <div className="space-y-3">
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2">
                    <p className="text-xs text-[var(--color-warning)]">
                      Substitui identity + personalidade + conhecimento. Use apenas se souber o que
                      está fazendo.
                    </p>
                  </div>
                  <textarea
                    id="agent-system-prompt"
                    rows={10}
                    value={form.system_prompt}
                    onChange={(e) => set({ system_prompt: e.target.value })}
                    placeholder="System prompt completo (override)..."
                    className={`${inputCls} resize-none`}
                  />
                </div>
              )}

              {!showAdvancedContent && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Clique acima para expandir o override de system prompt.
                </p>
              )}
            </div>
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
