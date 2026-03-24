'use client';
import { EmptyState } from '@/components/ui/empty-state';
import { RecordActions } from '@/components/ui/record-actions';
import { fetchRecentTransactions, removeTransaction } from '@/lib/actions/finances';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDateShort } from '@/lib/utils/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RecentTransactionsWidget() {
  const queryClient = useQueryClient();

  const { data: transactions } = useQuery({
    queryKey: ['finances', 'transactions-recent'],
    queryFn: () => fetchRecentTransactions(10),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      toast.success('Transação excluída');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  if (!transactions || transactions.length === 0) {
    return <EmptyState icon={ReceiptText} title="Nenhuma transação este mês" />;
  }

  return (
    <div className="space-y-[var(--space-1)]">
      {transactions.map((t) => (
        <div key={t.id} className="group flex items-center justify-between py-[var(--space-1-5)]">
          <div className="flex items-center gap-[var(--space-3)] min-w-0">
            <span className="text-[11px] text-[var(--color-text-muted)] w-12 flex-shrink-0">
              {formatDateShort(t.date)}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)] truncate">
              {t.description || '(sem descrição)'}
            </span>
          </div>
          <div className="flex items-center gap-[var(--space-2)]">
            <span
              className={cn(
                'font-mono text-xs flex-shrink-0',
                t.type === 'income'
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-text-primary)]',
              )}
            >
              {t.type === 'income' ? '+' : '-'}
              {formatCurrency(t.amount)}
            </span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <RecordActions onDelete={() => deleteMutation.mutate(t.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
