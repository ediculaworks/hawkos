'use client';

import { useUIStore } from '@/lib/stores/ui-store';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Global navigation keyboard shortcuts for the dashboard.
 *
 * Two-key sequences (g then X):
 *   g → h   /dashboard
 *   g → f   /dashboard/finances
 *   g → s   /dashboard/health  (saude)
 *   g → p   /dashboard/people
 *   g → r   /dashboard/routine
 *   g → o   /dashboard/objectives
 *   g → c   /dashboard/calendar
 *
 * Single-key shortcuts (when not in an input):
 *   n       open command palette
 *   Escape  close command palette (handled by palette itself; here for modals)
 *
 * Already handled by use-command-palette.ts (do NOT duplicate):
 *   ⌘K / Ctrl+K  toggle command palette
 *   ⌘/ / Ctrl+/  toggle sidebar
 *   ?            show keyboard shortcuts help
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);

  // Tracks whether the previous keypress was 'g' (to detect two-key sequences)
  const lastKeyRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const SEQUENCE_TIMEOUT_MS = 1000;

    const handler = (e: KeyboardEvent) => {
      // Never fire shortcuts when user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable;

      if (isEditable) {
        lastKeyRef.current = '';
        return;
      }

      // Don't fire when modifier keys are held (let ⌘K etc. pass through)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const now = Date.now();
      const prev = lastKeyRef.current;
      const elapsed = now - lastKeyTimeRef.current;

      // Reset sequence if too much time has passed
      if (elapsed > SEQUENCE_TIMEOUT_MS) {
        lastKeyRef.current = '';
      }

      // --- Two-key sequences starting with 'g' ---
      if (prev === 'g') {
        const routes: Record<string, string> = {
          h: '/dashboard',
          f: '/dashboard/finances',
          s: '/dashboard/health',
          p: '/dashboard/people',
          r: '/dashboard/routine',
          o: '/dashboard/objectives',
          c: '/dashboard/calendar',
        };

        const route = routes[e.key as keyof typeof routes];
        if (route) {
          e.preventDefault();
          router.push(route);
          lastKeyRef.current = '';
          return;
        }

        // Key after 'g' didn't match — reset so 'g' isn't re-used
        lastKeyRef.current = '';
      }

      // Record 'g' as the start of a potential sequence
      if (e.key === 'g') {
        e.preventDefault(); // prevent browser's default 'g' behaviour
        lastKeyRef.current = 'g';
        lastKeyTimeRef.current = now;
        return;
      }

      // --- Single-key shortcuts ---

      // 'n' → open command palette (only when palette is closed)
      if (e.key === 'n' && !commandPaletteOpen) {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      lastKeyRef.current = '';
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, openCommandPalette, commandPaletteOpen]);
}
