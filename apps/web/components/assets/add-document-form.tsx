'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { createDocumentAction } from '@/lib/actions/assets';
import type { DocumentType } from '@hawk/module-assets/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

const typeOptions = [
  { value: 'identity', label: 'Identidade' },
  { value: 'contract', label: 'Contrato' },
  { value: 'tax', label: 'Imposto' },
  { value: 'health', label: 'Saúde' },
  { value: 'property', label: 'Propriedade' },
  { value: 'vehicle', label: 'Veículo' },
  { value: 'other', label: 'Outro' },
];

interface AddDocumentFormProps {
  onSuccess?: () => void;
}

export function AddDocumentForm({ onSuccess }: AddDocumentFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<DocumentType>('other');
  const [expiresAt, setExpiresAt] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createDocumentAction({
        name,
        type,
        expires_at: expiresAt || undefined,
      }),
    onSuccess: () => {
      setName('');
      setType('other');
      setExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Documento adicionado!');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar documento: ${err.message}`);
    },
  });

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome do documento"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
      />
      <Select
        value={type}
        onChange={(e) => setType(e.target.value as DocumentType)}
        size="sm"
        options={typeOptions}
      />
      <div className="space-y-1">
        <label htmlFor="doc-expires-at" className="text-xs text-[var(--color-text-muted)]">
          Validade (opcional)
        </label>
        <input
          id="doc-expires-at"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>
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
