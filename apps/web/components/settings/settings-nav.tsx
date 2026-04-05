'use client';

import { cn } from '@/lib/utils/cn';
import { Bell, Bot, Database, type LucideIcon, Palette, Plug, Settings, User } from 'lucide-react';

export type SettingsSection =
  | 'general'
  | 'profile'
  | 'agent'
  | 'appearance'
  | 'notifications'
  | 'data'
  | 'integrations';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'Geral', icon: Settings },
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'integrations', label: 'Integrações', icon: Plug },
  { id: 'agent', label: 'Agente', icon: Bot },
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'data', label: 'Dados', icon: Database },
];

interface SettingsNavProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden md:flex flex-col w-[200px] shrink-0 gap-[var(--space-0-5)]">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex items-center gap-[var(--space-2-5)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] text-sm transition-colors text-left cursor-pointer',
              active === item.id
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mobile: horizontal scroll */}
      <div className="flex md:hidden gap-[var(--space-1)] overflow-x-auto pb-[var(--space-2)] border-b border-[var(--color-border)]">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex items-center gap-[var(--space-1-5)] px-[var(--space-3)] py-[var(--space-2)] rounded-[var(--radius-md)] text-xs whitespace-nowrap transition-colors cursor-pointer',
              active === item.id
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-1)]',
            )}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
