'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { useEffect } from 'react';

export function HydrationGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useUIStore.persist.rehydrate();
  }, []);

  return <>{children}</>;
}
