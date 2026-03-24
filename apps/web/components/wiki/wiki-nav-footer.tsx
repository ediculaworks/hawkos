'use client';

import { flattenNav } from '@/lib/wiki-nav';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface WikiNavFooterProps {
  currentSlug: string;
}

export function WikiNavFooter({ currentSlug }: WikiNavFooterProps) {
  const all = flattenNav();
  const idx = all.findIndex((item) => item.slug === currentSlug);

  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-[var(--space-12)] pt-[var(--space-6)] border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-[var(--space-4)]">
      {prev ? (
        <Link
          href={`/dashboard/wiki/${prev.slug}`}
          className="group flex items-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-4)] py-[var(--space-3)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors max-w-[48%]"
        >
          <ChevronLeft className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0 transition-colors" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-[2px]">
              Anterior
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {prev.title}
            </p>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={`/dashboard/wiki/${next.slug}`}
          className="group flex items-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-[var(--space-4)] py-[var(--space-3)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors max-w-[48%] text-right ml-auto"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-[2px]">
              Próximo
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {next.title}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] flex-shrink-0 transition-colors" />
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
