'use client';

import { CommandPalette } from '@/components/shell/command-palette';
import { HydrationGate } from '@/components/shell/hydration-gate';
import { SetupGuard } from '@/components/shell/setup-guard';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/topbar';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useUIStore } from '@/lib/stores/ui-store';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';
import { cn } from '@/lib/utils/cn';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HydrationGate>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </HydrationGate>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <TopBar />
      <main
        className={cn(
          'pt-[var(--topbar-height)]',
          'transition-[margin-left] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]',
          // Mobile: no left margin (sidebar is an overlay). Desktop: shift by sidebar width.
          sidebarCollapsed ? 'md:ml-[var(--sidebar-collapsed)]' : 'md:ml-[var(--sidebar-width)]',
        )}
      >
        <div className="p-[var(--space-4)] md:p-[var(--space-6)]">
          <ErrorBoundary>
            <SetupGuard>{children}</SetupGuard>
          </ErrorBoundary>
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
