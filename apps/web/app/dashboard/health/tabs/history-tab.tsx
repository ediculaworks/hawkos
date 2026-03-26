'use client';

import { WeightChart } from '@/components/health/weight-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { removeSleepSession } from '@/lib/actions/health';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, FileText, Moon, Scale } from 'lucide-react';
import toast from 'react-hot-toast';

type DateRange = '7d' | '14d' | '30d' | '90d';

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

export default function HistoryTab({ dateRange }: { dateRange: DateRange }) {
  const days = DATE_RANGE_DAYS[dateRange];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--space-6)]">
      <div className="lg:col-span-2">
        <SleepChart days={days} />
      </div>
      <div className="space-y-[var(--space-6)]">
        <ConditionsList />
        <LabsList />
      </div>
      <div className="lg:col-span-2">
        <WeightChart limit={days} />
      </div>
      <div className="lg:col-span-3">
        <WorkoutTemplates />
      </div>
    </div>
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

function ConditionsList() {
  const { data: conditions, isLoading } = useQuery({
    queryKey: ['health', 'conditions'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchConditions()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-16 bg-[var(--color-surface-2)] rounded" />
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'var(--color-danger)',
    managed: 'var(--color-warning)',
    resolved: 'var(--color-success)',
    suspected: 'var(--color-text-muted)',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Condições
        </CardTitle>
      </CardHeader>
      <CardContent>
        {conditions && conditions.length > 0 ? (
          <div className="space-y-2">
            {conditions.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]"
              >
                <span className="text-sm text-[var(--color-text-primary)]">{c.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    color: statusColors[c.status] ?? 'var(--color-text-muted)',
                    backgroundColor: `${statusColors[c.status] ?? 'var(--color-text-muted)'}20`,
                  }}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
            Nenhuma condição registrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabsList() {
  const { data: labs, isLoading } = useQuery({
    queryKey: ['health', 'lab-results'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchLabResults(10)),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-16 bg-[var(--color-surface-2)] rounded" />
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    normal: 'var(--color-success)',
    elevated: 'var(--color-warning)',
    low: 'var(--color-accent)',
    critical: 'var(--color-danger)',
    unknown: 'var(--color-text-muted)',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Exames Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {labs && labs.length > 0 ? (
          <div className="space-y-2">
            {labs.map((lab) => (
              <div
                key={lab.id}
                className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {lab.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">
                    {new Date(lab.collected_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {lab.value_number !== null && (
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {lab.value_number}
                      {lab.unit ? ` ${lab.unit}` : ''}
                    </span>
                  )}
                  {lab.status && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        color: statusColors[lab.status] ?? 'var(--color-text-muted)',
                        backgroundColor: `${statusColors[lab.status] ?? 'var(--color-text-muted)'}20`,
                      }}
                    >
                      {lab.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
            Nenhum exame registrado
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkoutTemplates() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['health', 'workout-templates'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchWorkoutTemplates()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-[var(--color-surface-3)] rounded w-1/4" />
            <div className="h-16 bg-[var(--color-surface-3)] rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Fichas de Academia
        </CardTitle>
      </CardHeader>
      <CardContent>
        {templates && templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
              >
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t.name}
                </span>
                {t.frequency && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">{t.frequency}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p className="text-sm">Nenhuma ficha criada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
