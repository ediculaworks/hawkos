'use client';

import { fetchUsageHistory } from '@/lib/actions/usage';
import type { DailyUsageEntry } from '@/lib/actions/usage';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingDown, TrendingUp, Zap } from 'lucide-react';

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

function CostBar({ entries, maxCost }: { entries: DailyUsageEntry[]; maxCost: number }) {
  return (
    <div className="flex items-end gap-[2px] h-16">
      {entries.map((entry) => {
        const height = maxCost > 0 ? (entry.cost / maxCost) * 100 : 0;
        const day = entry.date.slice(8, 10);
        return (
          <div key={entry.date} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-[var(--color-accent)] min-h-[2px] transition-all"
              style={{ height: `${Math.max(height, 3)}%` }}
              title={`${entry.date}: ${formatCost(entry.cost)} (${formatTokens(entry.tokens)} tokens)`}
            />
            <span className="text-[8px] text-[var(--color-text-muted)]">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CostHistoryWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['usage', 'history'],
    queryFn: () => fetchUsageHistory(14),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-[var(--space-2)] p-[var(--space-2)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        ))}
      </div>
    );
  }

  const entries = data ?? [];
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-xs">
        Sem dados de uso ainda
      </div>
    );
  }

  const totalCost = entries.reduce((sum, e) => sum + Number(e.cost), 0);
  const totalTokens = entries.reduce((sum, e) => sum + Number(e.tokens), 0);
  const avgDaily = totalCost / entries.length;
  const maxCost = Math.max(...entries.map((e) => Number(e.cost)));

  // Compare last 7 days vs previous 7
  const recent = entries.slice(-7);
  const previous = entries.slice(0, -7);
  const recentCost = recent.reduce((s, e) => s + Number(e.cost), 0);
  const previousCost = previous.reduce((s, e) => s + Number(e.cost), 0);
  const trend = previousCost > 0 ? ((recentCost - previousCost) / previousCost) * 100 : 0;

  return (
    <div className="flex h-full flex-col gap-[var(--space-3)] overflow-y-auto p-[var(--space-2)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <div className="flex items-center gap-[var(--space-2)] rounded-lg bg-[var(--color-surface-2)] p-[var(--space-2)]">
          <DollarSign className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Total ({entries.length}d)</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">{formatCost(totalCost)}</p>
          </div>
        </div>
        <div className="flex items-center gap-[var(--space-2)] rounded-lg bg-[var(--color-surface-2)] p-[var(--space-2)]">
          <Zap className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Tokens total</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">{formatTokens(totalTokens)}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Custo diário
          </p>
          {trend !== 0 && (
            <span className={`flex items-center gap-0.5 text-[10px] ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {trend > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
        <CostBar entries={entries} maxCost={maxCost} />
      </div>

      <div className="text-[10px] text-[var(--color-text-muted)]">
        Média: {formatCost(avgDaily)}/dia
      </div>
    </div>
  );
}
