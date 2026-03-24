'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchWeightHistory } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export function WeightChart({ limit = 30 }: { limit?: number }) {
  const { data: weightData, isLoading } = useQuery({
    queryKey: ['health', 'weight-history', limit],
    queryFn: () => fetchWeightHistory(limit),
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

  const chartData = (weightData ?? [])
    .slice(0, limit)
    .reverse()
    .map((w) => ({
      date: new Date(w.measured_at ?? w.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      kg: w.weight_kg,
    }));

  const latest = weightData?.[0]?.weight_kg;
  const oldest = weightData?.[weightData.length - 1]?.weight_kg;
  const diff = latest && oldest ? (latest - oldest).toFixed(1) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Peso - {limit} dias
          </CardTitle>
          {diff !== null && Number(diff) !== 0 && (
            <span
              className={`text-sm font-medium ${Number(diff) > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}
            >
              {Number(diff) > 0 ? '+' : ''}
              {diff} kg
            </span>
          )}
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
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-0)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  labelStyle={{ color: 'var(--color-text-primary)' }}
                  formatter={(value) => [`${Number(value).toFixed(1)} kg`, 'Peso']}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-accent)', r: 3 }}
                  name="Peso"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[var(--color-text-muted)]">
            Sem dados de peso registrados
          </div>
        )}
      </CardContent>
    </Card>
  );
}
