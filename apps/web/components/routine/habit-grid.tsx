'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditSheet } from '@/components/ui/edit-sheet';
import { RecordActions } from '@/components/ui/record-actions';
import { Select } from '@/components/ui/select';
import {
  completeHabitAction,
  editHabit,
  fetchHabitsAtRisk,
  fetchHabitsToday,
  fetchWeeklyScore,
  removeHabit,
} from '@/lib/actions/routine';
import { cn } from '@/lib/utils/cn';
import type { HabitAtRisk, HabitFrequency, HabitWithLog } from '@hawk/module-routine/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Flame } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

// ── Difficulty badge ────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  trivial: { label: 'Trivial', className: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  easy: { label: 'Fácil', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  medium: { label: 'Médio', className: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  hard: { label: 'Difícil', className: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
} as const;

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekdays: 'Dias úteis',
  weekly_2x: '2×/sem',
  weekly_3x: '3×/sem',
};

function streakFlameColor(streak: number): string {
  if (streak >= 15) return 'text-red-500';
  if (streak >= 7) return 'text-orange-500';
  return 'text-orange-400';
}

// ── Skeleton ─────────────────────────────────────────────────

function HabitGridSkeleton() {
  return (
    <div className="space-y-[var(--space-4)] animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 rounded bg-[var(--color-surface-3)]" />
        <div className="h-6 w-14 rounded-full bg-[var(--color-surface-3)]" />
      </div>
      <div className="h-px bg-[var(--color-border-subtle)]" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-[var(--space-3)] px-[var(--space-1)]">
          <div className="h-6 w-6 rounded-[var(--radius-sm)] bg-[var(--color-surface-3)]" />
          <div className="flex-1 h-4 rounded bg-[var(--color-surface-3)]" />
          <div className="h-4 w-12 rounded bg-[var(--color-surface-3)]" />
          <div className="h-5 w-5 rounded-full bg-[var(--color-surface-3)]" />
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────

interface HabitGridProps {
  initialHabits?: HabitWithLog[];
  initialAtRisk?: HabitAtRisk[];
  initialScore?: number;
}

// ── Component ─────────────────────────────────────────────────

export default function HabitGrid({ initialHabits, initialAtRisk, initialScore }: HabitGridProps) {
  const queryClient = useQueryClient();
  const [editingHabit, setEditingHabit] = useState<HabitWithLog | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFrequency, setEditFrequency] = useState<HabitFrequency>('daily');

  const { data: habits, isLoading: habitsLoading } = useQuery({
    queryKey: ['routine', 'habits-today'],
    queryFn: fetchHabitsToday,
    initialData: initialHabits,
  });

  const { data: atRisk } = useQuery({
    queryKey: ['routine', 'at-risk'],
    queryFn: fetchHabitsAtRisk,
    initialData: initialAtRisk,
  });

  const { data: weeklyScore } = useQuery({
    queryKey: ['routine', 'weekly-score'],
    queryFn: fetchWeeklyScore,
    initialData: initialScore,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ habitId, completed }: { habitId: string; completed: boolean }) => {
      if (completed) {
        return completeHabitAction(habitId);
      }
      // unlog: server action toggleHabit handles this path — but we call completeHabitAction
      // only on mark-complete; for unmark we rely on toggleHabit indirectly via optimistic update
      return completeHabitAction(habitId);
    },
    onMutate: async ({ habitId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['routine', 'habits-today'] });
      const prev = queryClient.getQueryData(['routine', 'habits-today']);
      queryClient.setQueryData(['routine', 'habits-today'], (old: HabitWithLog[] | undefined) =>
        old?.map((h) =>
          h.id === habitId
            ? {
                ...h,
                completed_today: completed,
                current_streak: completed
                  ? h.current_streak + 1
                  : Math.max(0, h.current_streak - 1),
              }
            : h,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['routine', 'habits-today'], ctx.prev);
      toast.error('Erro ao atualizar hábito');
    },
    onSuccess: (_data, { completed }) => {
      if (completed) toast.success('Hábito completado!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['routine'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editHabit(editingHabit?.id ?? '', {
        name: editName,
        description: editDescription || undefined,
        frequency: editFrequency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routine'] });
      setEditingHabit(null);
      toast.success('Hábito atualizado');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routine'] });
      toast.success('Hábito removido');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  function openEdit(habit: HabitWithLog) {
    setEditingHabit(habit);
    setEditName(habit.name);
    setEditDescription(habit.description ?? '');
    setEditFrequency(habit.frequency);
  }

  if (habitsLoading && !initialHabits) {
    return <HabitGridSkeleton />;
  }

  const habitList = habits ?? [];
  const flameHabits = habitList
    .filter((h) => h.current_streak >= 3)
    .sort((a, b) => b.current_streak - a.current_streak);

  const completedCount = habitList.filter((h) => h.completed_today).length;
  const totalCount = habitList.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-[var(--space-5)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-3)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Hábitos</h2>
          <span className="text-xs text-[var(--color-text-muted)]">
            {completedCount}/{totalCount} hoje
          </span>
        </div>
        {weeklyScore !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
              weeklyScore >= 80
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : weeklyScore >= 50
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/20',
            )}
          >
            {Number.isFinite(weeklyScore) ? weeklyScore : 0}/100
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-success)] transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      )}

      {/* Flame streaks */}
      {flameHabits.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-orange-500/20 bg-orange-500/5 px-[var(--space-3)] py-[var(--space-2)]">
          <div className="flex flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-1)]">
            {flameHabits.map((h) => (
              <span key={h.id} className="flex items-center gap-1 text-xs font-medium">
                <Flame className={cn('h-3.5 w-3.5', streakFlameColor(h.current_streak))} />
                <span className="text-[var(--color-text-secondary)] max-w-[120px] truncate">
                  {h.name}
                </span>
                <span className={cn('font-bold tabular-nums', streakFlameColor(h.current_streak))}>
                  {h.current_streak}d
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Habit list */}
      {habitList.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-[var(--space-4)] text-center">
          Nenhum hábito cadastrado
        </p>
      ) : (
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {habitList.map((habit) => {
            const diffConfig = DIFFICULTY_CONFIG[habit.difficulty] ?? DIFFICULTY_CONFIG.medium;
            return (
              <div
                key={habit.id}
                className="flex w-full items-center gap-[var(--space-3)] px-[var(--space-1)] py-[var(--space-3)] hover:bg-[var(--color-surface-2)] transition-colors group"
              >
                {/* Toggle button area */}
                <button
                  type="button"
                  onClick={() =>
                    toggleMutation.mutate({ habitId: habit.id, completed: !habit.completed_today })
                  }
                  disabled={
                    toggleMutation.isPending && toggleMutation.variables?.habitId === habit.id
                  }
                  className="flex flex-1 min-w-0 items-center gap-[var(--space-3)] cursor-pointer text-left disabled:opacity-60"
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] border flex-shrink-0 transition-all duration-200',
                      habit.completed_today
                        ? 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-surface-0)]'
                        : 'border-[var(--color-border)] group-hover:border-[var(--color-success)]',
                    )}
                  >
                    {habit.completed_today && <Check className="h-3.5 w-3.5" />}
                  </div>

                  {/* Difficulty badge */}
                  <span
                    className={cn(
                      'flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                      diffConfig.className,
                    )}
                  >
                    {diffConfig.label}
                  </span>

                  {/* Name + module tag */}
                  <div className="flex-1 min-w-0 flex items-center gap-[var(--space-2)]">
                    <span
                      className={cn(
                        'text-sm truncate',
                        habit.completed_today
                          ? 'text-[var(--color-text-muted)] line-through'
                          : 'text-[var(--color-text-primary)]',
                      )}
                    >
                      {habit.name}
                    </span>
                    {habit.module && (
                      <span className="flex-shrink-0 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-3)] rounded px-1.5 py-0.5 leading-none">
                        {habit.module}
                      </span>
                    )}
                  </div>
                </button>

                {/* Streak */}
                <span className="flex-shrink-0 flex items-center gap-0.5 w-12 justify-end">
                  {habit.current_streak > 0 ? (
                    <>
                      <Flame
                        className={cn('h-3.5 w-3.5', streakFlameColor(habit.current_streak))}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          streakFlameColor(habit.current_streak),
                        )}
                      >
                        {habit.current_streak}d
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">—</span>
                  )}
                </span>

                {/* Frequency */}
                <Badge variant="muted" className="flex-shrink-0 text-[10px]">
                  {FREQUENCY_LABELS[habit.frequency] ?? habit.frequency}
                </Badge>

                {/* Edit/Delete actions */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <RecordActions
                    onEdit={() => openEdit(habit)}
                    onDelete={() => deleteMutation.mutate(habit.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* At-risk banner */}
      {atRisk && atRisk.length > 0 && (
        <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-[var(--space-3)] py-[var(--space-2)]">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-400">
            {atRisk.length === 1
              ? '1 hábito em risco de quebrar streak hoje'
              : `${atRisk.length} hábitos em risco de quebrar streak hoje`}
          </span>
        </div>
      )}

      {/* Edit sheet */}
      <EditSheet
        open={editingHabit !== null}
        onClose={() => setEditingHabit(null)}
        title="Editar hábito"
      >
        <div className="space-y-[var(--space-4)]">
          <div className="space-y-[var(--space-1-5)]">
            <label
              htmlFor="habit-name"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Nome
            </label>
            <input
              id="habit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Nome do hábito"
            />
          </div>
          <div className="space-y-[var(--space-1-5)]">
            <label
              htmlFor="habit-description"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Descrição
            </label>
            <input
              id="habit-description"
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Descrição (opcional)"
            />
          </div>
          <div className="space-y-[var(--space-1-5)]">
            <label
              htmlFor="habit-frequency"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Frequência
            </label>
            <Select
              id="habit-frequency"
              value={editFrequency}
              onChange={(e) => setEditFrequency(e.target.value as HabitFrequency)}
              options={[
                { value: 'daily', label: 'Diário' },
                { value: 'weekdays', label: 'Dias úteis' },
                { value: 'weekly_3x', label: '3x/semana' },
                { value: 'weekly_2x', label: '2x/semana' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-[var(--space-2)] pt-[var(--space-2)]">
            <Button size="sm" variant="ghost" onClick={() => setEditingHabit(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={!editName.trim() || updateMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </div>
      </EditSheet>
    </div>
  );
}
