'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchPersonalRecords } from '@/lib/actions/health';
import { useQuery } from '@tanstack/react-query';
import { Medal, TrendingUp } from 'lucide-react';

export function PersonalRecords() {
  const { data: records, isLoading } = useQuery({
    queryKey: ['health', 'personal-records'],
    queryFn: () => fetchPersonalRecords(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Medal className="h-4 w-4" />
            Recordes Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <div key={i} className="h-10 bg-[var(--color-surface-2)] rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!records?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Medal className="h-4 w-4" />
            Recordes Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
            Nenhum treino registrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Medal className="h-4 w-4 text-yellow-500" />
          Recordes Pessoais
          <span className="ml-auto text-xs text-[var(--color-text-muted)] font-normal">
            {records.length} exercícios
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs">
              <th className="text-left p-3 font-medium">Exercício</th>
              <th className="text-right p-3 font-medium">Melhor série</th>
              <th className="text-right p-3 font-medium">1RM est.</th>
              <th className="text-right p-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr
                key={r.exercise_name}
                className={
                  i < records.length - 1
                    ? 'border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)]'
                    : 'hover:bg-[var(--color-surface-1)]'
                }
              >
                <td className="p-3 font-medium text-[var(--color-text-primary)]">
                  <div className="flex items-center gap-2">
                    {i === 0 && <span>🥇</span>}
                    {i === 1 && <span>🥈</span>}
                    {i === 2 && <span>🥉</span>}
                    {i > 2 && (
                      <span className="w-5 text-center text-[var(--color-text-muted)]">
                        {i + 1}
                      </span>
                    )}
                    {r.exercise_name}
                  </div>
                </td>
                <td className="p-3 text-right text-[var(--color-text-secondary)]">
                  {r.best_weight_kg}kg × {r.best_reps}
                </td>
                <td className="p-3 text-right">
                  <span className="font-bold text-[var(--color-accent-primary)] flex items-center justify-end gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {r.estimated_1rm}kg
                  </span>
                </td>
                <td className="p-3 text-right text-xs text-[var(--color-text-muted)]">
                  {r.achieved_at
                    ? new Date(r.achieved_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
