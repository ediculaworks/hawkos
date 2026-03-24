'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { deleteMemoryAction, updateMemoryAction } from '@/lib/actions/memory';
import { MODULE_CONFIG } from '@/lib/modules';
import { cn } from '@/lib/utils/cn';
import type {
  AgentMemory,
  MemoryCategory,
  MemoryStatus,
  MemoryType,
} from '@hawk/module-memory/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const CATEGORIES: MemoryCategory[] = [
  'preference',
  'fact',
  'pattern',
  'insight',
  'correction',
  'goal',
  'relationship',
];
const STATUSES: MemoryStatus[] = ['active', 'pending', 'rejected', 'archived'];

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preference: 'var(--color-accent)',
  fact: 'var(--color-success)',
  pattern: 'var(--color-warning)',
  insight: 'var(--color-mod-knowledge)',
  correction: 'var(--color-danger)',
  goal: 'var(--color-mod-objectives)',
  relationship: 'var(--color-mod-people)',
};

const MEMORY_TYPE_CONFIG: Record<MemoryType, { label: string; color: string }> = {
  profile: { label: 'Perfil', color: 'var(--color-accent)' },
  preference: { label: 'Preferência', color: 'var(--color-mod-entertainment)' },
  entity: { label: 'Entidade', color: 'var(--color-mod-people)' },
  event: { label: 'Evento', color: 'var(--color-mod-calendar)' },
  case: { label: 'Caso', color: 'var(--color-danger)' },
  pattern: { label: 'Padrão', color: 'var(--color-warning)' },
  procedure: { label: 'Procedimento', color: 'var(--color-success)' },
};

type Props = {
  memory: AgentMemory;
  onClose: () => void;
};

export function MemoryDetailPanel({ memory, onClose }: Props) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(memory.content);
  const [category, setCategory] = useState(memory.category);
  const [module, setModule] = useState(memory.module ?? '');
  const [importance, setImportance] = useState(memory.importance);
  const [status, setStatus] = useState(memory.status);

  useEffect(() => {
    setContent(memory.content);
    setCategory(memory.category);
    setModule(memory.module ?? '');
    setImportance(memory.importance);
    setStatus(memory.status);
  }, [memory]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMemoryAction(memory.id, {
        content,
        category,
        module: module || undefined,
        importance,
        status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memory'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMemoryAction(memory.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory'] });
      onClose();
    },
  });

  const typeConfig = memory.memory_type ? MEMORY_TYPE_CONFIG[memory.memory_type] : null;

  return (
    <div className="w-80 border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] p-[var(--space-5)] flex flex-col gap-[var(--space-4)] overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-2)]">
          {typeConfig && (
            <Badge style={{ background: typeConfig.color, color: 'var(--color-surface-0)' }}>
              {typeConfig.label}
            </Badge>
          )}
          <Badge
            style={{
              background: CATEGORY_COLORS[memory.category],
              color: 'var(--color-surface-0)',
            }}
          >
            {memory.category}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* L0 Abstract */}
      {memory.l0_abstract && (
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">
            L0 Abstract
          </span>
          <p className="text-xs text-[var(--color-text-secondary)] italic">{memory.l0_abstract}</p>
        </div>
      )}

      {/* Content */}
      <div>
        <span className="text-[11px] text-[var(--color-text-muted)] block mb-1">Conteúdo</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* L1 Overview */}
      {memory.l1_overview && (
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">
            L1 Overview
          </span>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {memory.l1_overview}
          </p>
        </div>
      )}

      {/* Category */}
      <div>
        <span className="text-[11px] text-[var(--color-text-muted)] block mb-1">Categoria</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as MemoryCategory)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Module */}
      <div>
        <span className="text-[11px] text-[var(--color-text-muted)] block mb-1">Módulo</span>
        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
        >
          <option value="">Nenhum</option>
          {MODULE_CONFIG.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Importance */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-[var(--color-text-muted)]">Importância</span>
          <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
            {importance}/10
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={importance}
          onChange={(e) => setImportance(Number(e.target.value))}
          className="w-full h-1 accent-[var(--color-accent)] cursor-pointer"
        />
      </div>

      {/* Status */}
      <div>
        <span className="text-[11px] text-[var(--color-text-muted)] block mb-1">Status</span>
        <div className="flex gap-[var(--space-1)]">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer',
                status === s
                  ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div className="border-t border-[var(--color-border-subtle)] pt-[var(--space-3)] space-y-1 text-[11px] text-[var(--color-text-muted)]">
        {memory.memory_type && (
          <p>Tipo: {MEMORY_TYPE_CONFIG[memory.memory_type]?.label ?? memory.memory_type}</p>
        )}
        {memory.path && <p>Path: {memory.path}</p>}
        <p>Confiança: {((memory.confidence ?? 1) * 100).toFixed(0)}%</p>
        <p>Acessos: {memory.access_count ?? 0}</p>
        {memory.mergeable !== undefined && <p>Mergeável: {memory.mergeable ? 'Sim' : 'Não'}</p>}
        <p>Criada: {new Date(memory.created_at).toLocaleDateString('pt-BR')}</p>
        {memory.last_accessed && (
          <p>Último acesso: {new Date(memory.last_accessed).toLocaleDateString('pt-BR')}</p>
        )}
        {memory.origin_session_id && (
          <p className="text-[var(--color-accent)]">
            Sessão: {memory.origin_session_id.slice(0, 8)}…
          </p>
        )}
        {memory.tags && memory.tags.length > 0 && <p>Tags: {memory.tags.join(', ')}</p>}
      </div>

      {/* Actions */}
      <div className="flex gap-[var(--space-2)] mt-auto">
        <Button
          size="sm"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" /> Arquivar
        </Button>
      </div>
    </div>
  );
}

export { CATEGORY_COLORS };
