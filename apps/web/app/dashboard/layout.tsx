'use client';

import { CommandPalette } from '@/components/shell/command-palette';
import { FloatingAgentCTA } from '@/components/shell/floating-agent-cta';
import { HydrationGate } from '@/components/shell/hydration-gate';
import { Sidebar } from '@/components/shell/sidebar';
import { TopBar } from '@/components/shell/topbar';
import { WelcomeWizard } from '@/components/dashboard/welcome-wizard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';
import { useUIStore } from '@/lib/stores/ui-store';
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
          sidebarCollapsed ? 'ml-[var(--sidebar-collapsed)]' : 'ml-[var(--sidebar-width)]',
        )}
      >
        <div className="p-[var(--space-6)]">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <FloatingAgentCTA />
      <CommandPalette />
      <WelcomeWizard />
    </div>
  );
}
