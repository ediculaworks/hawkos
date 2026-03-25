'use client';

import { addDemand } from '@/lib/actions/demands';
import { Button } from '@/components/ui/button';
import type { Agent } from '@/lib/agent-chat';
import { Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface DelegateModalProps {
  open: boolean;
  agent: Agent | null;
  onClose: () => void;
}

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'text-[var(--color-text-muted)]' },
  { value: 'medium', label: 'Média', color: 'text-[var(--color-warning)]' },
  { value: 'high', label: 'Alta', color: 'text-[var(--color-accent)]' },
  { value: 'urgent', label: 'Urgente', color: 'text-[var(--color-danger)]' },
];

export function DelegateModal({ open, agent, onClose }: DelegateModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Título é obrigatório');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await addDemand({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        agent_id: agent?.id,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar demanda');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const initials = agent?.name.slice(0, 2).toUpperCase() ?? 'AG';

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 m-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0 shadow-2xl backdrop:bg-black/60 w-full max-w-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-sm font-bold text-white">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Delegar tarefa
            </h2>
            {agent && (
              <p className="text-xs text-[var(--color-text-muted)]">para {agent.name}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {success ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center mx-auto mb-3">
              <Send className="h-5 w-5 text-[var(--color-success)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Tarefa delegada com sucesso
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="delegate-title"
                className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block"
              >
                Título <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                id="delegate-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O que precisa ser feito?"
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div>
              <label
                htmlFor="delegate-description"
                className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block"
              >
                Descrição
              </label>
              <textarea
                id="delegate-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais, contexto, requisitos..."
                rows={3}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </div>

            <div>
              <span className="text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                Prioridade
              </span>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex-1 py-2 px-1 text-sm font-medium rounded-[var(--radius-md)] transition-colors cursor-pointer border ${
                      priority === opt.value
                        ? 'bg-[var(--color-surface-3)] border-[var(--color-border)] ' + opt.color
                        : 'bg-[var(--color-surface-2)] border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="gap-2">
                <Send className="h-3.5 w-3.5" />
                {submitting ? 'Enviando...' : 'Delegar'}
              </Button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
