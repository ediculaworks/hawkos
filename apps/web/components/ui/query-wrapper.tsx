'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

interface QueryWrapperProps<T> {
  query: UseQueryResult<T>;
  skeleton?: ReactNode;
  emptyState?: ReactNode;
  children: (data: T) => ReactNode;
}

export function QueryWrapper<T>({ query, skeleton, emptyState, children }: QueryWrapperProps<T>) {
  if (query.isLoading) {
    return (
      skeleton ?? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-[var(--color-surface-3)] rounded w-2/3" />
          <div className="h-4 bg-[var(--color-surface-3)] rounded w-1/2" />
          <div className="h-4 bg-[var(--color-surface-3)] rounded w-3/4" />
        </div>
      )
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5">
        <AlertCircle className="h-4 w-4 text-[var(--color-danger)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-primary)]">Erro ao carregar dados</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {query.error instanceof Error ? query.error.message : 'Tente novamente'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (query.data === undefined || query.data === null) {
    return null;
  }

  if (emptyState && Array.isArray(query.data) && query.data.length === 0) {
    return <>{emptyState}</>;
  }

  return <>{children(query.data)}</>;
}
