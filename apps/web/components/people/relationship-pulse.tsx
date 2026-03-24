'use client';
import type { NetworkStats } from '@hawk/module-people/types';

type Props = {
  stats: NetworkStats;
};

export function RelationshipPulse({ stats }: Props) {
  return (
    <div className="space-y-[var(--space-3)]">
      <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        Saúde da rede
      </span>
      <div className="space-y-[var(--space-2)]">
        <PulseRow label="Contatos ativos" value={String(stats.active_contacts)} />
        <PulseRow
          label="Pendentes"
          value={String(stats.overdue_count)}
          highlight={stats.overdue_count > 0}
        />
        <PulseRow
          label="Taxa de contato"
          value={`${Math.round(stats.contact_rate * 100)}%`}
          highlight={stats.contact_rate < 0.6}
        />
        <PulseRow label="Interações/semana" value={String(stats.interactions_last_7d)} />
        <PulseRow
          label="Sentimento"
          value={
            stats.avg_sentiment > 0
              ? `+${stats.avg_sentiment.toFixed(1)}`
              : stats.avg_sentiment.toFixed(1)
          }
          color={
            stats.avg_sentiment > 0
              ? 'var(--color-success)'
              : stats.avg_sentiment < 0
                ? 'var(--color-danger)'
                : undefined
          }
        />
      </div>
    </div>
  );
}

function PulseRow({
  label,
  value,
  highlight,
  color,
}: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-[var(--color-text-muted)]">{label}</span>
      <span
        className="text-xs font-mono"
        style={{
          color: color ?? (highlight ? 'var(--color-danger)' : 'var(--color-text-primary)'),
        }}
      >
        {value}
      </span>
    </div>
  );
}
