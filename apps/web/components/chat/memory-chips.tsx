'use client';

import type { PendingMemory } from '@/lib/agent-chat';
import { Brain, X } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  profile: 'Perfil',
  preference: 'Preferência',
  entity: 'Entidade',
  event: 'Evento',
  case: 'Correção',
  pattern: 'Padrão',
  procedure: 'Regra',
};

const TYPE_COLORS: Record<string, string> = {
  profile: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  preference: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  entity: 'bg-green-500/10 text-green-400 border-green-500/20',
  event: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  case: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pattern: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  procedure: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface MemoryChipsProps {
  memories: PendingMemory[];
  onDismiss: (id: string) => void;
}

export function MemoryChips({ memories, onDismiss }: MemoryChipsProps) {
  if (memories.length === 0) return null;

  return (
    <div className="px-6 py-2 flex flex-wrap gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/40">
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] flex-shrink-0 self-center">
        <Brain className="h-3 w-3" />
        <span>Aprendi:</span>
      </div>
      {memories.map((mem) => {
        const colorClass =
          TYPE_COLORS[mem.memory_type] ??
          'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border-[var(--color-border)]';
        const label = TYPE_LABELS[mem.memory_type] ?? mem.memory_type;

        return (
          <div
            key={mem.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${colorClass} max-w-[280px]`}
          >
            <span className="font-medium flex-shrink-0">{label}</span>
            <span className="truncate opacity-80">{mem.content}</span>
            <button
              type="button"
              onClick={() => onDismiss(mem.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer ml-0.5"
              title="Dispensar"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
