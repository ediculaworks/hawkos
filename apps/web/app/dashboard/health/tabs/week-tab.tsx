'use client';
import { WorkoutHistory as WorkoutHistoryComponent } from '@/components/health/workout-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { removeSleepSession } from '@/lib/actions/health';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon } from 'lucide-react';
import toast from 'react-hot-toast';

type DateRange = '7d' | '14d' | '30d' | '90d';

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

export default function WeekTab({ dateRange }: { dateRange: DateRange }) {
  const days = DATE_RANGE_DAYS[dateRange];
  const { data: weekStats } = useQuery({
    queryKey: ['health', 'week-stats'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchWeekStats()),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-6)]">
      <div className="lg:col-span-2">
        <SleepChart days={days} />
      </div>
      <div className="space-y-[var(--space-6)]">
        <WeekSummary stats={weekStats} />
      </div>
      <div className="lg:col-span-3">
        <WorkoutHistoryComponent />
      </div>
    </div>
  );
}

function WeekSummary({
  stats,
}: {
  stats?: {
    avg_sleep_h: number | null;
    workouts_count: number;
    avg_mood: number | null;
    avg_energy: number | null;
    cannabis_days: number;
    med_adherence_pct: number | null;
  };
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Resumo da Semana</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Sono médio</span>
            <span className="text-sm font-medium">{stats?.avg_sleep_h ?? '--'}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Treinos</span>
            <span className="text-sm font-medium">{stats?.workouts_count ?? 0}/7 dias</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Humor médio</span>
            <span className="text-sm font-medium">{stats?.avg_mood ?? '--'}/10</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Energia média</span>
            <span className="text-sm font-medium">{stats?.avg_energy ?? '--'}/10</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">Adesão meds</span>
            <span className="text-sm font-medium">
              {stats?.med_adherence_pct != null ? `${stats.med_adherence_pct}%` : '--'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SleepChart({ days = 14 }: { days?: number }) {
  const queryClient = useQueryClient();

  const { data: sleepData, isLoading } = useQuery({
    queryKey: ['health', 'sleep', days],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchRecentSleep(days)),
  });

  const deleteMutation = useMutation({
    mutationFn: removeSleepSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'sleep'] });
      toast.success('Registro de sono removido!');
    },
    onError: (err: Error) => toast.error(`Erro ao remover sono: ${err.message}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-48 bg-[var(--color-surface-2)] rounded" />
        </CardContent>
      </Card>
    );
  }

  const sessions = (sleepData ?? []).slice(0, days).reverse();
  const avgHours =
    sessions.length > 0
      ? (sessions.reduce((sum, s) => sum + (s.duration_h ?? 0), 0) / sessions.length).toFixed(1)
      : '0';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Sono - {days} dias
          </CardTitle>
          <span className="text-sm text-[var(--color-text-muted)]">Média: {avgHours}h</span>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length > 0 ? (
          <div className="space-y-1.5">
            {sessions.map((s) => {
              const hours = s.duration_h ?? 0;
              const dateLabel = new Date(s.date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              });
              return (
                <div key={s.id} className="flex items-center gap-3 group">
                  <span className="text-xs text-[var(--color-text-muted)] w-10 flex-shrink-0">
                    {dateLabel}
                  </span>
                  <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-mod-health)] rounded-full"
                      style={{ width: `${Math.min((hours / 12) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] w-10 flex-shrink-0 text-right">
                    {hours}h
                  </span>
                  <RecordActions onDelete={() => deleteMutation.mutate(s.id)} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[var(--color-text-muted)]">
            Sem dados de sono registrados
          </div>
        )}
      </CardContent>
    </Card>
  );
}
