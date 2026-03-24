import { Home, Search } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-1)] p-[var(--space-4)]">
      <div className="text-center">
        <div className="text-8xl font-bold text-[var(--color-accent)] mb-[var(--space-4)]">404</div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-[var(--space-2)]">
          Página não encontrada
        </h1>
        <p className="text-[var(--color-text-muted)] mb-[var(--space-6)] max-w-md">
          A página que você está procurando não existe ou foi movida.
        </p>
        <div className="flex gap-[var(--space-3)] justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] bg-[var(--color-accent)] text-white rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
          >
            <Home className="h-4 w-4" />
            Voltar ao Início
          </Link>
          <Link
            href="/dashboard/chat"
            className="inline-flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--color-surface-1)] transition-colors"
          >
            <Search className="h-4 w-4" />
            Ir para Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
