'use client';

import { Button } from '@/components/ui/button';
import { addBill, fetchResidences } from '@/lib/actions/housing';
import { cn } from '@/lib/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  expanded?: boolean;
  onToggle?: () => void;
};

export function AddBillForm({ expanded = true, onToggle }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('');

  const { data: residences } = useQuery({
    queryKey: ['housing', 'residences'],
    queryFn: fetchResidences,
    enabled: expanded,
  });

  const primaryResidence = residences?.find((r) => r.is_primary) ?? residences?.[0];

  const mutation = useMutation({
    mutationFn: () =>
      addBill({
        residence_id: primaryResidence?.id ?? '',
        name,
        amount: Number.parseFloat(amount),
        due_day: Number.parseInt(dueDay, 10),
      }),
    onSuccess: () => {
      setName('');
      setAmount('');
      setDueDay('');
      queryClient.invalidateQueries({ queryKey: ['housing'] });
      toast.success('Conta adicionada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar conta: ${err.message}`);
    },
  });

  const canSubmit = name.trim() && amount && dueDay && primaryResidence && !mutation.isPending;

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Nova Conta
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

      {expanded && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da conta"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex gap-[var(--space-2)]">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="R$ 0,00"
              step="0.01"
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="number"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="Dia"
              min="1"
              max="31"
              className={cn(
                'w-16 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]',
                'bg-[var(--color-surface-0)] px-[var(--space-2)] py-[var(--space-1-5)] text-sm text-center',
                'text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]',
              )}
            />
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            Salvar
          </Button>
        </>
      )}
    </div>
  );
}
