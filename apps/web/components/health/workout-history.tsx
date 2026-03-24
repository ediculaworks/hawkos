'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { addWorkoutLog, fetchRecentWorkouts, removeWorkout } from '@/lib/actions/health';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Timer, X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

type WorkoutTypeInfo = { label: string; color: string };

const WORKOUT_TYPES: Record<string, WorkoutTypeInfo> = {
  musculacao: { label: 'Musculação', color: 'var(--color-success)' },
  corrida: { label: 'Corrida', color: 'var(--color-accent)' },
  ciclismo: { label: 'Ciclismo', color: 'var(--color-mod-calendar)' },
  natacao: { label: 'Natação', color: 'var(--color-mod-health)' },
  caminhada: { label: 'Caminhada', color: 'var(--color-warning)' },
  skate: { label: 'Skate', color: 'var(--color-mod-entertainment)' },
  futebol: { label: 'Futebol', color: 'var(--color-mod-people)' },
  outro: { label: 'Outro', color: 'var(--color-text-muted)' },
};

const DEFAULT_WORKOUT_TYPE: WorkoutTypeInfo = { label: 'Outro', color: 'var(--color-text-muted)' };

function getWorkoutTypeInfo(type: string): WorkoutTypeInfo {
  return WORKOUT_TYPES[type] ?? DEFAULT_WORKOUT_TYPE;
}

export function WorkoutHistory() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: workouts, isLoading } = useQuery({
    queryKey: ['health', 'workouts', 20],
    queryFn: () => fetchRecentWorkouts(20),
  });

  const mutation = useMutation({
    mutationFn: addWorkoutLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'workouts'] });
      setShowForm(false);
      toast.success('Treino registrado!');
    },
    onError: (err: Error) => toast.error(`Erro ao registrar treino: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: removeWorkout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health', 'workouts'] }),
    onError: (err: Error) => toast.error(`Erro ao remover treino: ${err.message}`),
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Treinos Recentes
          </CardTitle>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline cursor-pointer"
          >
            {showForm ? (
              <>
                <X className="h-3.5 w-3.5" />
                Fechar
              </>
            ) : (
              <>+ Registrar</>
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <WorkoutForm
            onSubmit={(data) => mutation.mutate(data)}
            onCancel={() => setShowForm(false)}
            isPending={mutation.isPending}
          />
        )}
        {workouts && workouts.length > 0 ? (
          <div className="space-y-2">
            {workouts.slice(0, 10).map((workout) => {
              const typeInfo = getWorkoutTypeInfo(workout.type);
              return (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-2)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: typeInfo.color }}
                    />
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {typeInfo.label}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        {new Date(workout.date).toLocaleDateString('pt-BR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {workout.duration_m && (
                      <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <Timer className="h-3 w-3" />
                        {workout.duration_m} min
                      </span>
                    )}
                    <Badge variant="muted">{workout.type}</Badge>
                    <RecordActions onDelete={() => deleteMutation.mutate(workout.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum treino registrado</p>
            <p className="text-xs">Clique em "Registrar" para adicionar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkoutForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: unknown) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [type, setType] = useState('musculacao');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const durationNum = duration ? Number.parseInt(duration, 10) : undefined;
    onSubmit({
      type,
      duration_m: durationNum,
      notes: notes || undefined,
    });
  };

  return (
    <div className="mb-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="workout-type"
            className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block"
          >
            Tipo
          </label>
          <select
            id="workout-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            {Object.entries(WORKOUT_TYPES).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="workout-duration"
            className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block"
          >
            Duração (min)
          </label>
          <input
            id="workout-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Ex: 60"
            min="1"
            max="480"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="workout-notes"
          className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block"
        >
          Observações
        </label>
        <textarea
          id="workout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional..."
          rows={2}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
