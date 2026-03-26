'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { useEffect, useState } from 'react';

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    useUIStore.persist.rehydrate();
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return <>{children}</>;
}
