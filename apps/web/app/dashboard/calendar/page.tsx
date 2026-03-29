'use client';

import { AnimatedPage } from '@/components/motion/animated-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  addEvent,
  fetchDayEvents,
  fetchMonthEvents,
  fetchUpcomingEvents,
  removeEvent,
} from '@/lib/actions/calendar';
import { cn } from '@/lib/utils/cn';
import type { CalendarEvent } from '@hawk/module-calendar/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(start: string, end: string): string {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (diff < 60) return `${diff}min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function getMonthFromParam(monthStr: string | null): Date {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-').map(Number);
    const year = parts[0] as number;
    const month = parts[1] as number;
    if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1);
    }
  }
  return new Date();
}

function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthParam = searchParams.get('month');
  const selectedParam = searchParams.get('selected');
  const actionParam = searchParams.get('action');

  const [month, setMonth] = useState(() => getMonthFromParam(monthParam));
  const [selectedDate, setSelectedDate] = useState<string | null>(selectedParam);
  const [showForm, setShowForm] = useState(actionParam === 'new');
  const queryClient = useQueryClient();

  const year = month.getFullYear();
  const mon = month.getMonth();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`/dashboard/calendar?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setMonthUrl = useCallback(
    (d: Date) => {
      setMonth(d);
      updateParams({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    },
    [updateParams],
  );

  const setSelectedUrl = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      updateParams({ selected: date });
    },
    [updateParams],
  );

  const toggleForm = useCallback(
    (show: boolean) => {
      setShowForm(show);
      updateParams({ action: show ? 'new' : null });
    },
    [updateParams],
  );

  useEffect(() => {
    if (monthParam) {
      setMonth(getMonthFromParam(monthParam));
    }
  }, [monthParam]);

  useEffect(() => {
    if (selectedParam) setSelectedDate(selectedParam);
  }, [selectedParam]);

  useEffect(() => {
    setShowForm(actionParam === 'new');
  }, [actionParam]);

  const { data: monthEvents } = useQuery({
    queryKey: ['calendar', 'month', year, mon],
    queryFn: () => fetchMonthEvents(year, mon),
  });

  const { data: upcoming } = useQuery({
    queryKey: ['calendar', 'upcoming'],
    queryFn: () => fetchUpcomingEvents(14),
  });

  const { data: dayEvents } = useQuery({
    queryKey: ['calendar', 'day', selectedDate],
    queryFn: () => fetchDayEvents(selectedDate ?? ''),
    enabled: !!selectedDate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeEvent(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const eventsByDay: Record<string, CalendarEvent[]> = {};
  for (const e of monthEvents ?? []) {
    const day = new Date(e.start_at).toISOString().slice(0, 10);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  }

  const prevMonth = () => {
    const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    setMonthUrl(prev);
  };

  const nextMonth = () => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    setMonthUrl(next);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['calendar'] });

  return (
    <AnimatedPage>
      <div className="flex flex-col md:flex-row gap-4 md:gap-[var(--space-6)] items-start">
        {/* Main: Calendar grid */}
        <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[var(--space-3)]">
              <button
                type="button"
                onClick={prevMonth}
                title="Mês anterior"
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-[var(--color-text-primary)] min-w-[140px] text-center">
                {MONTH_NAMES[mon]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                title="Próximo mês"
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={() => toggleForm(!showForm)}>
              {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showForm ? 'Fechar' : 'Evento'}
            </Button>
          </div>

          {showForm && (
            <EventForm
              onSuccess={() => {
                toggleForm(false);
                invalidate();
              }}
            />
          )}

          {/* Calendar grid */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-[var(--color-border-subtle)]">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-[var(--space-2)] text-center text-[11px] font-medium text-[var(--color-text-muted)] uppercase"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {firstDay > 0 && (
                <div
                  className="col-span-1 h-20 border-b border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]/50"
                  style={{ gridColumn: `1 / ${firstDay + 1}` }}
                />
              )}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const dayEventList = eventsByDay[dateStr];

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedUrl(isSelected ? null : dateStr)}
                    className={cn(
                      'h-20 border-b border-r border-[var(--color-border-subtle)] p-[var(--space-1)] text-left transition-colors cursor-pointer relative',
                      isSelected
                        ? 'bg-[var(--color-accent)]/10'
                        : 'hover:bg-[var(--color-surface-2)]/50',
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                        isToday
                          ? 'bg-[var(--color-accent)] text-[var(--color-surface-0)]'
                          : 'text-[var(--color-text-secondary)]',
                      )}
                    >
                      {day}
                    </span>
                    {dayEventList && dayEventList.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {dayEventList.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="h-1 rounded-full bg-[var(--color-accent)] flex-1 max-w-[20px]"
                            title={e.title}
                          />
                        ))}
                        {dayEventList.length > 3 && (
                          <span className="text-[9px] text-[var(--color-text-muted)]">
                            +{dayEventList.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDate && (
            <div className="space-y-[var(--space-2)]">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              {dayEvents && dayEvents.length > 0 ? (
                dayEvents.map((e) => (
                  <EventCard key={e.id} event={e} onDelete={(id) => deleteMutation.mutate(id)} />
                ))
              ) : (
                <EmptyState
                  icon={Clock}
                  title="Nenhum evento neste dia"
                  description="Clique no botão acima para criar um evento"
                  action={{ label: 'Criar evento', onClick: () => toggleForm(true) }}
                />
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Upcoming */}
        <div className="w-72 flex-shrink-0 space-y-[var(--space-5)] hidden lg:block">
          <div className="space-y-[var(--space-2)]">
            <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Próximos 14 dias
            </span>
            {upcoming && upcoming.length > 0 ? (
              upcoming.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-[var(--space-2)] py-[var(--space-1-5)]"
                >
                  <div className="w-1 h-full min-h-[32px] rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-[var(--color-text-primary)] truncate block">
                      {e.title}
                    </span>
                    <div className="flex items-center gap-[var(--space-1-5)] mt-0.5">
                      <Clock className="h-3 w-3 text-[var(--color-text-muted)]" />
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {new Date(e.start_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}{' '}
                        {formatTime(e.start_at)}
                      </span>
                    </div>
                    {e.location && (
                      <div className="flex items-center gap-[var(--space-1-5)] mt-0.5">
                        <MapPin className="h-3 w-3 text-[var(--color-text-muted)]" />
                        <span className="text-[11px] text-[var(--color-text-muted)] truncate">
                          {e.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Calendar}
                title="Nenhum evento próximo"
                description="Crie um evento no formulário ao lado"
              />
            )}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-[var(--space-5)]">
          <div className="h-8 w-48 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-3)]" />
          <div className="flex gap-[var(--space-6)]">
            <div className="flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-6">
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }, (_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                    key={i}
                    className="h-10 animate-pulse rounded bg-[var(--color-surface-3)]"
                  />
                ))}
              </div>
            </div>
            <div className="w-64 space-y-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                  key={i}
                  className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-3)]"
                />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}

function EventCard({ event, onDelete }: { event: CalendarEvent; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardContent className="pt-[var(--space-3)] pb-[var(--space-3)]">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {event.title}
            </span>
            <div className="flex items-center gap-[var(--space-3)] mt-[var(--space-1)]">
              <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.all_day
                  ? 'Dia inteiro'
                  : `${formatTime(event.start_at)} — ${formatTime(event.end_at)} (${formatDuration(event.start_at, event.end_at)})`}
              </span>
              {event.location && (
                <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" /> {event.location}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-[var(--space-1)] line-clamp-2">
                {event.description}
              </p>
            )}
            {event.tags && event.tags.length > 0 && (
              <div className="flex gap-1 mt-[var(--space-1)]">
                {event.tags.map((t) => (
                  <Badge key={t} variant="muted">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDelete(event.id)}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer flex-shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function EventForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [allDay, setAllDay] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const start_at = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
      const end_at = allDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
      return addEvent({
        title,
        start_at,
        end_at,
        all_day: allDay,
        location: location || undefined,
        description: description || undefined,
      });
    },
    onSuccess,
  });

  return (
    <Card>
      <CardContent className="pt-[var(--space-4)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)] lg:grid-cols-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do evento"
            className="col-span-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
          />
          <div className="flex items-center gap-[var(--space-2)]">
            <label className="flex items-center gap-[var(--space-1)] cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-xs text-[var(--color-text-muted)]">Dia inteiro</span>
            </label>
          </div>
        </div>
        {!allDay && (
          <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-3)]">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
            />
            <span className="text-xs text-[var(--color-text-muted)]">até</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-3)] mt-[var(--space-3)]">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Local (opcional)"
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div className="mt-[var(--space-3)]">
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
          >
            Criar evento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
