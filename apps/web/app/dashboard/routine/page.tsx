'use client';

import HabitGrid from '@/components/routine/habit-grid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { CardSkeleton, PageSkeleton } from '@/components/ui/skeleton';
import { addHabit, fetchWeekSummary } from '@/lib/actions/routine';
import type { HabitFrequency } from '@hawk/module-routine/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Suspense } from 'react';
import { useState } from 'react';

export default function RoutinePage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: weekSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['routine', 'week-summary'],
    queryFn: () => fetchWeekSummary(),
  });

  return (
    <Suspense fallback={<PageSkeleton />}>
      <div className="space-y-[var(--space-6)]">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Rotina</h1>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? 'Fechar' : 'Novo hábito'}
          </Button>
        </div>

        {showForm && (
          <HabitForm
            onSuccess={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ['routine'] });
            }}
          />
        )}

        {/* Habit grid — centerpiece */}
        <Card>
          <CardContent className="pt-[var(--space-5)] pb-[var(--space-4)]">
            <HabitGrid />
          </CardContent>
        </Card>

        {/* Week summary */}
        {summaryLoading && !weekSummary && <CardSkeleton />}
        {weekSummary && weekSummary.length > 0 && (
          <Card>
            <CardContent className="pt-[var(--space-5)]">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Semana
              </span>
              <div className="mt-[var(--space-3)] space-y-[var(--space-3)]">
                {weekSummary.map((item) => (
                  <div key={item.habit.id} className="flex items-center gap-[var(--space-3)]">
                    <span className="text-sm text-[var(--color-text-secondary)] flex-1 truncate">
                      {item.habit.name}
                    </span>
                    <div className="w-24 flex-shrink-0">
                      <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-success)]"
                          style={{ width: `${item.completion_rate}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)] w-8 text-right">
                      {item.week_completions}/{item.week_target}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Suspense>
  );
}

function HabitForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');

  const mutation = useMutation({
    mutationFn: () => addHabit({ name, frequency }),
    onSuccess,
  });

  return (
    <Card>
      <CardContent className="pt-[var(--space-5)]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[var(--space-3)]">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do hábito"
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
            options={[
              { value: 'daily', label: 'Diário' },
              { value: 'weekdays', label: 'Dias úteis' },
              { value: 'weekly_3x', label: '3x/semana' },
              { value: 'weekly_2x', label: '2x/semana' },
            ]}
          />
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            Criar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
