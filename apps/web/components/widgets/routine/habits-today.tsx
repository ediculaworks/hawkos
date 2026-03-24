'use client';

import { CheckPop } from '@/components/motion/micro-interactions';
import { fetchHabitsToday, toggleHabit } from '@/lib/actions/routine';
import { cn } from '@/lib/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Zap } from 'lucide-react';

export default function HabitsTodayWidget() {
  const queryClient = useQueryClient();
  const { data: habits } = useQuery({
    queryKey: ['routine', 'habits-today'],
    queryFn: () => fetchHabitsToday(),
  });

  const mutation = useMutation({
    mutationFn: ({ habitId, completed }: { habitId: string; completed: boolean }) =>
      toggleHabit({ habitId, completed }),
    onMutate: async ({ habitId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['routine', 'habits-today'] });
      const previous = queryClient.getQueryData(['routine', 'habits-today']);
      queryClient.setQueryData(['routine', 'habits-today'], (old: typeof habits) =>
        old?.map((h) => (h.id === habitId ? { ...h, completed_today: completed } : h)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['routine', 'habits-today'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['routine'] });
    },
  });

  if (!habits || habits.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">Nenhum hábito cadastrado</p>;
  }

  const completed = habits.filter((h) => h.completed_today).length;

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-muted)]">
          {completed}/{habits.length} hoje
        </span>
      </div>
      {habits.map((habit) => (
        <button
          key={habit.id}
          type="button"
          onClick={() => mutation.mutate({ habitId: habit.id, completed: !habit.completed_today })}
          className={cn(
            'flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left transition-colors duration-[var(--duration-fast)] cursor-pointer',
            habit.completed_today
              ? 'bg-[var(--color-success-muted)]'
              : 'hover:bg-[var(--color-surface-2)]',
          )}
        >
          <CheckPop completed={habit.completed_today}>
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] border flex-shrink-0 transition-colors',
                habit.completed_today
                  ? 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-surface-0)]'
                  : 'border-[var(--color-border)]',
              )}
            >
              {habit.completed_today && <Check className="h-3 w-3" />}
            </div>
          </CheckPop>
          <span
            className={cn(
              'text-sm flex-1',
              habit.completed_today
                ? 'text-[var(--color-text-muted)] line-through'
                : 'text-[var(--color-text-primary)]',
            )}
          >
            {habit.name}
          </span>
          {habit.current_streak > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-warning)] flex-shrink-0">
              <Zap className="h-3 w-3" />
              {habit.current_streak}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
