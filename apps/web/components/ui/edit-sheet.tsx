'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

interface EditSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function EditSheet({ open, onClose, title, children }: EditSheetProps) {
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
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === dialogRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-0 ml-auto h-full max-h-full w-full max-w-md border-l border-[var(--color-border)] bg-[var(--color-surface-1)] p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}
