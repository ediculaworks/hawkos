'use client';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { addMedia } from '@/lib/actions/entertainment';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: 'movie', label: 'Filme' },
  { value: 'series', label: 'Série' },
  { value: 'game', label: 'Jogo' },
  { value: 'music_album', label: 'Álbum' },
  { value: 'book_fiction', label: 'Livro' },
];

export function AddMediaForm({ onClose }: { onClose?: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('movie');

  const mutation = useMutation({
    mutationFn: () => addMedia({ title, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entertainment'] });
      setTitle('');
      toast.success('Mídia adicionada!');
      onClose?.();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <div className="flex gap-[var(--space-2)] items-end">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-1-5)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title) mutation.mutate();
          if (e.key === 'Escape') onClose?.();
        }}
      />
      <Select
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={TYPE_OPTIONS}
        size="sm"
      />
      <Button size="sm" onClick={() => mutation.mutate()} disabled={!title || mutation.isPending}>
        Salvar
      </Button>
    </div>
  );
}
