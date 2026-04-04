'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface Step6CompleteProps {
  slot: string;
  envContent: string;
  onComplete: () => void;
}

export function Step6Complete({
  slot: _slot,
  envContent: _envContent,
  onComplete,
}: Step6CompleteProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/20">
          <CheckCircle className="h-8 w-8 text-[var(--color-success)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Sistema Configurado!</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Seu workspace está pronto. O agent foi notificado automaticamente e vai conectar ao
          Discord em instantes.
        </p>
      </div>

      <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          Nenhuma configuração manual é necessária. O agent detecta novos workspaces
          automaticamente.
        </p>
      </div>

      <Button onClick={onComplete} className="w-full">
        Ir para Dashboard
      </Button>
    </div>
  );
}
