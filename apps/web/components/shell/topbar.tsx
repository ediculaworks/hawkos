'use client';

import { ReactBitsGuard } from '@/components/react-bits/_adapter';
import BlurText from '@/components/react-bits/text/blur-text';
import { fetchProfileName } from '@/lib/actions/profile';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Command, LayoutGrid, LogOut, Menu, MessageSquare, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatTodayDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
}

export function TopBar() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dateStr, setDateStr] = useState('');
  const hasAnimated = useRef(false);

  useEffect(() => {
    setGreeting(getGreeting());
    setDateStr(formatTodayDate());
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const { data: profileName } = useQuery({
    queryKey: ['profile', 'name'],
    queryFn: fetchProfileName,
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey[0];
        return typeof key === 'string' && key !== 'sidebar-badge';
      },
    });
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex h-[var(--topbar-height)] items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]/80 backdrop-blur-md px-[var(--space-4)] md:px-[var(--space-6)]',
        'transition-[left] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]',
        // Mobile: full width (sidebar is overlay). Desktop: offset by sidebar width.
        'left-0',
        sidebarCollapsed ? 'md:left-[var(--sidebar-collapsed)]' : 'md:left-[var(--sidebar-width)]',
      )}
    >
      <div className="flex items-center gap-[var(--space-3)]">
        {/* Hamburger: visible only on mobile */}
        <button
          type="button"
          onClick={toggleSidebarMobile}
          title="Abrir menu"
          aria-label="Abrir menu de navegação"
          className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <LayoutGrid className="hidden md:block h-4 w-4 text-[var(--color-text-muted)]" />
        <div>
          {greeting && !hasAnimated.current ? (
            <ReactBitsGuard
              fallback={
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {greeting}, {profileName ?? 'Usuário'}
                </p>
              }
            >
              <BlurText
                text={`${greeting}, ${profileName ?? 'Usuário'}`}
                delay={80}
                className="text-sm font-medium text-[var(--color-text-primary)]"
                animateBy="words"
                direction="top"
                onAnimationComplete={() => {
                  hasAnimated.current = true;
                }}
              />
            </ReactBitsGuard>
          ) : (
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {greeting ? `${greeting}, ` : ''}
              {profileName ?? 'Usuário'}
            </p>
          )}
          {dateStr && (
            <p className="text-xs text-[var(--color-text-muted)] capitalize">{dateStr}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard/chat')}
          title="Falar com Hawk"
          aria-label="Falar com Hawk"
          className="flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer text-xs"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Hawk</span>
        </button>
        <button
          type="button"
          onClick={openCommandPalette}
          title="Paleta de comandos (⌘K)"
          aria-label="Abrir paleta de comandos"
          className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer"
        >
          <Command className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          title="Atualizar dados"
          aria-label="Atualizar dados"
          className={cn(
            'p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer',
            refreshing && 'animate-spin',
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          aria-label="Sair da conta"
          className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
