'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSidebarBadges } from '@/lib/hooks/use-sidebar-badges';
import { MODULE_CONFIG } from '@/lib/modules';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import {
  Brain,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plug,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const badges = useSidebarBadges();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]',
        'transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]',
        sidebarCollapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]',
      )}
    >
      {/* Header */}
      <div className="flex h-[var(--topbar-height)] items-center justify-between px-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
            Hawk OS
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-[var(--space-3)]">
        <nav className="flex flex-col gap-[var(--space-0-5)] px-[var(--space-2)]">
          {/* Core Section */}
          <SidebarLink
            href="/dashboard"
            label="Dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            colorVar="var(--color-accent)"
            isActive={pathname === '/dashboard'}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/chat"
            label="Chat"
            icon={<MessageSquare className="h-4 w-4" />}
            colorVar="var(--color-accent)"
            isActive={pathname === '/dashboard/chat'}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/agents"
            label="Agents"
            icon={<Users className="h-4 w-4" />}
            colorVar="var(--color-accent)"
            isActive={pathname === '/dashboard/agents' || pathname.startsWith('/dashboard/agents/')}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/automations"
            label="Automações"
            icon={<Zap className="h-4 w-4" />}
            colorVar="var(--color-accent)"
            isActive={pathname === '/dashboard/automations'}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/memory"
            label="Memória"
            icon={<Brain className="h-4 w-4" />}
            colorVar="var(--color-mod-knowledge)"
            isActive={pathname === '/dashboard/memory'}
            collapsed={sidebarCollapsed}
          />

          {/* Life Modules Section */}
          <div className="my-[var(--space-2)] h-px bg-[var(--color-border-subtle)] mx-[var(--space-2)]" />
          {MODULE_CONFIG.map((mod) => (
            <SidebarLink
              key={mod.id}
              href={mod.href}
              label={mod.label}
              icon={<mod.icon className="h-4 w-4" />}
              colorVar={mod.colorVar}
              isActive={pathname === mod.href}
              collapsed={sidebarCollapsed}
              badge={badges[mod.id]}
            />
          ))}

          {/* System Section */}
          <div className="my-[var(--space-2)] h-px bg-[var(--color-border-subtle)] mx-[var(--space-2)]" />
          <SidebarLink
            href="/dashboard/extensions"
            label="Extensões"
            icon={<Plug className="h-4 w-4" />}
            colorVar="var(--color-text-muted)"
            isActive={pathname === '/dashboard/extensions'}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/wiki"
            label="Wiki"
            icon={<HelpCircle className="h-4 w-4" />}
            colorVar="var(--color-text-muted)"
            isActive={pathname === '/dashboard/wiki' || pathname.startsWith('/dashboard/wiki/')}
            collapsed={sidebarCollapsed}
          />
          <SidebarLink
            href="/dashboard/settings"
            label="Configurações"
            icon={<Settings className="h-4 w-4" />}
            colorVar="var(--color-text-muted)"
            isActive={pathname === '/dashboard/settings' || pathname === '/dashboard/system'}
            collapsed={sidebarCollapsed}
          />
        </nav>
      </ScrollArea>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  colorVar,
  isActive,
  collapsed,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  colorVar: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] min-h-[36px]',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]',
        collapsed && 'justify-center px-0',
        isActive
          ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]',
      )}
    >
      <span
        className="relative flex-shrink-0 transition-colors duration-[var(--duration-fast)]"
        style={{ color: isActive ? colorVar : undefined }}
      >
        {icon}
        {badge != null && badge > 0 && collapsed && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold leading-none px-[3px]">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="truncate text-[13px] font-medium flex-1">{label}</span>
          {badge != null && badge > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-[10px] font-semibold leading-none px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}
