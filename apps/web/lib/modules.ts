import type { ModuleId } from '@hawk/shared';
import {
  Activity,
  Brain,
  Briefcase,
  Calendar,
  Gamepad2,
  Gem,
  Heart,
  Home,
  ListChecks,
  type LucideIcon,
  Scale,
  Target,
  Users,
  Wallet,
} from 'lucide-react';

export type ModuleConfig = {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  colorVar: string;
  href: string;
};

export const MODULE_CONFIG: ModuleConfig[] = [
  {
    id: 'finances',
    label: 'Finanças',
    icon: Wallet,
    colorVar: 'var(--color-mod-finances)',
    href: '/dashboard/finances',
  },
  {
    id: 'calendar',
    label: 'Agenda',
    icon: Calendar,
    colorVar: 'var(--color-mod-calendar)',
    href: '/dashboard/calendar',
  },
  {
    id: 'routine',
    label: 'Rotina',
    icon: ListChecks,
    colorVar: 'var(--color-mod-routine)',
    href: '/dashboard/routine',
  },
  {
    id: 'health',
    label: 'Saúde',
    icon: Heart,
    colorVar: 'var(--color-mod-health)',
    href: '/dashboard/health',
  },
  {
    id: 'objectives',
    label: 'Objetivos',
    icon: Target,
    colorVar: 'var(--color-mod-objectives)',
    href: '/dashboard/objectives',
  },
  {
    id: 'career',
    label: 'Carreira',
    icon: Briefcase,
    colorVar: 'var(--color-mod-career)',
    href: '/dashboard/career',
  },
  {
    id: 'assets',
    label: 'Patrimônio',
    icon: Gem,
    colorVar: 'var(--color-mod-assets)',
    href: '/dashboard/assets',
  },
  {
    id: 'legal',
    label: 'Jurídico',
    icon: Scale,
    colorVar: 'var(--color-mod-legal)',
    href: '/dashboard/legal',
  },
  {
    id: 'housing',
    label: 'Moradia',
    icon: Home,
    colorVar: 'var(--color-mod-housing)',
    href: '/dashboard/housing',
  },
  {
    id: 'entertainment',
    label: 'Lazer',
    icon: Gamepad2,
    colorVar: 'var(--color-mod-entertainment)',
    href: '/dashboard/entertainment',
  },
  {
    id: 'people',
    label: 'Pessoas',
    icon: Users,
    colorVar: 'var(--color-mod-people)',
    href: '/dashboard/people',
  },
];

// System modules (not part of the 16 life modules)
export const SYSTEM_MODULE_CONFIG: Array<{
  id: string;
  label: string;
  icon: typeof Wallet;
  colorVar: string;
}> = [
  { id: 'memory', label: 'Memória', icon: Brain, colorVar: 'var(--color-accent)' },
  { id: 'life-score', label: 'Life Score', icon: Activity, colorVar: 'var(--color-success)' },
];

export function getModuleConfig(
  id: string,
): ModuleConfig | (typeof SYSTEM_MODULE_CONFIG)[number] | undefined {
  return MODULE_CONFIG.find((m) => m.id === id) ?? SYSTEM_MODULE_CONFIG.find((m) => m.id === id);
}
