'use client';

import { Button } from '@/components/ui/button';
import type { Agent } from '@/lib/agent-chat';
import { agentHeaders, getAgentApiUrl } from '@/lib/config';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AgentFormModalProps {
  open: boolean;
  agent?: Agent | null;
  onClose: () => void;
  onSaved: () => void;
}

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

const AGENT_EMOJIS = [
  '🦉',
  '🐺',
  '🦚',
  '🐝',
  '🦫',
  '🐂',
  '🦊',
  '🐻',
  '🦁',
  '🐯',
  '🦈',
  '🐬',
  '🦜',
  '🐸',
  '🦎',
  '🐙',
] as const;

// All free models on OpenRouter (openrouter.ai/collections/free-models)
// Marked with tools: false if they don't support tool_choice
export const LLM_MODELS = [
  { value: 'qwen/qwen3.6-plus:free', label: 'Qwen3.6 Plus (1M ctx)', tools: true },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B (262K)', tools: true },
  { value: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (262K)', tools: true },
  { value: 'nvidia/nemotron-3-nano-30b-a3b:free', label: 'Nemotron Nano 30B (256K)', tools: true },
  { value: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B (131K)', tools: true },
  { value: 'openai/gpt-oss-20b:free', label: 'GPT OSS 20B (131K)', tools: true },
  { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (131K)', tools: true },
  { value: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B (131K)', tools: true },
  {
    value: 'mistralai/mistral-small-3.2-24b-instruct:free',
    label: 'Mistral Small 3.2 24B (131K)',
    tools: true,
  },
  { value: 'z-ai/glm-4.5-air:free', label: 'GLM-4.5 Air (131K)', tools: true },
  { value: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nemotron Nano 9B (128K)', tools: true },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (65K)', tools: true },
  {
    value: 'deepseek/deepseek-r1-0528:free',
    label: 'DeepSeek R1 0528 (163K) — sem tools',
    tools: false,
  },
  {
    value: 'nousresearch/hermes-3-llama-3.1-405b:free',
    label: 'Hermes 3 405B — sem tools',
    tools: false,
  },
  {
    value: 'stepfun/step-3.5-flash:free',
    label: 'Step 3.5 Flash (256K) — sem tools',
    tools: false,
  },
  { value: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5 — sem tools', tools: false },
  {
    value: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    label: 'Dolphin 24B — sem tools',
    tools: false,
  },
];

interface FormState {
  emoji: string;
  name: string;
  taskDescription: string;
  enabledModules: string[];
  llm_model: string;
  firstTask: string;
}

const DEFAULT_FORM: FormState = {
  emoji: '🦉',
  name: '',
  taskDescription: '',
  enabledModules: [...ALL_MODULES],
  llm_model: 'smart-routing',
  firstTask: '',
};

const inputCls =
  'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';

const labelCls = 'text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block';

const SESSION_STORAGE_KEY = 'hawk_active_session';
const DELEGATION_KEY = 'hawk_pending_delegation';

export function AgentFormModal({ open, agent, onClose, onSaved }: AgentFormModalProps) {
  const isEdit = Boolean(agent);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => {
    if (agent) {
      return {
        emoji: agent.avatar ?? '🦉',
        name: agent.name,
        taskDescription: agent.tagline ?? '',
        enabledModules: agent.enabled_tools ?? [...ALL_MODULES],
        llm_model: agent.llm_model ?? 'smart-routing',
        firstTask: '',
      };
    }
    return { ...DEFAULT_FORM };
  });

  useEffect(() => {
    if (agent) {
      setForm({
        emoji: agent.avatar ?? '🦉',
        name: agent.name,
        taskDescription: agent.tagline ?? '',
        enabledModules: agent.enabled_tools ?? [...ALL_MODULES],
        llm_model: agent.llm_model ?? 'smart-routing',
        firstTask: '',
      });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
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

  const set = (partial: Partial<FormState>) => setForm((prev) => ({ ...prev, ...partial }));

  const toggleModule = (mod: string) => {
    setForm((prev) => ({
      ...prev,
      enabledModules: prev.enabledModules.includes(mod)
        ? prev.enabledModules.filter((m) => m !== mod)
        : [...prev.enabledModules, mod],
    }));
  };

  async function submitForm(delegate: boolean) {
    if (!form.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (!form.taskDescription.trim()) {
      setError('Descrição da tarefa é obrigatória');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const resolvedModel = form.llm_model === 'smart-routing' ? null : form.llm_model;

      const payload = {
        name: form.name.trim(),
        avatar: form.emoji,
        tagline: form.taskDescription.trim(),
        agentTier: 'specialist',
        isUserFacing: false,
        memoryType: 'session',
        llmModel: resolvedModel,
        enabledTools: form.enabledModules,
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

      const created = (await res.json()) as { agent?: { id: string } };
      const agentId = created.agent?.id;

      if (delegate && form.firstTask.trim() && agentId) {
        // Create a session with this agent and navigate to chat with pending message
        const sessionRes = await fetch(`${getAgentApiUrl()}/chat/sessions`, {
          method: 'POST',
          headers: { ...agentHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId }),
        });

        if (sessionRes.ok) {
          const sessionData = (await sessionRes.json()) as { sessionId?: string };
          if (sessionData.sessionId) {
            // Store session + pending message for useChat to pick up
            localStorage.setItem(SESSION_STORAGE_KEY, sessionData.sessionId);
            sessionStorage.setItem(
              DELEGATION_KEY,
              JSON.stringify({
                sessionId: sessionData.sessionId,
                message: form.firstTask.trim(),
              }),
            );
            onSaved();
            handleClose();
            router.push('/dashboard/chat');
            return;
          }
        }
      }

      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar agente');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const canDelegate = Boolean(form.firstTask.trim()) && !isEdit;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
      className="fixed inset-0 z-50 m-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0 shadow-2xl backdrop:bg-black/60 w-full max-w-lg max-h-[90vh] flex flex-col"
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {error && (
          <div className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {/* Emoji + Name row */}
        <div className="flex gap-3 items-start">
          <div className="shrink-0">
            <span className={labelCls}>Avatar</span>
            <div className="grid grid-cols-4 gap-1">
              {AGENT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => set({ emoji })}
                  className={`h-8 w-8 flex items-center justify-center rounded-[var(--radius-md)] text-lg transition-colors cursor-pointer ${
                    form.emoji === emoji
                      ? 'bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <label htmlFor="agent-name" className={labelCls}>
              Nome <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="agent-name"
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ex: Analista Fiscal, Pesquisador..."
              className={inputCls}
            />

            <label htmlFor="agent-task-desc" className={`${labelCls} mt-3`}>
              O que este agente vai fazer? <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              id="agent-task-desc"
              rows={3}
              value={form.taskDescription}
              onChange={(e) => set({ taskDescription: e.target.value })}
              placeholder="Ex: Analisar minha situação financeira do trimestre e identificar padrões de gastos..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Modules */}
        <div>
          <span className={labelCls}>Acesso a módulos</span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_MODULES.map((mod) => {
              const active = form.enabledModules.includes(mod);
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => toggleModule(mod)}
                  className={`py-1 px-2.5 text-xs rounded-full transition-colors cursor-pointer ${
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

        {/* Model */}
        <div>
          <label htmlFor="agent-model" className={labelCls}>
            Modelo
          </label>
          <select
            id="agent-model"
            value={form.llm_model}
            onChange={(e) => set({ llm_model: e.target.value })}
            className={inputCls}
          >
            <option value="smart-routing">⚡ Smart routing (automático)</option>
            <optgroup label="Com suporte a tools">
              {LLM_MODELS.filter((m) => m.tools).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sem suporte a tools">
              {LLM_MODELS.filter((m) => !m.tools).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Smart routing escolhe automaticamente entre modelos free com base na complexidade.
          </p>
        </div>

        {/* First task (only for new agents) */}
        {!isEdit && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-4">
            <label htmlFor="agent-first-task" className={labelCls}>
              Primeira tarefa{' '}
              <span className="text-xs font-normal text-[var(--color-text-muted)]">(opcional)</span>
            </label>
            <textarea
              id="agent-first-task"
              rows={3}
              value={form.firstTask}
              onChange={(e) => set({ firstTask: e.target.value })}
              placeholder="Descreva a tarefa que o agente deve executar imediatamente após ser criado..."
              className={`${inputCls} resize-none`}
            />
            {canDelegate && (
              <p className="text-xs text-[var(--color-accent)] mt-1.5">
                ✓ Clicar em "Criar e Delegar" abrirá o chat com esta tarefa enviada automaticamente.
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
        {canDelegate ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => submitForm(false)}
            >
              {saving ? 'Salvando...' : 'Criar agente'}
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => submitForm(true)}>
              {saving ? 'Criando...' : 'Criar e Delegar →'}
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" disabled={saving} onClick={() => submitForm(false)}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar agente'}
          </Button>
        )}
      </div>
    </dialog>
  );
}
