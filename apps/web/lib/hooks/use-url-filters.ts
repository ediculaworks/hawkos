'use client';

/**
 * useURLFilters — URL-synced filter state for dashboard pages.
 *
 * Replaces the repeated updateParams/useState pattern across pages.
 * All filter state is persisted in the URL, making pages shareable
 * and bookmark-friendly.
 *
 * Inspired by TaxHacker's URL-synced filter pattern.
 *
 * Usage:
 *   const { get, set, setMany, remove, toRecord } = useURLFilters('/dashboard/finances');
 *   const month = get('month') ?? '2026-04';
 *   set('month', '2026-05');
 *   setMany({ month: '2026-05', category: 'food' });
 *   remove('category');
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

interface UseURLFiltersReturn {
  /** Get a single filter value from URL */
  get: (key: string) => string | null;
  /** Set a single filter value in URL (null removes it) */
  set: (key: string, value: string | null) => void;
  /** Set multiple filter values at once */
  setMany: (updates: Record<string, string | null>) => void;
  /** Remove a filter from URL */
  remove: (key: string) => void;
  /** Get all current filter values as a record */
  toRecord: () => Record<string, string>;
  /** Get the raw URLSearchParams object */
  params: URLSearchParams;
}

export function useURLFilters(basePath: string): UseURLFiltersReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const get = useCallback((key: string) => searchParams.get(key), [searchParams]);

  const setMany = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [router, searchParams, basePath],
  );

  const set = useCallback(
    (key: string, value: string | null) => setMany({ [key]: value }),
    [setMany],
  );

  const remove = useCallback((key: string) => setMany({ [key]: null }), [setMany]);

  const toRecord = useCallback(() => {
    const record: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      record[key] = value;
    }
    return record;
  }, [searchParams]);

  return { get, set, setMany, remove, toRecord, params };
}
