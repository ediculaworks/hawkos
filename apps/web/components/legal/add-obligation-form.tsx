'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addObligation } from '@/lib/actions/legal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type { ObligationFrequency, ObligationType } from '@hawk/module-legal';

interface Props {
  onClose: () => void;
}

const typeOptions: { value: ObligationType; label: string }[] = [
  { value: 'tax', label: 'Imposto' },
  { value: 'declaration', label: 'Declaração' },
  { value: 'renewal', label: 'Renovação' },
  { value: 'payment', label: 'Pagamento' },
];

const frequencyOptions: { value: ObligationFrequency; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'one_time', label: 'Única vez' },
];

export function AddObligationForm({ onClose }: Props) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<ObligationType>('tax');
  const [dueDate, setDueDate] = useState('');
  const [frequency, setFrequency] = useState<ObligationFrequency | ''>('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      addObligation({
        name,
        type,
        due_date: dueDate,
        frequency: frequency || undefined,
        amount: amount ? Number.parseFloat(amount) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'obligations'] });
      queryClient.invalidateQueries({ queryKey: ['legal', 'urgent'] });
      toast.success('Obrigação criada!');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar obrigação: ${err.message}`);
    },
  });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface-1)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Nova Obrigação</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim() && dueDate) mutation.mutate();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Nome da obrigação (ex: DAS MEI)"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as ObligationType)}
          size="sm"
          options={typeOptions}
        />
        <Select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ObligationFrequency | '')}
          size="sm"
          placeholder="Frequência"
          options={frequencyOptions}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (R$)"
          step="0.01"
          min="0"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Observações (opcional)"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <Button
        size="sm"
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={!name.trim() || !dueDate || mutation.isPending}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar Obrigação'}
      </Button>
    </div>
  );
}
