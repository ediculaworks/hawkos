'use client';

import { fetchModuleFrecency, trackModuleAccess } from '@/lib/actions/frecency';
import type { ModuleFrecency } from '@/lib/actions/frecency';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

/**
 * Hook to fetch module frecency scores and provide a tracking function.
 * Returns a Map<moduleId, frecencyScore> for fast lookups.
 */
export function useModuleFrecency() {
  const { data } = useQuery<ModuleFrecency[]>({
    queryKey: ['module-frecency'],
    queryFn: fetchModuleFrecency,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const scores = new Map<string, number>();
  if (data) {
    for (const entry of data) {
      scores.set(entry.module_id, entry.frecency_score);
    }
  }

  // Debounce tracking to avoid spamming on rapid navigation
  const lastTracked = useRef<string>('');
  const track = useCallback((moduleId: string) => {
    if (lastTracked.current === moduleId) return;
    lastTracked.current = moduleId;
    trackModuleAccess(moduleId, 'page_view').catch(() => {});
  }, []);

  return { scores, track };
}

/**
 * Sort modules by frecency score (highest first).
 * Modules without scores keep their original order.
 */
export function sortByFrecency<T extends { id: string }>(
  modules: T[],
  scores: Map<string, number>,
): T[] {
  if (scores.size === 0) return modules;

  return [...modules].sort((a, b) => {
    const scoreA = scores.get(a.id) ?? -1;
    const scoreB = scores.get(b.id) ?? -1;
    // Both have scores: sort by score descending
    if (scoreA >= 0 && scoreB >= 0) return scoreB - scoreA;
    // Only one has score: scored module goes first
    if (scoreA >= 0) return -1;
    if (scoreB >= 0) return 1;
    // Neither has score: keep original order
    return 0;
  });
}
