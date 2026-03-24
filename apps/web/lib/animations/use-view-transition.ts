'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useViewTransitionRouter() {
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      const doc = document as unknown as { startViewTransition?: (cb: () => void) => void };
      if (!doc.startViewTransition) {
        router.push(href);
        return;
      }
      doc.startViewTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  return { navigate, router };
}
