'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteMaintenanceLog, fetchMaintenance } from '@/lib/actions/housing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Wrench } from 'lucide-react';

export function MaintenanceList() {
  const queryClient = useQueryClient();

  const { data: maintenance, isLoading } = useQuery({
    queryKey: ['housing', 'maintenance'],
    queryFn: fetchMaintenance,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMaintenanceLog(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['housing', 'maintenance'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!maintenance || maintenance.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Manutenção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhum registro de manutenção
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Manutenção Recente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {maintenance.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
          >
            <div>
              <p className="font-medium">{item.description}</p>
              {item.notes && <p className="text-sm text-[var(--color-text-muted)]">{item.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(item.date).toLocaleDateString('pt-BR')}
                </p>
                {item.cost && (
                  <p className="text-sm font-medium">R$ {item.cost.toLocaleString('pt-BR')}</p>
                )}
              </div>
              <RecordActions onDelete={() => deleteMutation.mutate(item.id)} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
