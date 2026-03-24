'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addMaintenance, fetchResidences } from '@/lib/actions/housing';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const CATEGORY_OPTIONS = [
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'reforma', label: 'Reforma' },
  { value: 'outros', label: 'Outros' },
];

type Props = {
  expanded?: boolean;
  onToggle?: () => void;
};

export function AddMaintenanceForm({ expanded = true, onToggle }: Props) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');

  const { data: residences } = useQuery({
    queryKey: ['housing', 'residences'],
    queryFn: fetchResidences,
    enabled: expanded,
  });

  const primaryResidence = residences?.find((r) => r.is_primary) ?? residences?.[0];

  const mutation = useMutation({
    mutationFn: () =>
      addMaintenance({
        residence_id: primaryResidence?.id ?? '',
        description,
        cost: cost ? Number.parseFloat(cost) : undefined,
      }),
    onSuccess: () => {
      setDescription('');
      setCategory('');
      setCost('');
      queryClient.invalidateQueries({ queryKey: ['housing', 'maintenance'] });
      toast.success('Manutenção registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar manutenção: ${err.message}`);
    },
  });

  const canSubmit = description.trim() && primaryResidence && !mutation.isPending;

  return (
    <div className="space-y-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Nova Manutenção
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria (opcional)"
            size="sm"
            options={CATEGORY_OPTIONS}
          />
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Custo (opcional)"
            step="0.01"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />
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
