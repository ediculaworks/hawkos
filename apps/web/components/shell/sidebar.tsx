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
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarMobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const setSidebarMobileOpen = useUIStore((s) => s.setSidebarMobileOpen);
  const badges = useSidebarBadges();

  // Close mobile sidebar on navigation
  const handleNavClick = () => {
    setSidebarMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarMobileOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setSidebarMobileOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Fechar sidebar"
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]',
          'transition-[width,transform] duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]',
          // Desktop: collapse/expand by width
          'md:translate-x-0',
          sidebarCollapsed ? 'md:w-[var(--sidebar-collapsed)]' : 'md:w-[var(--sidebar-width)]',
          // Mobile: always full width sidebar, slide in/out
          'w-[var(--sidebar-width)]',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex h-[var(--topbar-height)] items-center justify-between px-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
              Hawk OS
            </span>
          )}
          {/* Desktop only: sidebar collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            aria-label={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
            className="hidden md:flex"
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
          <nav
            aria-label="Navegação principal"
            className="flex flex-col gap-[var(--space-0-5)] px-[var(--space-2)]"
          >
            {/* Core Section */}
            <SidebarLink
              href="/dashboard"
              label="Dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
              colorVar="var(--color-accent)"
              isActive={pathname === '/dashboard'}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/chat"
              label="Chat"
              icon={<MessageSquare className="h-4 w-4" />}
              colorVar="var(--color-accent)"
              isActive={pathname === '/dashboard/chat'}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/agents"
              label="Agents"
              icon={<Users className="h-4 w-4" />}
              colorVar="var(--color-accent)"
              isActive={
                pathname === '/dashboard/agents' || pathname.startsWith('/dashboard/agents/')
              }
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/automations"
              label="Automações"
              icon={<Zap className="h-4 w-4" />}
              colorVar="var(--color-accent)"
              isActive={pathname === '/dashboard/automations'}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/memory"
              label="Memória"
              icon={<Brain className="h-4 w-4" />}
              colorVar="var(--color-mod-knowledge)"
              isActive={pathname === '/dashboard/memory'}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
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
                onNavigate={handleNavClick}
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
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/wiki"
              label="Wiki"
              icon={<HelpCircle className="h-4 w-4" />}
              colorVar="var(--color-text-muted)"
              isActive={pathname === '/dashboard/wiki' || pathname.startsWith('/dashboard/wiki/')}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
            <SidebarLink
              href="/dashboard/settings"
              label="Configurações"
              icon={<Settings className="h-4 w-4" />}
              colorVar="var(--color-text-muted)"
              isActive={pathname === '/dashboard/settings' || pathname === '/dashboard/system'}
              collapsed={sidebarCollapsed}
              onNavigate={handleNavClick}
            />
          </nav>
        </ScrollArea>
      </aside>
    </>
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
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  colorVar: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
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
