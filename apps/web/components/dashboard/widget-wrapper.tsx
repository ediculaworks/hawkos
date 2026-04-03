'use client';

import SpotlightCard from '@/components/react-bits/components/spotlight-card';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetErrorBoundary } from '@/components/ui/widget-error';
import { getModuleConfig } from '@/lib/modules';
import { useLayoutStore } from '@/lib/stores/layout-store';
import { getWidgetDef } from '@/lib/widgets/registry';
import { MoreHorizontal, RefreshCw, X } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';

type WidgetWrapperProps = {
  instanceId: string;
  widgetId: string;
};

export function WidgetWrapper({ instanceId, widgetId }: WidgetWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const removeWidget = useLayoutStore((s) => s.removeWidget);

  const def = getWidgetDef(widgetId);
  const mod = def ? getModuleConfig(def.moduleId) : undefined;

  const LazyComponent = useMemo(() => {
    if (!def) return null;
    return lazy(async () => def.component());
  }, [def]);

  if (!def || !LazyComponent) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-xs">
        Widget não encontrado
      </div>
    );
  }

  return (
    <SpotlightCard
      className="h-full flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)]"
      spotlightColor={mod?.colorVar ?? 'var(--color-accent)'}
      spotlightOpacity={0.06}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-2)] border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-[var(--space-2)] min-w-0">
          {mod && (
            <def.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: mod.colorVar }} />
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
            {def.title}
          </span>
        </div>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors duration-[var(--duration-fast)]"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                onKeyDown={() => {}}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[var(--shadow-lg)] py-1">
                <button
                  type="button"
                  onClick={() => {
                    setRefreshKey((k) => k + 1);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeWidget(instanceId);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-surface-3)] transition-colors"
                >
                  <X className="h-3 w-3" /> Remover
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-[var(--space-4)]">
        <WidgetErrorBoundary title={def.title}>
          <Suspense fallback={<WidgetSkeleton />}>
            <LazyComponent key={refreshKey} />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
    </SpotlightCard>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}
