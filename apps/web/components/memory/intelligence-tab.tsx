'use client';
import { Card, CardContent } from '@/components/ui/card';
import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton';
import {
  fetchAdaptiveHalfLives,
  fetchMemoryDistributions,
  fetchMemoryStats,
  fetchMemoryTimeline,
} from '@/lib/actions/memory';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Brain, Clock, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ── Color palettes ──────────────────────────────────────────

const MEMORY_TYPE_COLORS: Record<string, string> = {
  profile: '#3b82f6',
  preference: '#a855f7',
  entity: '#ec4899',
  event: '#22c55e',
  case: '#ef4444',
  pattern: '#f59e0b',
  procedure: '#06b6d4',
};

const MEMORY_TYPE_LABELS: Record<string, string> = {
  profile: 'Perfil',
  preference: 'Preferência',
  entity: 'Entidade',
  event: 'Evento',
  case: 'Caso',
  pattern: 'Padrão',
  procedure: 'Procedimento',
};

const MODULE_COLORS: Record<string, string> = {
  finances: '#4ade80',
  calendar: '#60a5fa',
  routine: '#c084fc',
  journal: '#fbbf24',
  objectives: '#34d399',
  health: '#f87171',
  people: '#f472b6',
  career: '#2dd4bf',
  legal: '#a78bfa',
  knowledge: '#facc15',
  assets: '#86efac',
  housing: '#6ee7b7',
  security: '#93c5fd',
  entertainment: '#fb923c',
  social: '#818cf8',
  spirituality: '#fcd34d',
};

function moduleColor(mod: string): string {
  return MODULE_COLORS[mod] ?? '#6b7280';
}

// ── Tooltip ──────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] shadow-lg border border-[var(--color-border-subtle)]">
      {label && <p className="text-[var(--color-text-muted)]">{label}</p>}
      <p className="font-medium">{payload?.[0]?.value}</p>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-[var(--space-4)]">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-[var(--space-1)]">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                {value}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] flex items-center justify-center">
            <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chart card wrapper ───────────────────────────────────────

function ChartCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-[var(--space-4)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-[var(--space-3)] block">
          {title}
        </span>
        <div style={{ width: '100%', height: 200 }}>
          {loading ? (
            <ChartSkeleton height={200} />
          ) : (
            <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty chart state ─────────────────────────────────────────

function EmptyChart({ message = 'Sem dados' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-[var(--color-text-muted)]">{message}</p>
    </div>
  );
}

// ── Timeline chart ──────────────────────────────────────────

function TimelineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) return <EmptyChart />;

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <AreaChart data={formatted}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
          <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
      />
      <YAxis
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        width={28}
      />
      <Tooltip content={<ChartTooltip />} />
      <Area
        type="monotone"
        dataKey="count"
        stroke="var(--color-accent)"
        strokeWidth={2}
        fill="url(#areaGrad)"
        dot={false}
        activeDot={{ r: 4, fill: 'var(--color-accent)' }}
      />
    </AreaChart>
  );
}

// ── Pie chart — type distribution ──────────────────────────

function TypePieChart({
  data,
}: { data: Array<{ name: string; value: number; color: string; label: string }> }) {
  if (data.length === 0) return <EmptyChart />;

  return (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="45%"
        outerRadius={72}
        innerRadius={36}
        dataKey="value"
        paddingAngle={2}
      >
        {data.map((entry) => (
          <Cell key={entry.name} fill={entry.color} opacity={0.9} />
        ))}
      </Pie>
      <Tooltip
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload?.[0]?.payload as { label: string; value: number } | undefined;
          if (!d) return null;
          return (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] shadow-lg border border-[var(--color-border-subtle)]">
              <p className="text-[var(--color-text-muted)]">{d.label}</p>
              <p className="font-medium">{d.value}</p>
            </div>
          );
        }}
      />
    </PieChart>
  );
}

// ── Legend for pie chart ────────────────────────────────────

function TypeLegend({
  data,
}: { data: Array<{ name: string; label: string; color: string; value: number }> }) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-2 gap-x-[var(--space-3)] gap-y-[var(--space-1)] mt-[var(--space-3)]">
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-[var(--space-1-5)] min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
          <span className="text-[10px] text-[var(--color-text-muted)] truncate">{d.label}</span>
          <span className="text-[10px] text-[var(--color-text-secondary)] font-mono ml-auto flex-shrink-0">
            {total > 0 ? Math.round((d.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal bar — module distribution ───────────────────

function ModuleBarChart({ data }: { data: Array<{ module: string; count: number }> }) {
  if (data.length === 0) return <EmptyChart />;

  return (
    <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
      <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" horizontal={false} />
      <XAxis
        type="number"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey="module"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        width={72}
      />
      <Tooltip content={<ChartTooltip />} />
      <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={14}>
        {data.map((entry) => (
          <Cell key={entry.module} fill={moduleColor(entry.module)} opacity={0.85} />
        ))}
      </Bar>
    </BarChart>
  );
}

// ── Half-lives bar chart ────────────────────────────────────

function HalfLivesChart({ data }: { data: Array<{ module: string; days: number }> }) {
  if (data.length === 0) return <EmptyChart />;

  return (
    <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }}>
      <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" horizontal={false} />
      <XAxis
        type="number"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        unit="d"
      />
      <YAxis
        type="category"
        dataKey="module"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        width={72}
      />
      <Tooltip
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-[var(--space-2)] py-[var(--space-1)] text-xs text-[var(--color-text-primary)] shadow-lg border border-[var(--color-border-subtle)]">
              <p className="text-[var(--color-text-muted)]">{label}</p>
              <p className="font-medium">{payload?.[0]?.value} dias</p>
            </div>
          );
        }}
      />
      <Bar dataKey="days" radius={[0, 3, 3, 0]} maxBarSize={14}>
        {data.map((entry) => (
          <Cell key={entry.module} fill={moduleColor(entry.module)} opacity={0.7} />
        ))}
      </Bar>
    </BarChart>
  );
}

// ── Main component ──────────────────────────────────────────

export function IntelligenceTab() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: fetchMemoryStats,
    staleTime: 5 * 60 * 1000,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['memory', 'intelligence', 'timeline'],
    queryFn: () => fetchMemoryTimeline(30),
    staleTime: 5 * 60 * 1000,
  });

  const { data: distributions, isLoading: distLoading } = useQuery({
    queryKey: ['memory', 'intelligence', 'distributions'],
    queryFn: fetchMemoryDistributions,
    staleTime: 5 * 60 * 1000,
  });

  const { data: halfLives, isLoading: halfLivesLoading } = useQuery({
    queryKey: ['memory', 'intelligence', 'half-lives'],
    queryFn: fetchAdaptiveHalfLives,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived data ──────────────────────────────────────────

  const typeChartData = Object.entries(distributions?.byType ?? {})
    .map(([name, value]) => ({
      name,
      value,
      color: MEMORY_TYPE_COLORS[name] ?? '#6b7280',
      label: MEMORY_TYPE_LABELS[name] ?? name,
    }))
    .sort((a, b) => b.value - a.value);

  const moduleBarData = Object.entries(distributions?.byModule ?? {})
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const halfLivesData = Object.entries(halfLives ?? {})
    .filter(([mod]) => mod !== 'default' && mod !== 'procedure')
    .map(([module, days]) => ({ module, days: Math.round(days) }))
    .sort((a, b) => a.days - b.days);

  return (
    <div className="overflow-y-auto px-[var(--space-4)] py-[var(--space-4)] space-y-[var(--space-5)]">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[var(--space-3)]">
        <StatCard
          icon={Brain}
          label="Total memórias"
          value={stats?.total ?? 0}
          loading={statsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Esta semana"
          value={stats?.this_week ?? 0}
          loading={statsLoading}
        />
        <StatCard
          icon={BarChart3}
          label="Importância média"
          value={stats?.avg_importance ?? '—'}
          loading={statsLoading}
        />
        <StatCard
          icon={Clock}
          label="Pendentes"
          value={stats?.pending_count ?? 0}
          loading={statsLoading}
        />
      </div>

      {/* Charts row 1: timeline + type distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-4)]">
        <ChartCard title="Memórias ao longo do tempo (30d)" loading={timelineLoading}>
          <TimelineChart data={timeline ?? []} />
        </ChartCard>

        <Card>
          <CardContent className="pt-[var(--space-4)]">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-[var(--space-3)] block">
              Distribuição por tipo
            </span>
            {distLoading ? (
              <ChartSkeleton height={200} />
            ) : typeChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-xs text-[var(--color-text-muted)]">Sem dados</p>
              </div>
            ) : (
              <>
                <div style={{ width: '100%', height: 150 }}>
                  <ResponsiveContainer>
                    <TypePieChart data={typeChartData} />
                  </ResponsiveContainer>
                </div>
                <TypeLegend data={typeChartData} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: module distribution + adaptive half-lives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-4)]">
        <ChartCard title="Distribuição por módulo" loading={distLoading}>
          <ModuleBarChart data={moduleBarData} />
        </ChartCard>

        <ChartCard title="Decaimento por módulo (dias)" loading={halfLivesLoading}>
          <HalfLivesChart data={halfLivesData} />
        </ChartCard>
      </div>
    </div>
  );
}
