'use client';

import { AnimatedWidget } from '@/components/motion/animated-widget';
import { useContainerWidth } from '@/hooks/useContainerWidth';
import { useLayoutStore } from '@/lib/stores/layout-store';
import { WIDGET_REGISTRY } from '@/lib/widgets/registry';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Layout, Responsive } from 'react-grid-layout';
import { WidgetPicker } from './widget-picker';
import { WidgetWrapper } from './widget-wrapper';

export function DashboardGrid() {
  const widgets = useLayoutStore((s) => s.widgets);
  const updateLayout = useLayoutStore((s) => s.updateLayout);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { containerRef, width } = useContainerWidth({ initialWidth: 1200 });

  useEffect(() => setMounted(true), []);

  const layouts = useMemo(
    () => ({
      lg: widgets.map((w) => {
        const def = WIDGET_REGISTRY[w.widgetId];
        return {
          i: w.i,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          minW: def?.minSize.w ?? 2,
          minH: def?.minSize.h ?? 2,
          maxW: def?.maxSize.w ?? 12,
          maxH: def?.maxSize.h ?? 10,
        };
      }),
    }),
    [widgets],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      const updated = layout.map((item) => {
        const existing = widgets.find((w) => w.i === item.i);
        return {
          i: item.i,
          widgetId: existing?.widgetId ?? item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        };
      });
      updateLayout(updated);
    },
    [widgets, updateLayout],
  );

  if (!mounted) {
    return (
      <div ref={containerRef} className="grid grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="h-48 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)]"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef}>
        {width > 0 && (
          <Responsive
            className="layout"
            width={width}
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 900, sm: 600 }}
            cols={{ lg: 12, md: 8, sm: 4 }}
            rowHeight={72}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            dragConfig={{ handle: '.drag-handle' }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map((w, i) => (
              <div key={w.i} className="drag-handle cursor-grab active:cursor-grabbing">
                <AnimatedWidget index={i}>
                  <WidgetWrapper instanceId={w.i} widgetId={w.widgetId} />
                </AnimatedWidget>
              </div>
            ))}
          </Responsive>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-[var(--space-4)] flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] py-[var(--space-4)] text-sm text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-[var(--duration-fast)] cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Adicionar widget
      </button>

      {pickerOpen && <WidgetPicker onClose={() => setPickerOpen(false)} />}
    </>
  );
}
