'use client';

import { ExerciseProgress } from '@/components/health/exercise-progress';
import { HealthScore } from '@/components/health/health-score';
import { PersonalRecords } from '@/components/health/personal-records';
import { WeightChart } from '@/components/health/weight-chart';
import { WorkoutHistory as WorkoutHistoryComponent } from '@/components/health/workout-history';
import { ModulePageLayout, type SectionConfig } from '@/components/layout/module-page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { TabBar, type TabItem } from '@/components/ui/tab-bar';
import {
  addWeightLog,
  fetchLatestWeight,
  removeBodyMeasurement,
  removeSleepSession,
  removeSubstanceLog,
  takeMedication,
} from '@/lib/actions/health';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Cigarette, FileText, Moon, Pill, Scale } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';

type Tab = 'today' | 'week' | 'history' | 'treinos';
type DateRange = '7d' | '14d' | '30d' | '90d';

const HEALTH_TABS: TabItem<Tab>[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'history', label: 'Histórico' },
  { id: 'treinos', label: 'Treinos' },
];

const RANGE_TABS: TabItem<DateRange>[] = [
  { id: '7d', label: '7d' },
  { id: '14d', label: '14d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '3m' },
];

function HealthHeader({
  activeTab,
  onTabChange,
  dateRange,
  onDateRangeChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Saúde</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Acompanhe sua saúde e bem-estar</p>
      </div>
      <div className="flex gap-3">
        {activeTab !== 'today' && (
          <TabBar tabs={RANGE_TABS} active={dateRange} onChange={onDateRangeChange} size="sm" />
        )}
        <TabBar tabs={HEALTH_TABS} active={activeTab} onChange={onTabChange} />
      </div>
    </div>
  );
}

type Props = {
  activeTab: Tab;
  dateRange: DateRange;
};

export function HealthPageClient({ activeTab, dateRange }: Props) {
  return (
    <div className="space-y-[var(--space-6)]">
      {activeTab === 'today' && <HealthTodaySections />}

      {activeTab === 'week' && <HealthWeekTab dateRange={dateRange} />}

      {activeTab === 'history' && <HealthHistoryTab dateRange={dateRange} />}

      {activeTab === 'treinos' && (
        <div className="space-y-[var(--space-6)]">
          <ExerciseProgress />
          <PersonalRecords />
        </div>
      )}
    </div>
  );
}

function HealthTodaySections() {
  const sections: SectionConfig[] = [
    { id: 'daily-pulse', title: 'Pulso Diário', component: <DailyPulse /> },
    { id: 'health-score', title: 'Score de Saúde', component: <HealthScore /> },
    { id: 'workouts', title: 'Treinos', component: <WorkoutHistoryComponent /> },
    { id: 'weight', title: 'Peso', component: <WeightTracker /> },
    { id: 'medications', title: 'Medicações', component: <MedicationsList /> },
    { id: 'substances', title: 'Substâncias', component: <SubstanceStats /> },
    { id: 'conditions', title: 'Condições', component: <ConditionsList /> },
  ];

  return <ModulePageLayout moduleId="health" sections={sections} />;
}

function DailyPulse() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['health', 'daily-summary'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchDailySummary()),
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
      icon: 'moon',
      label: 'Sono',
      value: summary?.sleep_hours ? `${summary.sleep_hours}h` : '--',
      subtext: summary?.sleep_quality ? `Qualidade: ${summary.sleep_quality}/10` : 'Não registrado',
      color: 'var(--color-mod-health)',
    },
    {
      icon: 'activity',
      label: 'Treino',
      value: summary?.exercised ? (summary.workout_type ?? 'Sim') : 'Nenhum',
      subtext: summary?.workout_min ? `${summary.workout_min} min` : '',
      color: 'var(--color-success)',
    },
    {
      icon: 'scale',
      label: 'Peso',
      value: summary?.weight_kg ? `${summary.weight_kg} kg` : '--',
      subtext: 'Última pesagem',
      color: 'var(--color-accent)',
    },
    {
      icon: 'brain',
      label: 'Humor',
      value: summary?.mood ? `${summary.mood}/10` : '--',
      subtext: summary?.energy ? `Energia: ${summary.energy}/10` : '',
      color: 'var(--color-warning)',
    },
    {
      icon: 'cigarette',
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
              <span className="text-xs text-[var(--color-text-muted)]">{stat.label}</span>
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

function WeightTracker() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  const { data: weight, isLoading } = useQuery({
    queryKey: ['health', 'latest-weight'],
    queryFn: fetchLatestWeight,
    staleTime: 5 * 60 * 1000,
  });

  const { data: weightHistory } = useQuery({
    queryKey: ['health', 'weight-history', 10],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchWeightHistory(10)),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const kg = Number.parseFloat(weightInput);
      if (Number.isNaN(kg) || kg < 20 || kg > 300) throw new Error('Peso inválido');
      return addWeightLog({ weight_kg: kg });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'latest-weight'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'weight-history'] });
      setWeightInput('');
      setShowForm(false);
      toast.success('Peso registrado!');
    },
    onError: (err: Error) => toast.error(`Erro ao registrar peso: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: removeBodyMeasurement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'latest-weight'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'weight-history'] });
      toast.success('Medição removida!');
    },
    onError: (err: Error) => toast.error(`Erro ao remover medição: ${err.message}`),
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Peso
          </span>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
          >
            {showForm ? 'Cancelar' : '+ Registrar'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <span className="text-3xl font-semibold text-[var(--color-text-primary)]">
            {weight?.weight_kg?.toFixed(1) ?? '--'}
          </span>
          <span className="text-lg text-[var(--color-text-muted)]"> kg</span>
          {weight?.measured_at && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {new Date(weight.measured_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        {showForm && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="kg"
              step="0.1"
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
            <Button
              size="sm"
              onClick={() => mutation.mutate()}
              disabled={!weightInput || mutation.isPending}
            >
              Salvar
            </Button>
          </div>
        )}
        {weightHistory && weightHistory.length > 1 && (
          <div className="mt-4 space-y-1 border-t border-[var(--color-border-subtle)] pt-3">
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Histórico
            </span>
            {weightHistory.slice(0, 5).map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] group"
              >
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {w.weight_kg?.toFixed(1)} kg
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(w.measured_at ?? w.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <RecordActions onDelete={() => deleteMutation.mutate(w.id)} />
                </div>
              </div>
            ))}
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

function MedicationsList() {
  const { data: medications, isLoading } = useQuery({
    queryKey: ['health', 'active-medications'],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchActiveMedications()),
  });

  const queryClient = useQueryClient();
  const takeMutation = useMutation({
    mutationFn: (medicationId: string) => takeMedication(medicationId),
    onSuccess: () => {
      toast.success('Medicamento registrado!');
      void queryClient.invalidateQueries({ queryKey: ['health', 'active-medications'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar medicamento: ${err.message}`);
    },
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Pill className="h-4 w-4" />
          Medicamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {medications && medications.length > 0 ? (
          <div className="space-y-2">
            {medications.map((med) => (
              <div
                key={med.id}
                className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)]"
              >
                <div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {med.name}
                  </span>
                  {med.dosage && (
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">
                      {med.dosage}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)] block">
                    {med.frequency}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => takeMutation.mutate(med.id)}
                  disabled={takeMutation.isPending}
                >
                  Tomei
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
            Nenhum medicamento ativo
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubstanceStats() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['health', 'substances', 7],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchSubstanceStats(7)),
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['health', 'substance-logs', 10],
    queryFn: () => import('@/lib/actions/health').then((m) => m.fetchRecentSubstanceLogs(10)),
  });

  const deleteMutation = useMutation({
    mutationFn: removeSubstanceLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'substances'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'substance-logs'] });
      toast.success('Registro removido!');
    },
    onError: (err: Error) => toast.error(`Erro ao remover registro: ${err.message}`),
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

  const substanceLabels: Record<string, string> = {
    cannabis: 'Cannabis',
    tobacco: 'Tabaco',
    alcohol: 'Álcool',
    caffeine: 'Cafeína',
    other: 'Outro',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Cigarette className="h-4 w-4" />
          Substâncias (7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats && stats.length > 0 ? (
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.substance} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-primary)]">
                    {substanceLabels[s.substance] ?? s.substance}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {s.days_used}d · {s.total_quantity}
                    {s.unit ? ` ${s.unit}` : ''}
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={`${s.substance}-${i}`}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < s.days_used
                          ? 'bg-[var(--color-mod-routine)]'
                          : 'bg-[var(--color-surface-3)]'
                      }`}
                    />
                  ))}
                </div>
                {s.total_cost && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    R$ {s.total_cost.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-[var(--color-text-muted)] text-sm">
            Nenhum uso registrado esta semana
          </div>
        )}
        {recentLogs && recentLogs.length > 0 && (
          <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-3 space-y-1">
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Registros recentes
            </span>
            {recentLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-2)] group"
              >
                <div className="min-w-0">
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {substanceLabels[log.substance] ?? log.substance}
                  </span>
                  {log.quantity && (
                    <span className="text-xs text-[var(--color-text-muted)] ml-1.5">
                      {log.quantity}
                      {log.unit ? ` ${log.unit}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(log.logged_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <RecordActions onDelete={() => deleteMutation.mutate(log.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
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

const DATE_RANGE_DAYS: Record<DateRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

function HealthWeekTab({ dateRange }: { dateRange: DateRange }) {
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

function HealthHistoryTab({ dateRange }: { dateRange: DateRange }) {
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

export default function HealthPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-[var(--space-6)]">
          <div className="h-16 animate-pulse bg-[var(--color-surface-2)] rounded-lg" />
        </div>
      }
    >
      <HealthPageInner />
    </Suspense>
  );
}

function HealthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab =
    tabParam && ['today', 'week', 'history', 'treinos'].includes(tabParam) ? tabParam : 'today';

  const rangeParam = searchParams.get('range') as DateRange | null;
  const dateRange: DateRange =
    rangeParam && ['7d', '14d', '30d', '90d'].includes(rangeParam) ? rangeParam : '14d';

  const setTab = (tab: Tab) => {
    router.push(`/dashboard/health?tab=${tab}&range=${dateRange}`, { scroll: false });
  };

  const setDateRange = (range: DateRange) => {
    router.push(`/dashboard/health?tab=${activeTab}&range=${range}`, { scroll: false });
  };

  return (
    <div className="space-y-[var(--space-6)]">
      <HealthHeader
        activeTab={activeTab}
        onTabChange={setTab}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      <HealthPageClient activeTab={activeTab} dateRange={dateRange} />
    </div>
  );
}
