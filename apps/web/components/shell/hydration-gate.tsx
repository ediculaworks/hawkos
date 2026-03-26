'use client';

import { useLayoutStore } from '@/lib/stores/layout-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { useEffect, useState } from 'react';

const STALE_KEYS = ['hawk-ui', 'hawk-layout', 'hawk_active_session', 'hawk-onboarding-draft'];

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Cache bust: clear stale localStorage when build changes
    const stored = localStorage.getItem('hawk-build');
    // biome-ignore lint/suspicious/noExplicitAny: accessing injected window global
    const current = String((window as any).__HAWK_BUILD__ ?? 'dev');

    if (stored && stored !== current) {
      for (const key of STALE_KEYS) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem('hawk-build', current);

    // Rehydrate both Zustand stores from localStorage
    useUIStore.persist.rehydrate();
    useLayoutStore.persist.rehydrate();
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-0)]">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-pulse text-[var(--color-text-muted)] text-sm">Carregando...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
