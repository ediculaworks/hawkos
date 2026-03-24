'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchExerciseProgress } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DataPoint = {
  date: string;
  best_weight_kg: number;
  best_reps: number;
  estimated_1rm: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: DataPoint }>;
};

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 shadow-lg text-sm">
      <p className="text-[var(--color-text-muted)] mb-1">
        {new Date(d.date).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })}
      </p>
      <p className="text-[var(--color-text-primary)] font-medium">
        1RM estimado: <span className="text-[var(--color-mod-health)]">{d.estimated_1rm} kg</span>
      </p>
      <p className="text-[var(--color-text-muted)]">
        {d.best_weight_kg} kg × {d.best_reps} reps
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]">
      <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-lg font-semibold ${highlight ? 'text-[var(--color-mod-health)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {value}
      </span>
    </div>
  );
}

export function ExerciseProgress() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedExercise, setDebouncedExercise] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedExercise(inputValue.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['health', 'exercise-progress', debouncedExercise],
    queryFn: () => fetchExerciseProgress(debouncedExercise, 16),
    enabled: debouncedExercise.length > 2,
    staleTime: 2 * 60 * 1000,
  });

  const chartData = (data ?? []).map((d) => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  const firstRM = chartData[0]?.estimated_1rm;
  const latestRM = chartData[chartData.length - 1]?.estimated_1rm;
  const bestRM =
    chartData.length > 0 ? Math.max(...chartData.map((d) => d.estimated_1rm)) : undefined;
  const progressPct =
    firstRM && latestRM && firstRM > 0 ? (((latestRM - firstRM) / firstRM) * 100).toFixed(1) : null;

  const isEmpty = !isLoading && debouncedExercise.length > 2 && (!data || data.length === 0);
  const isWaiting = debouncedExercise.length <= 2;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--color-mod-health)]" />
          Progresso por Exercício
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Buscar exercício (ex: supino, agachamento)..."
            className="w-full px-4 py-2.5 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-mod-health)] transition-colors"
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-[var(--color-mod-health)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {isLoading && debouncedExercise.length > 2 ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[var(--color-mod-health)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isWaiting ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
            <Activity className="h-8 w-8 opacity-40" />
            <p className="text-sm">Digite o nome de um exercício para ver a evolução do 1RM</p>
          </div>
        ) : isEmpty ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
            <Activity className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Nenhum dado encontrado</p>
            <p className="text-xs">
              Nenhum treino com "{debouncedExercise}" nas últimas 16 semanas
            </p>
          </div>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}kg`}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="estimated_1rm"
                    stroke="var(--color-mod-health)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--color-mod-health)', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--color-mod-health)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatBox label="1RM Inicial" value={firstRM ? `${firstRM} kg` : '--'} />
              <StatBox label="1RM Atual" value={latestRM ? `${latestRM} kg` : '--'} />
              <StatBox label="Melhor 1RM" value={bestRM ? `${bestRM} kg` : '--'} highlight />
              <StatBox
                label="Progresso"
                value={progressPct !== null ? `+${progressPct}%` : '--'}
                highlight={progressPct !== null && Number(progressPct) > 0}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
