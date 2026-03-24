'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecordActions } from '@/components/ui/record-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteBill, fetchMonthlyBillTotal, fetchPendingBills } from '@/lib/actions/housing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import toast from 'react-hot-toast';

export function BillsList() {
  const queryClient = useQueryClient();

  const { data: bills, isLoading: loadingBills } = useQuery({
    queryKey: ['housing', 'pending-bills'],
    queryFn: fetchPendingBills,
  });

  const { data: total, isLoading: loadingTotal } = useQuery({
    queryKey: ['housing', 'monthly-total'],
    queryFn: fetchMonthlyBillTotal,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['housing', 'pending-bills'] });
      queryClient.invalidateQueries({ queryKey: ['housing', 'monthly-total'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover conta: ${err.message}`);
    },
  });

  const isLoading = loadingBills || loadingTotal;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Contas do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bills || bills.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Contas do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            Nenhuma conta cadastrada
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Contas ({bills.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {bills.map((bill) => (
          <div
            key={bill.id}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]"
          >
            <div>
              <p className="font-medium">{bill.name}</p>
              {bill.due_day && (
                <p className="text-sm text-[var(--color-text-muted)]">Dia {bill.due_day}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {bill.amount && (
                <span className="font-medium">
                  R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
              <RecordActions onDelete={() => deleteMutation.mutate(bill.id)} />
            </div>
          </div>
        ))}
        {total !== undefined && total > 0 && (
          <div className="pt-3 mt-3 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-text-muted)]">Total</p>
            <p className="text-lg font-semibold">
              R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
