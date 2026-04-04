'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addLegalEntity } from '@/lib/actions/legal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import type { LegalEntityType } from '@hawk/module-legal';

interface Props {
  onClose: () => void;
}

const typeOptions: { value: LegalEntityType; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'mei', label: 'MEI' },
  { value: 'ltda', label: 'LTDA' },
  { value: 'sa', label: 'S.A.' },
];

export function AddEntityForm({ onClose }: Props) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<LegalEntityType>('cpf');
  const [document, setDocument] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      addLegalEntity({
        name,
        type,
        document: document || undefined,
        registration_date: registrationDate || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal', 'entities'] });
      toast.success('Entidade criada!');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar entidade: ${err.message}`);
    },
  });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)] bg-[var(--color-surface-1)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          Nova Entidade Jurídica
        </span>
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
          if (e.key === 'Enter' && name.trim()) mutation.mutate();
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Nome da entidade"
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as LegalEntityType)}
          size="sm"
          options={typeOptions}
        />
        <input
          type="text"
          value={document}
          onChange={(e) => setDocument(e.target.value)}
          placeholder="CPF / CNPJ"
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div>
        <label
          htmlFor="entity-registration-date"
          className="block text-[10px] text-[var(--color-text-muted)] mb-1"
        >
          Data de abertura (opcional)
        </label>
        <input
          id="entity-registration-date"
          type="date"
          value={registrationDate}
          onChange={(e) => setRegistrationDate(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
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
        disabled={!name.trim() || mutation.isPending}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar Entidade'}
      </Button>
    </div>
  );
}
