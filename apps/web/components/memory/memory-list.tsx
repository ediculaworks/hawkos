'use client';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { fetchMemories, searchMemoriesAction } from '@/lib/actions/memory';
import { cn } from '@/lib/utils/cn';
import type { AgentMemory, MemoryCategory } from '@hawk/module-memory/types';
import { useQuery } from '@tanstack/react-query';
import { Search, Zap } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_COLORS } from './memory-detail-panel';

type Props = {
  selectedId: string | null;
  onSelect: (memory: AgentMemory) => void;
};

const CATEGORY_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  preference: 'default',
  fact: 'success',
  pattern: 'warning',
  insight: 'default',
  correction: 'danger',
  goal: 'default',
  relationship: 'muted',
};

export function MemoryList({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<MemoryCategory | ''>('');

  const { data: memories, isLoading: memoriesLoading } = useQuery({
    queryKey: ['memory', 'list', filterCategory, search],
    queryFn: () => {
      if (search.trim()) return searchMemoriesAction(search);
      return fetchMemories({
        status: 'active',
        category: filterCategory || undefined,
        limit: 100,
      });
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
        <div className="relative">
          <Search className="absolute left-[var(--space-3)] top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar memórias..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] pl-9 pr-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="flex gap-1 mt-[var(--space-2)] flex-wrap">
          <FilterChip
            label="Todas"
            active={!filterCategory}
            onClick={() => setFilterCategory('')}
          />
          <FilterChip
            label="Fatos"
            active={filterCategory === 'fact'}
            onClick={() => setFilterCategory('fact')}
          />
          <FilterChip
            label="Preferências"
            active={filterCategory === 'preference'}
            onClick={() => setFilterCategory('preference')}
          />
          <FilterChip
            label="Padrões"
            active={filterCategory === 'pattern'}
            onClick={() => setFilterCategory('pattern')}
          />
          <FilterChip
            label="Insights"
            active={filterCategory === 'insight'}
            onClick={() => setFilterCategory('insight')}
          />
          <FilterChip
            label="Correções"
            active={filterCategory === 'correction'}
            onClick={() => setFilterCategory('correction')}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {memoriesLoading && !memories ? (
          <div className="p-[var(--space-4)]">
            <ListSkeleton items={6} />
          </div>
        ) : !memories || memories.length === 0 ? (
          <div className="p-[var(--space-4)]">
            <EmptyState
              icon={Zap}
              title="Nenhuma memória encontrada"
              description="Use o chat para adicionar memórias ao seu perfil"
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {memories.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m)}
                className={cn(
                  'w-full text-left px-[var(--space-4)] py-[var(--space-3)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer',
                  selectedId === m.id && 'bg-[var(--color-surface-2)]',
                )}
              >
                <div className="flex items-start gap-[var(--space-2)]">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[m.category as MemoryCategory] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">
                      {m.content}
                    </p>
                    <div className="flex items-center gap-[var(--space-2)] mt-1">
                      <Badge variant={CATEGORY_VARIANT[m.category] ?? 'muted'}>{m.category}</Badge>
                      {m.module && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {m.module}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-warning)]">
                        <Zap className="h-2.5 w-2.5" />
                        {m.importance}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-0.5 rounded-[var(--radius-full)] text-[11px] font-medium transition-colors cursor-pointer',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
          : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
      )}
    >
      {label}
    </button>
  );
}
