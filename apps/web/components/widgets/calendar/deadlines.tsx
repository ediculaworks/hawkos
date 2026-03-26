'use client';

import { fetchUpcomingEvents } from '@/lib/actions/calendar';
import { fetchActiveTasks, fetchOverdueTasks } from '@/lib/actions/objectives';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, CheckSquare, Clock } from 'lucide-react';
import { useMemo } from 'react';

export default function DeadlinesWidget() {
  const { data: overdueTasks } = useQuery({
    queryKey: ['objectives', 'overdue-tasks'],
    queryFn: () => fetchOverdueTasks(),
  });

  const { data: upcomingTasks } = useQuery({
    queryKey: ['objectives', 'active-tasks'],
    queryFn: () => fetchActiveTasks(20),
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () => fetchUpcomingEvents(7),
  });

  const overdueCount = overdueTasks?.length ?? 0;

  const urgentTasks = useMemo(() => {
    const tasks = upcomingTasks?.filter((t) => t.due_date) ?? [];
    return tasks
      .filter((t) => {
        if (!t.due_date) return false;
        const diff = Math.ceil(
          (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return diff <= 3;
      })
      .slice(0, 5);
  }, [upcomingTasks]);

  const todayEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0] ?? '';
    return upcomingEvents?.filter((e) => e.start_at.startsWith(today)) ?? [];
  }, [upcomingEvents]);

  return (
    <div className="space-y-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-2)]">
        <DeadlineCard
          label="Atrasadas"
          count={overdueCount}
          icon={AlertCircle}
          color={overdueCount > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
        />
        <DeadlineCard
          label="Hoje"
          count={todayEvents.length}
          icon={Calendar}
          color={todayEvents.length > 0 ? 'var(--color-accent)' : 'var(--color-text-muted)'}
        />
      </div>

      {urgentTasks.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <Clock className="h-3 w-3" />
            Próximas tarefas
          </div>
          {urgentTasks.map((task) => {
            const daysLeft = task.due_date
              ? Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const isUrgent = daysLeft !== null && daysLeft <= 1;

            return (
              <div
                key={task.id}
                className="flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckSquare
                    className="h-3 w-3 flex-shrink-0"
                    style={{ color: isUrgent ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                  />
                  <span className="truncate text-[var(--color-text-primary)]">{task.title}</span>
                </div>
                <span
                  className="text-[10px] flex-shrink-0"
                  style={{ color: isUrgent ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                >
                  {daysLeft === 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `${daysLeft}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {todayEvents.length > 0 && (
        <div className="space-y-[var(--space-1)]">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <Calendar className="h-3 w-3" />
            Eventos hoje
          </div>
          {todayEvents.slice(0, 3).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between text-sm rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <span className="truncate text-[var(--color-text-primary)]">{event.title}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                {new Date(event.start_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {urgentTasks.length === 0 && todayEvents.length === 0 && overdueCount === 0 && (
        <div className="text-center text-sm text-[var(--color-text-muted)] py-4">
          Nenhum compromisso próximo
        </div>
      )}
    </div>
  );
}

function DeadlineCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof AlertCircle;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3" style={{ color }} />
      </div>
      <span className="text-2xl font-bold" style={{ color }}>
        {count}
      </span>
    </div>
  );
}
