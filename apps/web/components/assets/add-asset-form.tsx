'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { createAssetAction } from '@/lib/actions/assets';
import type { AssetCondition, AssetType } from '@hawk/module-assets/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

const typeOptions = [
  { value: 'electronics', label: 'Eletrônico' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'real_estate', label: 'Imóvel' },
  { value: 'investment', label: 'Investimento' },
  { value: 'furniture', label: 'Móvel' },
  { value: 'other', label: 'Outros' },
];

const conditionOptions = [
  { value: 'excellent', label: 'Excelente' },
  { value: 'good', label: 'Bom' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Ruim' },
];

interface AddAssetFormProps {
  onSuccess?: () => void;
}

export function AddAssetForm({ onSuccess }: AddAssetFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('other');
  const [value, setValue] = useState('');
  const [condition, setCondition] = useState<AssetCondition | ''>('');

  const mutation = useMutation({
    mutationFn: () =>
      createAssetAction({
        name,
        type,
        value: value ? Number.parseFloat(value) : undefined,
        condition: condition || undefined,
      }),
    onSuccess: () => {
      setName('');
      setType('other');
      setValue('');
      setCondition('');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Bem adicionado!');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar bem: ${err.message}`);
    },
  });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do bem"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <Select
        value={type}
        onChange={(e) => setType(e.target.value as AssetType)}
        size="sm"
        options={typeOptions}
      />
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Valor (R$)"
        step="0.01"
        min="0"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <Select
        value={condition}
        onChange={(e) => setCondition(e.target.value as AssetCondition | '')}
        placeholder="Condição (opcional)"
        size="sm"
        options={conditionOptions}
      />
      <Button
        size="sm"
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={!name || !type || mutation.isPending}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  );
}
