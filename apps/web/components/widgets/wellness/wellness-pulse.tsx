'use client';

import { fetchDailySummary, fetchWeekStats } from '@/lib/actions/health';
import { fetchCombinedMood } from '@/lib/actions/spirituality';
import { useQuery } from '@tanstack/react-query';
import { Activity, Brain, Heart, Moon, TrendingUp } from 'lucide-react';

export default function WellnessPulseWidget() {
  const { data: dailyHealth } = useQuery({
    queryKey: ['health', 'daily-summary'],
    queryFn: () => fetchDailySummary(),
  });

  const { data: weekStats } = useQuery({
    queryKey: ['health', 'week-stats'],
    queryFn: () => fetchWeekStats(),
  });

  const { data: combinedMood } = useQuery({
    queryKey: ['spirituality', 'combined-mood'],
    queryFn: () => fetchCombinedMood(7),
    staleTime: 5 * 60 * 1000,
  });

  const moodValue = combinedMood ?? null;

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <MoodCard
          label="Humor"
          value={moodValue}
          icon={Heart}
          color="var(--color-danger)"
          maxValue={10}
        />
        <MoodCard
          label="Energia"
          value={dailyHealth?.energy ?? weekStats?.avg_energy ?? null}
          icon={TrendingUp}
          color="var(--color-warning)"
          maxValue={10}
        />
      </div>

      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <StatCard
          label="Sono"
          value={dailyHealth?.sleep_hours ?? weekStats?.avg_sleep_h ?? null}
          subtitle="hrs"
          icon={Moon}
          color="var(--color-accent)"
        />
        <StatCard
          label="Exercício"
          value={weekStats?.workouts_count ?? 0}
          subtitle={weekStats?.workouts_count === 1 ? 'x essa semana' : 'x essa semana'}
          icon={Activity}
          color="var(--color-success)"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]">
        <span className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          Bem-estar integrado
        </span>
      </div>
    </div>
  );
}

function MoodCard({
  label,
  value,
  icon: Icon,
  color,
  maxValue,
}: {
  label: string;
  value: number | null;
  icon: typeof Heart;
  color: string;
  maxValue: number;
}) {
  const displayValue = value ? Math.round(value) : '-';

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {displayValue}
        </span>
        <span className="text-xs text-[var(--color-text-muted)] mb-1">/{maxValue}</span>
      </div>
      {value !== null && (
        <div className="mt-2 h-1 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-[var(--duration-slow)]"
            style={{
              width: `${(value / maxValue) * 100}%`,
              background: color,
            }}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | null;
  subtitle: string;
  icon: typeof Moon;
  color: string;
}) {
  const displayValue = value !== null ? value : '-';

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {displayValue}
        </span>
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</span>
    </div>
  );
}
