'use client';

import { MODULE_CONFIG } from '@/lib/modules';
import { useUIStore } from '@/lib/stores/ui-store';
import {
  Activity,
  Calendar,
  CheckSquare,
  Dumbbell,
  type LucideIcon,
  MessageSquare,
  Scale,
  Settings,
  Target,
  Timer,
  Wallet,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type PaletteCommand = {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  category: string;
  shortcut?: string;
  action: () => void;
};

type UseCommandPaletteReturn = {
  isOpen: boolean;
  showHelp: boolean;
  query: string;
  selectedIndex: number;
  filteredCommands: PaletteCommand[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  setQuery: (q: string) => void;
  execute: () => void;
  moveSelection: (delta: number) => void;
};

export function useCommandPalette(): UseCommandPaletteReturn {
  const router = useRouter();
  const { toggleSidebar, commandPaletteOpen, openCommandPalette, closeCommandPalette } =
    useUIStore();
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const openHelp = useCallback(() => {
    setShowHelp(true);
    setQuery('');
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  const open = useCallback(() => {
    openCommandPalette();
    setQuery('');
    setSelectedIndex(0);
  }, [openCommandPalette]);

  const close = useCallback(() => {
    closeCommandPalette();
    setQuery('');
    setSelectedIndex(0);
  }, [closeCommandPalette]);

  const toggle = useCallback(() => {
    if (commandPaletteOpen) {
      close();
    } else {
      open();
    }
  }, [commandPaletteOpen, open, close]);

  const allCommands = useMemo<PaletteCommand[]>(() => {
    // Quick actions first — they surface at top without filtering
    const actions: PaletteCommand[] = [
      {
        id: 'qa-transaction',
        label: 'Nova transação',
        icon: Wallet,
        iconColor: 'var(--color-mod-finances)',
        category: 'Ações Rápidas',
        shortcut: 'T',
        action: () => {
          router.push('/dashboard/finances?action=new');
          close();
        },
      },
      {
        id: 'qa-task',
        label: 'Nova tarefa',
        icon: CheckSquare,
        iconColor: 'var(--color-mod-objectives)',
        category: 'Ações Rápidas',
        shortcut: 'A',
        action: () => {
          router.push('/dashboard/objectives?action=new-task');
          close();
        },
      },
      {
        id: 'qa-goal',
        label: 'Nova meta',
        icon: Target,
        iconColor: 'var(--color-mod-objectives)',
        category: 'Ações Rápidas',
        shortcut: 'G',
        action: () => {
          router.push('/dashboard/objectives?action=new-goal');
          close();
        },
      },
      {
        id: 'qa-habit',
        label: 'Novo hábito',
        icon: Activity,
        iconColor: 'var(--color-mod-routine)',
        category: 'Ações Rápidas',
        shortcut: 'H',
        action: () => {
          router.push('/dashboard/routine?action=new-habit');
          close();
        },
      },
      {
        id: 'qa-weight',
        label: 'Registrar peso',
        icon: Scale,
        iconColor: 'var(--color-mod-health)',
        category: 'Ações Rápidas',
        action: () => {
          router.push('/dashboard/health?action=log-weight');
          close();
        },
      },
      {
        id: 'qa-workout',
        label: 'Registrar treino',
        icon: Dumbbell,
        iconColor: 'var(--color-mod-health)',
        category: 'Ações Rápidas',
        action: () => {
          router.push('/dashboard/health?action=new-workout');
          close();
        },
      },
      {
        id: 'qa-event',
        label: 'Novo evento',
        icon: Calendar,
        iconColor: 'var(--color-mod-calendar)',
        category: 'Ações Rápidas',
        action: () => {
          router.push('/dashboard/calendar?action=new');
          close();
        },
      },
    ];

    // Navigate — derived from MODULE_CONFIG (source of truth)
    const nav: PaletteCommand[] = MODULE_CONFIG.map((mod) => ({
      id: `nav-${mod.id}`,
      label: mod.label,
      icon: mod.icon,
      iconColor: mod.colorVar,
      category: 'Navegar',
      action: () => {
        router.push(mod.href);
        close();
      },
    }));

    // System pages
    const system: PaletteCommand[] = [
      {
        id: 'sys-chat',
        label: 'Chat com Hawk',
        icon: MessageSquare,
        iconColor: 'var(--color-accent)',
        category: 'Sistema',
        action: () => {
          router.push('/dashboard/chat');
          close();
        },
      },
      {
        id: 'sys-automations',
        label: 'Automações',
        icon: Zap,
        iconColor: 'var(--color-warning)',
        category: 'Sistema',
        action: () => {
          router.push('/dashboard/automations');
          close();
        },
      },
      {
        id: 'sys-routine',
        label: 'Mission Control',
        icon: Timer,
        iconColor: 'var(--color-text-muted)',
        category: 'Sistema',
        action: () => {
          router.push('/dashboard/mission-control');
          close();
        },
      },
      {
        id: 'sys-settings',
        label: 'Configurações',
        icon: Settings,
        iconColor: 'var(--color-text-muted)',
        category: 'Sistema',
        action: () => {
          router.push('/dashboard/settings');
          close();
        },
      },
    ];

    return [...actions, ...nav, ...system];
  }, [router, close]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
    );
  }, [allCommands, query]);

  const execute = useCallback(() => {
    filteredCommands[selectedIndex]?.action();
  }, [filteredCommands, selectedIndex]);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedIndex((i) => {
        const next = i + delta;
        if (next < 0) return filteredCommands.length - 1;
        if (next >= filteredCommands.length) return 0;
        return next;
      });
    },
    [filteredCommands.length],
  );

  // Reset selected index when query changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleSidebar();
      }
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '?' && !commandPaletteOpen && !isEditable) {
        e.preventDefault();
        openHelp();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, toggleSidebar, commandPaletteOpen, openHelp]);

  return {
    isOpen: commandPaletteOpen,
    showHelp,
    query,
    selectedIndex,
    filteredCommands,
    open,
    close,
    toggle,
    openHelp,
    closeHelp,
    setQuery,
    execute,
    moveSelection,
  };
}
