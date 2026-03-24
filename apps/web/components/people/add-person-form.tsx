'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addPerson } from '@/lib/actions/people';
import type { Relationship } from '@hawk/module-people/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Plus } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const RELATIONSHIP_OPTIONS: Array<{ value: Relationship; label: string }> = [
  { value: 'family', label: 'Família' },
  { value: 'friend', label: 'Amigo' },
  { value: 'colleague', label: 'Colega' },
  { value: 'romantic', label: 'Romântico' },
  { value: 'professional', label: 'Profissional' },
  { value: 'medical', label: 'Médico' },
];

type Props = {
  expanded?: boolean;
  onToggle?: () => void;
};

export function AddPersonForm({ expanded = true, onToggle }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [importance, setImportance] = useState('5');

  const mutation = useMutation({
    mutationFn: () =>
      addPerson({
        name,
        relationship: (relationship as Relationship) || undefined,
        phone: phone || undefined,
        email: email || undefined,
        city: city || undefined,
        importance: importance ? Number.parseInt(importance, 10) : undefined,
      }),
    onSuccess: () => {
      setName('');
      setRelationship('');
      setPhone('');
      setEmail('');
      setCity('');
      setImportance('5');
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast.success('Contato adicionado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar contato: ${err.message}`);
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

      {expanded && (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome *"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />

          <Select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Relacionamento"
            size="sm"
            options={RELATIONSHIP_OPTIONS}
          />

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />

          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Cidade"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          />

          <div className="flex items-center gap-[var(--space-2)]">
            <label className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
              Importância
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
              className="flex-1 accent-[var(--color-mod-people)]"
            />
            <span className="text-xs font-mono text-[var(--color-text-primary)] w-4 text-right">
              {importance}
            </span>
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
          >
            Salvar
          </Button>
        </>
      )}
    </div>
  );
}
