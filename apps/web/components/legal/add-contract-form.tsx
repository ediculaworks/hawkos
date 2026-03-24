'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addContract } from '@/lib/actions/legal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type { ContractType } from '@hawk/module-legal';

interface Props {
  onClose: () => void;
}

const typeOptions: { value: ContractType; label: string }[] = [
  { value: 'service', label: 'Serviço' },
  { value: 'employment', label: 'Trabalho' },
  { value: 'rental', label: 'Aluguel' },
  { value: 'partnership', label: 'Parceria' },
  { value: 'other', label: 'Outro' },
];

export function AddContractForm({ onClose }: Props) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [parties, setParties] = useState('');
  const [type, setType] = useState<ContractType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      addContract({
        title,
        parties: parties
          ? parties
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        type: type || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        value: value ? Number.parseFloat(value) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'contracts'] });
      toast.success('Contrato criado!');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar contrato: ${err.message}`);
    },
  });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface-1)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Novo Contrato</span>
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
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Título do contrato"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <input
        type="text"
        value={parties}
        onChange={(e) => setParties(e.target.value)}
        placeholder="Partes envolvidas (separadas por vírgula)"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as ContractType | '')}
          size="sm"
          placeholder="Tipo"
          options={typeOptions}
        />
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valor (R$)"
          step="0.01"
          min="0"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">
            Vencimento
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
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
        disabled={!title.trim() || mutation.isPending}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar Contrato'}
      </Button>
    </div>
  );
}
