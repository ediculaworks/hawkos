'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 m-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0 shadow-2xl backdrop:bg-black/50 max-w-md w-full"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] mb-6">{description}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={
              variant === 'danger'
                ? 'bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 text-white'
                : ''
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
