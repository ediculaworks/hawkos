'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDemand } from '@/lib/actions/demands';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';

type Props = {
  onClose?: () => void;
};

export function DemandCreateForm({ onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await addDemand({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      });
      queryClient.invalidateQueries({ queryKey: ['demands'] });
      setTitle('');
      setDescription('');
      onClose?.();
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: client-side error feedback
      console.error('Failed to create demand:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-4)] space-y-[var(--space-3)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Nova demanda</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Input
        placeholder="O que precisa ser feito?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <textarea
        placeholder="Descricao detalhada (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-sm bg-[var(--color-surface-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] resize-none"
      />

      <div className="flex items-center gap-[var(--space-2)]">
        <span className="text-[10px] text-[var(--color-text-muted)]">Prioridade:</span>
        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              priority === p
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
                : 'border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border)]'
            }`}
          >
            {p === 'low' ? 'Baixa' : p === 'medium' ? 'Media' : p === 'high' ? 'Alta' : 'Urgente'}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!title.trim() || loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Criar demanda
        </Button>
      </div>
    </form>
  );
}
