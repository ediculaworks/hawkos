'use client';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { fetchMemories, fetchMemoryStats } from '@/lib/actions/memory';
import { MODULE_CONFIG } from '@/lib/modules';
import { cn } from '@/lib/utils/cn';
import type { AgentMemory, MemoryStatus, MemoryType } from '@hawk/module-memory/types';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  Flame,
  Heart,
  Repeat,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';

// ── Type config ────────────────────────────────────────────

const MEMORY_TYPE_CONFIG: Record<MemoryType, { label: string; color: string; icon: typeof Brain }> =
  {
    profile: { label: 'Perfil', color: 'var(--color-accent)', icon: User },
    preference: { label: 'Preferência', color: 'var(--color-mod-entertainment)', icon: Heart },
    entity: { label: 'Entidade', color: 'var(--color-mod-people)', icon: Users },
    event: { label: 'Evento', color: 'var(--color-mod-calendar)', icon: CalendarDays },
    case: { label: 'Caso', color: 'var(--color-danger)', icon: AlertTriangle },
    pattern: { label: 'Padrão', color: 'var(--color-warning)', icon: Repeat },
    procedure: { label: 'Procedimento', color: 'var(--color-success)', icon: Settings },
  };

// ── Helpers ────────────────────────────────────────────────

function importanceColor(importance: number): string {
  if (importance >= 7) return 'var(--color-warning)';
  if (importance >= 4) return 'var(--color-accent)';
  return 'var(--color-text-muted)';
}

function formatRelativeDate(iso: string): string {
  const now = Date.now();
  const ts = new Date(iso).getTime();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m atrás`;
  return `${Math.floor(diffDays / 365)}a atrás`;
}

// ── Stat card ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)]">
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          'text-lg font-semibold block',
          warning ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-primary)]',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── Memory type badge ──────────────────────────────────────

function TypeBadge({ type }: { type: MemoryType }) {
  const config = MEMORY_TYPE_CONFIG[type] ?? MEMORY_TYPE_CONFIG.profile;
  const TypeIcon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-full)]"
      style={{
        color: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
      }}
    >
      <TypeIcon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

// ── Importance bar ─────────────────────────────────────────

function ImportanceBar({ importance }: { importance: number }) {
  const clampedImportance = Math.max(1, Math.min(10, importance));
  const widthPct = (clampedImportance / 10) * 100;
  const color = importanceColor(clampedImportance);

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums" style={{ color }}>
        {clampedImportance}/10
      </span>
    </div>
  );
}

// ── Memory card ────────────────────────────────────────────

function MemoryCard({
  memory,
  selected,
  onSelect,
}: {
  memory: AgentMemory;
  selected: boolean;
  onSelect: () => void;
}) {
  // Hotness: sigmoid-inspired opacity from access_count. 0 = 0%, 10+ = full.
  const hotnessOpacity = Math.min(1, memory.access_count / 10);
  const moduleConfig = MODULE_CONFIG.find((m) => m.id === memory.module);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-[var(--radius-md)] border transition-all duration-150 cursor-pointer group',
        'bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]',
        selected
          ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]'
          : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-subtle)]',
      )}
    >
      <div className="px-[var(--space-3)] py-[var(--space-3)]">
        {/* Top row: content + flame */}
        <div className="flex items-start gap-[var(--space-2)] mb-[var(--space-2)]">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--color-text-primary)] line-clamp-3 leading-relaxed">
              {memory.content}
            </p>
            {memory.l0_abstract && memory.l0_abstract !== memory.content && (
              <p className="text-[10px] italic text-[var(--color-text-muted)] mt-1 line-clamp-1">
                {memory.l0_abstract}
              </p>
            )}
          </div>
          {/* Hotness flame */}
          {memory.access_count > 0 && (
            <Flame
              className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 transition-opacity"
              style={{
                color: 'var(--color-warning)',
                opacity: hotnessOpacity,
              }}
            />
          )}
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1 mb-[var(--space-2)]">
          <TypeBadge type={memory.memory_type} />

          {moduleConfig && (
            <span
              className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--radius-full)]"
              style={{
                color: moduleConfig.colorVar,
                backgroundColor: `color-mix(in srgb, ${moduleConfig.colorVar} 12%, transparent)`,
              }}
            >
              {moduleConfig.label}
            </span>
          )}

          {!moduleConfig && memory.module && (
            <span className="text-[10px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface-2)]">
              {memory.module}
            </span>
          )}

          {memory.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface-2)]"
            >
              #{tag}
            </span>
          ))}
          {(memory.tags?.length ?? 0) > 3 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              +{memory.tags.length - 3}
            </span>
          )}
        </div>

        {/* Meta row: importance + access count + timestamps */}
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <ImportanceBar importance={memory.importance} />

          <div className="flex items-center gap-[var(--space-2)] flex-shrink-0">
            {memory.access_count > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                {memory.access_count}× acesso
              </span>
            )}
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {formatRelativeDate(memory.created_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Select ─────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
    >
      {children}
    </select>
  );
}

// ── Stat skeleton ──────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-[var(--radius-md)] bg-[var(--color-surface-1)] px-[var(--space-3)] py-[var(--space-2)] animate-pulse"
        >
          <div className="h-2 w-16 bg-[var(--color-surface-3)] rounded mb-2" />
          <div className="h-5 w-10 bg-[var(--color-surface-3)] rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────

export function MemoryExplorer({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (memory: AgentMemory) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MemoryType | ''>('');
  const [filterModule, setFilterModule] = useState('');
  const [filterStatus, setFilterStatus] = useState<MemoryStatus | ''>('active');
  const [sort, setSort] = useState<'created_at' | 'importance' | 'access_count' | 'last_accessed'>(
    'created_at',
  );

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: fetchMemoryStats,
  });

  // Memory list query
  const { data: memories, isLoading: memoriesLoading } = useQuery({
    queryKey: [
      'memory',
      'list',
      { type: filterType, module: filterModule, status: filterStatus, sort, search },
    ],
    queryFn: () =>
      fetchMemories({
        memory_type: filterType || undefined,
        module: filterModule || undefined,
        status: filterStatus || undefined,
        sort,
        limit: 100,
      }),
  });

  // Client-side search filter (server full-text search would be separate)
  const filteredMemories = memories?.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.content.toLowerCase().includes(q) ||
      m.l0_abstract?.toLowerCase().includes(q) ||
      m.tags?.some((t) => t.toLowerCase().includes(q)) ||
      m.module?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-4 gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)]">
          <StatCard label="Total ativas" value={stats?.by_status?.active ?? 0} />
          <StatCard label="Esta semana" value={stats?.this_week ?? 0} />
          <StatCard
            label="Importância média"
            value={stats?.avg_importance != null ? stats.avg_importance.toFixed(1) : '—'}
          />
          <StatCard
            label="Pendentes"
            value={stats?.pending_count ?? 0}
            warning={(stats?.pending_count ?? 0) > 0}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-[var(--space-2)] top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar memórias..."
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] pl-7 pr-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Type dropdown */}
        <FilterSelect value={filterType} onChange={(v) => setFilterType(v as MemoryType | '')}>
          <option value="">Todos os tipos</option>
          {(
            Object.entries(MEMORY_TYPE_CONFIG) as [
              MemoryType,
              (typeof MEMORY_TYPE_CONFIG)[MemoryType],
            ][]
          ).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </FilterSelect>

        {/* Module dropdown */}
        <FilterSelect value={filterModule} onChange={setFilterModule}>
          <option value="">Todos os módulos</option>
          {MODULE_CONFIG.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </FilterSelect>

        {/* Status dropdown */}
        <FilterSelect
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as MemoryStatus | '')}
        >
          <option value="">Status</option>
          <option value="active">Ativa</option>
          <option value="pending">Pendente</option>
          <option value="archived">Arquivada</option>
        </FilterSelect>

        {/* Sort dropdown */}
        <FilterSelect
          value={sort}
          onChange={(v) =>
            setSort(v as 'created_at' | 'importance' | 'access_count' | 'last_accessed')
          }
        >
          <option value="created_at">Recência</option>
          <option value="importance">Importância</option>
          <option value="access_count">Acessos</option>
          <option value="last_accessed">Último acesso</option>
        </FilterSelect>
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto px-[var(--space-4)] py-[var(--space-3)] space-y-[var(--space-2)]">
        {memoriesLoading && !memories ? (
          <ListSkeleton items={7} />
        ) : !filteredMemories || filteredMemories.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="Nenhuma memória encontrada"
            description={
              search
                ? `Nenhum resultado para "${search}". Tente outros termos.`
                : filterType || filterModule || filterStatus
                  ? 'Nenhuma memória corresponde aos filtros ativos.'
                  : 'O agente ainda não salvou memórias. Use o chat para começar.'
            }
          />
        ) : (
          <>
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                selected={selectedId === memory.id}
                onSelect={() => onSelect(memory)}
              />
            ))}
            <p className="text-center text-[10px] text-[var(--color-text-muted)] pt-[var(--space-2)] pb-[var(--space-1)]">
              {filteredMemories.length} memória{filteredMemories.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
