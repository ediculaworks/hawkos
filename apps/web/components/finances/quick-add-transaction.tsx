'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addTransaction, fetchAccounts, fetchCategories } from '@/lib/actions/finances';
import { cn } from '@/lib/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  expanded?: boolean;
  onToggle?: () => void;
};

export function QuickAddTransaction({ expanded = true, onToggle }: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['finances', 'accounts'],
    queryFn: () => fetchAccounts(),
  });
  const { data: categories } = useQuery({
    queryKey: ['finances', 'categories', type],
    queryFn: () => fetchCategories(type),
  });

  const mutation = useMutation({
    mutationFn: () =>
      addTransaction({
        type,
        amount: Number.parseFloat(amount),
        description,
        account_id: accountId,
        category_id: categoryId,
      }),
    onSuccess: () => {
      setAmount('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      toast.success('Transação registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar transação: ${err.message}`);
    },
  });

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Adicionar
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        )}
      </div>

      {!expanded && !onToggle && null}

      {expanded && (
        <>
          {/* Type toggle */}
          <div className="flex gap-[var(--space-0-5)] rounded-[var(--radius-md)] bg-[var(--color-surface-1)] p-[var(--space-0-5)]">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                'flex-1 py-[var(--space-1)] rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer',
                type === 'expense'
                  ? 'bg-[var(--color-danger)] text-white'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={cn(
                'flex-1 py-[var(--space-1)] rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors cursor-pointer',
                type === 'income'
                  ? 'bg-[var(--color-success)] text-white'
                  : 'text-[var(--color-text-muted)]',
              )}
            >
              Receita
            </button>
          </div>

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="R$ 0,00"
            step="0.01"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Conta"
            size="sm"
            options={accounts?.map((a) => ({ value: a.id, label: a.name })) ?? []}
          />
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder="Categoria"
            size="sm"
            options={categories?.map((c) => ({ value: c.id, label: c.name })) ?? []}
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!amount || !accountId || !categoryId || mutation.isPending}
          >
            Salvar
          </Button>
        </>
      )}
    </div>
  );
}
