'use client';

import { cn } from '@/lib/utils/cn';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface RecordActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteConfirmLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function RecordActions({
  onEdit,
  onDelete,
  deleteConfirmLabel = 'Excluir?',
  className,
  size = 'sm',
}: RecordActionsProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const btnSize = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <div className={cn('flex items-center gap-[var(--space-0-5)] flex-shrink-0', className)}>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            btnSize,
            'rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer',
          )}
          title="Editar"
        >
          <Pencil className={iconSize} />
        </button>
      )}
      {onDelete && !confirmingDelete && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className={cn(
            btnSize,
            'rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer',
          )}
          title="Excluir"
        >
          <Trash2 className={iconSize} />
        </button>
      )}
      {onDelete && confirmingDelete && (
        <div className="flex items-center gap-[var(--space-1)]">
          <button
            type="button"
            onClick={() => {
              onDelete();
              setConfirmingDelete(false);
            }}
            className="px-[var(--space-2)] py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-danger)] text-white text-[10px] font-medium cursor-pointer hover:bg-[var(--color-danger)]/90 transition-colors"
          >
            {deleteConfirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="px-[var(--space-2)] py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-[10px] cursor-pointer hover:bg-[var(--color-surface-3)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
