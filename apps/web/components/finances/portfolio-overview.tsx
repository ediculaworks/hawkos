'use client';

import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton';
import { fetchPortfolioAllocation, fetchPortfolioPositions } from '@/lib/actions/finances';
import { CHART_COLORS } from '@/lib/utils/chart-colors';
import { formatCurrency } from '@/lib/utils/format';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

// ── Types ───────────────────────────────────────────────────

type Position = {
  asset_id: string;
  ticker: string;
  name: string;
  asset_class: string;
  currency: string;
  sector: string | null;
  quantity: number;
  total_cost: number;
  average_price: number;
  current_price: number | null;
  today_change_pct: number | null;
  current_value: number | null;
  price_date: string | null;
};

type Allocation = {
  asset_class: string;
  total_value: number;
  percentage: number;
};

// ── Constants ───────────────────────────────────────────────

const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: 'Ações',
  etf: 'ETFs',
  fii: 'FIIs',
  bdr: 'BDRs',
  crypto: 'Cripto',
  fixed_income: 'Renda Fixa',
  pension: 'Previdência',
  other: 'Outros',
};

const ALLOCATION_COLORS = CHART_COLORS;

// ── Sub-components ──────────────────────────────────────────

function PnlBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-mono ${positive ? 'text-green-400' : 'text-red-400'}`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}
      {pct.toFixed(2)}%
    </span>
  );
}

function PositionRow({ pos }: { pos: Position }) {
  const pnlAbs = pos.current_value !== null ? pos.current_value - pos.total_cost : null;
  const pnlPct = pos.total_cost > 0 && pnlAbs !== null ? (pnlAbs / pos.total_cost) * 100 : null;

  return (
    <tr className="border-b border-[var(--color-border-subtle)]/40 hover:bg-[var(--color-surface-2)]/50 transition-colors">
      {/* Ticker + name */}
      <td className="py-2.5 pl-3 pr-4">
        <div>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {pos.ticker}
          </span>
          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
            {ASSET_CLASS_LABELS[pos.asset_class] ?? pos.asset_class}
          </span>
        </div>
        <p
          className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px]"
          title={pos.name}
        >
          {pos.name}
        </p>
      </td>

      {/* Quantity */}
      <td className="py-2.5 px-3 text-right">
        <span className="text-xs font-mono text-[var(--color-text-secondary)]">
          {pos.quantity % 1 === 0 ? pos.quantity.toLocaleString('pt-BR') : pos.quantity.toFixed(4)}
        </span>
      </td>

      {/* Current price */}
      <td className="py-2.5 px-3 text-right">
        <span className="text-xs font-mono text-[var(--color-text-secondary)]">
          {pos.current_price !== null ? formatCurrency(pos.current_price) : '—'}
        </span>
      </td>

      {/* Current value */}
      <td className="py-2.5 px-3 text-right">
        <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">
          {pos.current_value !== null ? formatCurrency(pos.current_value) : '—'}
        </span>
      </td>

      {/* P&L% */}
      <td className="py-2.5 pl-3 pr-3 text-right">
        <PnlBadge pct={pnlPct} />
      </td>
    </tr>
  );
}

function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-sm text-center text-[var(--color-text-muted)] py-8">
        Nenhuma posição registrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)]">
            <th className="pb-2 pl-3 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              Ativo
            </th>
            <th className="pb-2 px-3 text-right text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              Qtd.
            </th>
            <th className="pb-2 px-3 text-right text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              Preço atual
            </th>
            <th className="pb-2 px-3 text-right text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              Valor
            </th>
            <th className="pb-2 pl-3 pr-3 text-right text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              P&L
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <PositionRow key={pos.asset_id} pos={pos} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllocationDonut({ allocation }: { allocation: Allocation[] }) {
  if (allocation.length === 0) {
    return (
      <p className="text-sm text-center text-[var(--color-text-muted)] py-6">
        Sem dados de alocação.
      </p>
    );
  }

  const chartData = allocation.map((a) => ({
    name: ASSET_CLASS_LABELS[a.asset_class] ?? a.asset_class,
    value: a.total_value,
    pct: a.percentage,
  }));

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-3 px-3">
        Alocação por classe
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable allocation order
              <Cell key={`cell-${i}`} fill={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => {
              const num = typeof value === 'number' ? value : 0;
              return [`R$ ${num.toFixed(2)}`, 'Valor'] as [string, string];
            }}
            contentStyle={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--color-text-primary)',
            }}
            itemStyle={{ color: 'var(--color-text-primary)' }}
            labelStyle={{ color: 'var(--color-text-muted)' }}
          />
          <Legend
            formatter={(value, entry) => {
              const payload = entry?.payload as { pct?: number } | undefined;
              return (
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  {value} {payload?.pct !== undefined ? `(${payload.pct.toFixed(1)}%)` : ''}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export function PortfolioOverview() {
  const { data: positions, isLoading: posLoading } = useQuery({
    queryKey: ['finances', 'portfolio-positions'],
    queryFn: () => fetchPortfolioPositions() as Promise<Position[]>,
  });

  const { data: allocation, isLoading: allocLoading } = useQuery({
    queryKey: ['finances', 'portfolio-allocation'],
    queryFn: () => fetchPortfolioAllocation() as Promise<Allocation[]>,
  });

  const totalValue = (positions ?? []).reduce((s, p) => s + (p.current_value ?? 0), 0);
  const totalCost = (positions ?? []).reduce((s, p) => s + p.total_cost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  if (posLoading || allocLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex gap-6 px-3 py-3 border-b border-[var(--color-border-subtle)]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="space-y-2 px-3">
          {Array.from({ length: 4 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton list
            <div key={`psk-${i}`} className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-32" />
              </div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
        {/* Donut skeleton */}
        <div className="px-3">
          <ChartSkeleton height={220} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="flex items-center gap-6 px-3 py-3 border-b border-[var(--color-border-subtle)]">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Valor total
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {formatCurrency(totalValue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Custo total
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {formatCurrency(totalCost)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            P&L total
          </p>
          <div className="flex items-center gap-1.5">
            <p
              className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {totalPnl >= 0 ? '+' : ''}
              {formatCurrency(totalPnl)}
            </p>
            <PnlBadge pct={totalPnlPct} />
          </div>
        </div>
        <div className="ml-auto">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
            Posições
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {(positions ?? []).length}
          </p>
        </div>
      </div>

      {/* Positions table */}
      <PositionsTable positions={positions ?? []} />

      {/* Allocation donut */}
      {(allocation ?? []).length > 0 && (
        <div className="pt-2 border-t border-[var(--color-border-subtle)]">
          <AllocationDonut allocation={allocation ?? []} />
        </div>
      )}
    </div>
  );
}
