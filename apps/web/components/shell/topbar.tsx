'use client';

import { fetchProfileName } from '@/lib/actions/profile';
import { useUIStore } from '@/lib/stores/ui-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Command, LayoutGrid, LogOut, MessageSquare, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
  const { sidebarCollapsed, openCommandPalette } = useUIStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex h-[var(--topbar-height)] items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]/80 backdrop-blur-md px-[var(--space-6)]',
        'transition-[left] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]',
        sidebarCollapsed ? 'left-[var(--sidebar-collapsed)]' : 'left-[var(--sidebar-width)]',
      )}
    >
      <div className="flex items-center gap-[var(--space-3)]">
        <LayoutGrid className="h-4 w-4 text-[var(--color-text-muted)]" />
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {getGreeting()}, {profileName ?? 'Usuário'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] capitalize">{formatTodayDate()}</p>
        </div>
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard/chat')}
          title="Falar com Hawk"
          className="flex items-center gap-[var(--space-1)] px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer text-xs"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Hawk</span>
        </button>
        <button
          type="button"
          onClick={openCommandPalette}
          title="Paleta de comandos (⌘K)"
          className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer"
        >
          <Command className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          title="Atualizar dados"
          className={cn(
            'p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer',
            refreshing && 'animate-spin',
          )}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)] transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
