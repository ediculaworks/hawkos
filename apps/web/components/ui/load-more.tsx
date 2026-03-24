'use client';

import { Loader2 } from 'lucide-react';

interface LoadMoreProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  total?: number;
  loaded?: number;
}

export function LoadMore({ hasMore, loading, onLoadMore, total, loaded }: LoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center py-4">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-[var(--radius-md)] transition-colors cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando...
          </>
        ) : (
          <>
            Carregar mais
            {total !== undefined && loaded !== undefined && (
              <span className="text-[var(--color-text-muted)]">
                ({loaded}/{total})
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
