'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchHobbyLogs, removeHobbyLog } from '@/lib/actions/entertainment';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gamepad } from 'lucide-react';
import toast from 'react-hot-toast';

export function HobbiesList() {
  const queryClient = useQueryClient();

  const { data: hobbies, isLoading } = useQuery({
    queryKey: ['entertainment', 'hobbies'],
    queryFn: fetchHobbyLogs,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeHobbyLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entertainment'] });
      toast.success('Registro excluído');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Hobbies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hobbies || hobbies.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Hobbies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <Gamepad className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum hobby registrado</p>
            <p className="text-xs mt-1">Use o agente para registrar suas atividades</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Hobbies Recentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {hobbies.map((hobby) => (
          <div
            key={hobby.id}
            className="group flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-1)]"
          >
            <Gamepad className="h-4 w-4 text-[var(--color-text-muted)]" />
            <div className="flex-1">
              <p className="font-medium">{hobby.activity}</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {hobby.duration_min ? `${hobby.duration_min}min` : ''}
              </p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <RecordActions onDelete={() => deleteMutation.mutate(hobby.id)} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
