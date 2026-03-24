'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchRecentSleep } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Moon } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function SleepChart() {
  const { data: sleepData, isLoading } = useQuery({
    queryKey: ['health', 'sleep', 14],
    queryFn: () => fetchRecentSleep(14),
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

  const chartData = (sleepData ?? [])
    .slice(0, 14)
    .reverse()
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      hours: s.duration_h ?? 0,
      quality: s.quality ?? 0,
    }));

  const avgHours =
    chartData.length > 0
      ? (chartData.reduce((sum, d) => sum + d.hours, 0) / chartData.length).toFixed(1)
      : '0';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Sono - 14 dias
          </CardTitle>
          <span className="text-sm text-[var(--color-text-muted)]">Média: {avgHours}h</span>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  domain={[0, 12]}
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-0)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)' }}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="var(--color-mod-health)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-mod-health)', r: 3 }}
                  name="Horas"
                />
              </LineChart>
            </ResponsiveContainer>
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
