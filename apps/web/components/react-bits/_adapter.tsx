'use client';

import { useReducedMotion } from '@/lib/animations/use-reduced-motion';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/*  useResolvedTokens — resolve CSS custom properties for canvas use  */
/* ------------------------------------------------------------------ */

function getTokenValues(varNames: string[]): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const style = getComputedStyle(document.documentElement);
  const result: Record<string, string> = {};
  for (const name of varNames) {
    result[name] = style.getPropertyValue(name).trim();
  }
  return result;
}

let tokenVersion = 0;
const tokenListeners = new Set<() => void>();

function subscribeTokens(cb: () => void) {
  tokenListeners.add(cb);
  return () => tokenListeners.delete(cb);
}

// Watch for theme changes via data-theme attribute
if (typeof window !== 'undefined') {
  const observer = new MutationObserver(() => {
    tokenVersion++;
    for (const cb of tokenListeners) cb();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  });
}

export function useResolvedTokens(varNames: string[]): Record<string, string> {
  const version = useSyncExternalStore(
    subscribeTokens,
    () => tokenVersion,
    () => 0,
  );

  const key = varNames.join(',');
  const [tokens, setTokens] = useState<Record<string, string>>({});

  // biome-ignore lint/correctness/useExhaustiveDependencies: version triggers re-resolve on theme change, key is stable serialization of varNames
  useEffect(() => {
    setTokens(getTokenValues(varNames));
  }, [version, key]);

  return tokens;
}

/* ------------------------------------------------------------------ */
/*  ReactBitsGuard — SSR + reduced-motion safety wrapper              */
/* ------------------------------------------------------------------ */

type GuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Skip reduced-motion check (for pure CSS effects) */
  skipMotionCheck?: boolean;
};

export function ReactBitsGuard({ children, fallback = null, skipMotionCheck = false }: GuardProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  if (!skipMotionCheck && reduced) return <>{fallback}</>;

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/*  useIsMobile — skip heavy effects on mobile                        */
/* ------------------------------------------------------------------ */

export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);

  return mobile;
}
