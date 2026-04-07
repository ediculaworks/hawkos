'use client';

import { type LLMChainEntry, fetchLLMChain, saveLLMChain } from '@/lib/actions/llm-chain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

// Provider + model catalog (mirrors agent providers.ts for display purposes)
const PROVIDER_CATALOG = [
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', speed: 'fast' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', speed: 'fast' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', speed: 'fast' },
    ],
  },
  {
    id: 'xai',
    name: 'x.AI',
    models: [
      { id: 'grok-3-mini', name: 'Grok 3 Mini', speed: 'fast' },
      { id: 'grok-3', name: 'Grok 3', speed: 'medium' },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    models: [
      {
        id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        name: 'Nemotron Ultra 253B',
        speed: 'medium',
      },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (free)', speed: 'medium' },
    ],
  },
  {
    id: 'google_ai',
    name: 'Google AI Studio',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', speed: 'fast' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', speed: 'fast' },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', speed: 'fast' },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', speed: 'fast' },
    ],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    models: [
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', speed: 'fast' },
      { id: 'llama-4-scout-17b-16e', name: 'Llama 4 Scout', speed: 'fast' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        name: 'Nemotron Super 120B (free)',
        speed: 'medium',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B (free)',
        speed: 'medium',
      },
      { id: 'qwen/qwen3.6-plus:free', name: 'Qwen 3.6 Plus (free)', speed: 'slow' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    models: [{ id: 'gemma4:e2b', name: 'Gemma 4 E2B', speed: 'slow' }],
  },
] as const;

const TIER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'simple', label: 'Simples' },
  { value: 'moderate', label: 'Moderado' },
  { value: 'complex', label: 'Complexo' },
];

const SPEED_COLORS: Record<string, string> = {
  fast: 'text-emerald-400',
  medium: 'text-amber-400',
  slow: 'text-[var(--color-text-muted)]',
};

export default function LLMChainEditor() {
  const queryClient = useQueryClient();
  const { data: chain, isLoading } = useQuery({
    queryKey: ['llm-chain'],
    queryFn: () => fetchLLMChain(),
  });

  const [entries, setEntries] = useState<Omit<LLMChainEntry, 'id'>[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Sync from server on first load
  const serverChain = chain ?? [];
  const displayEntries = dirty ? entries : serverChain;

  const save = useMutation({
    mutationFn: (data: Omit<LLMChainEntry, 'id'>[]) => saveLLMChain(data),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['llm-chain'] });
    },
  });

  function updateEntries(newEntries: Omit<LLMChainEntry, 'id'>[]) {
    // Re-number priorities
    const numbered = newEntries.map((e, i) => ({ ...e, priority: i + 1 }));
    setEntries(numbered);
    setDirty(true);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const arr = [...(dirty ? entries : serverChain.map(({ id: _, ...rest }) => rest))];
    [arr[index - 1], arr[index]] = [arr[index]!, arr[index - 1]!];
    updateEntries(arr);
  }

  function moveDown(index: number) {
    const arr = [...(dirty ? entries : serverChain.map(({ id: _, ...rest }) => rest))];
    if (index >= arr.length - 1) return;
    [arr[index], arr[index + 1]] = [arr[index + 1]!, arr[index]!];
    updateEntries(arr);
  }

  function removeEntry(index: number) {
    const arr = [...(dirty ? entries : serverChain.map(({ id: _, ...rest }) => rest))];
    arr.splice(index, 1);
    updateEntries(arr);
  }

  function addEntry(providerId: string, modelId: string) {
    const arr = [...(dirty ? entries : serverChain.map(({ id: _, ...rest }) => rest))];
    arr.push({
      priority: arr.length + 1,
      providerId,
      modelId,
      tier: 'all',
      enabled: true,
    });
    updateEntries(arr);
    setShowAdd(false);
  }

  function changeTier(index: number, tier: LLMChainEntry['tier']) {
    const arr = [...(dirty ? entries : serverChain.map(({ id: _, ...rest }) => rest))];
    arr[index] = { ...arr[index]!, tier };
    updateEntries(arr);
  }

  function getModelName(providerId: string, modelId: string): string {
    const provider = PROVIDER_CATALOG.find((p) => p.id === providerId);
    const model = provider?.models.find((m) => m.id === modelId);
    return model?.name ?? modelId;
  }

  function getProviderName(providerId: string): string {
    return PROVIDER_CATALOG.find((p) => p.id === providerId)?.name ?? providerId;
  }

  function getSpeed(providerId: string, modelId: string): string {
    const provider = PROVIDER_CATALOG.find((p) => p.id === providerId);
    const model = provider?.models.find((m) => m.id === modelId);
    return model?.speed ?? 'medium';
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar cadeia de modelos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Cadeia de Modelos LLM
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Define a ordem de prioridade. Se o primeiro falhar, usa o segundo, etc.
          </p>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={() => save.mutate(entries)}
            disabled={save.isPending}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {save.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Guardar
          </button>
        )}
      </div>

      {/* Chain entries */}
      {displayEntries.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Nenhum modelo configurado. A usar cadeia padrão (Ollama + OpenRouter free).
        </div>
      ) : (
        <div className="space-y-2">
          {displayEntries.map((entry, i) => {
            const speed = getSpeed(entry.providerId, entry.modelId);
            return (
              <div
                key={`${entry.providerId}-${entry.modelId}-${entry.priority}`}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 py-2"
              >
                <span className="w-5 text-center text-xs font-mono text-[var(--color-text-muted)]">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-primary)]">
                      {getProviderName(entry.providerId)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {getModelName(entry.providerId, entry.modelId)}
                    </span>
                    <span className={`text-[10px] ${SPEED_COLORS[speed]}`}>{speed}</span>
                  </div>
                </div>

                <select
                  value={entry.tier}
                  onChange={(e) => changeTier(i, e.target.value as LLMChainEntry['tier'])}
                  className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]"
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === displayEntries.length - 1}
                    className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add model button / picker */}
      {showAdd ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--color-text-primary)]">
            Selecionar provider e modelo
          </p>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {PROVIDER_CATALOG.map((provider) => (
              <div key={provider.id}>
                <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {provider.name}
                </p>
                {provider.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => addEntry(provider.id, model.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
                  >
                    <span className="flex-1">{model.name}</span>
                    <span className={`text-[10px] ${SPEED_COLORS[model.speed]}`}>
                      {model.speed}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="mt-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          <Plus size={14} /> Adicionar modelo
        </button>
      )}

      {save.isSuccess && <p className="text-xs text-emerald-400">Cadeia guardada com sucesso.</p>}
    </div>
  );
}
