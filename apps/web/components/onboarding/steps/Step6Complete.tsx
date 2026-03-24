'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle, Download } from 'lucide-react';

interface Step6CompleteProps {
  slot: string;
  envContent: string;
  onComplete: () => void;
}

export function Step6Complete({ slot, envContent, onComplete }: Step6CompleteProps) {
  const handleDownload = () => {
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `.env.${slot.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/20">
          <CheckCircle className="h-8 w-8 text-[var(--color-success)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Sistema Configurado!</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Seu workspace está pronto. Você já está logado e pode acessar o dashboard.
        </p>
      </div>

      {envContent && (
        <div className="p-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
          <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-2">
            Agent .env (opcional)
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Se quiser rodar o agent Discord localmente, baixe este arquivo e coloque em{' '}
            <code className="text-[var(--color-accent)]">apps/agent/.env</code>.
          </p>
          <Button variant="outline" size="sm" onClick={handleDownload} className="w-full">
            <Download className="h-3 w-3 mr-2" />
            Baixar .env para Agent
          </Button>
        </div>
      )}

      <Button onClick={onComplete} className="w-full">
        Ir para Dashboard →
      </Button>
    </div>
  );
}
