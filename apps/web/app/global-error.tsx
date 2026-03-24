'use client';

import { Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // biome-ignore lint/suspicious/noConsole: Error logging for debugging
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-1)] p-[var(--space-4)]">
      <div className="text-center max-w-lg">
        <div className="text-6xl font-bold text-[var(--color-error)] mb-[var(--space-4)]">
          Oops!
        </div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-[var(--space-2)]">
          Algo deu errado
        </h1>
        <p className="text-[var(--color-text-muted)] mb-[var(--space-6)]">
          Ocorreu um erro inesperado. Por favor, tente novamente.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-text-muted)] mb-[var(--space-4)] font-mono">
            Erro: {error.digest}
          </p>
        )}
        <div className="flex gap-[var(--space-3)] justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar Novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] transition-colors"
          >
            <Home className="h-4 w-4" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
