'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDailySummary } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Activity, Brain, Cigarette, Moon, Scale, Utensils } from 'lucide-react';

export function DailyPulse() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['health', 'daily-summary'],
    queryFn: fetchDailySummary,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[var(--color-surface-3)] rounded w-1/3" />
            <div className="h-8 bg-[var(--color-surface-3)] rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      icon: Moon,
      label: 'Sono',
      value: summary?.sleep_hours ? `${summary.sleep_hours}h` : '--',
      subtext: summary?.sleep_quality ? `Qualidade: ${summary.sleep_quality}/10` : 'Não registrado',
      color: 'var(--color-mod-health)',
    },
    {
      icon: Activity,
      label: 'Treino',
      value: summary?.exercised ? (summary.workout_type ?? 'Sim') : 'Nenhum',
      subtext: summary?.workout_min ? `${summary.workout_min} min` : '',
      color: 'var(--color-success)',
    },
    {
      icon: Scale,
      label: 'Peso',
      value: summary?.weight_kg ? `${summary.weight_kg} kg` : '--',
      subtext: 'Última pesagem',
      color: 'var(--color-accent)',
    },
    {
      icon: Brain,
      label: 'Humor',
      value: summary?.mood ? `${summary.mood}/10` : '--',
      subtext: summary?.energy ? `Energia: ${summary.energy}/10` : '',
      color: 'var(--color-warning)',
    },
    {
      icon: Utensils,
      label: 'Calorias',
      value: summary?.calories_total ? `${summary.calories_total} kcal` : '--',
      subtext: 'Hoje',
      color: 'var(--color-mod-finances)',
    },
    {
      icon: Cigarette,
      label: 'Cannabis',
      value: summary?.cannabis_g ? `${summary.cannabis_g}g` : '0g',
      subtext: summary?.substance_cost ? `R$${summary.substance_cost.toFixed(2)}` : '',
      color: 'var(--color-mod-routine)',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Hoje</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
            >
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                <span className="text-xs text-[var(--color-text-muted)]">{stat.label}</span>
              </div>
              <span className="text-lg font-semibold text-[var(--color-text-primary)]">
                {stat.value}
              </span>
              {stat.subtext && (
                <span className="text-xs text-[var(--color-text-muted)]">{stat.subtext}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
