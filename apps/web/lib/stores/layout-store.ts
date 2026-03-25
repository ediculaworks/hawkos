'use client';

import { WIDGET_REGISTRY } from '@/lib/widgets/registry';
import type { WidgetLayoutItem } from '@/lib/widgets/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { i: 'finances-summary', widgetId: 'finances-summary', x: 0, y: 0, w: 4, h: 4 },
  { i: 'routine-habits', widgetId: 'routine-habits', x: 4, y: 0, w: 4, h: 5 },
  { i: 'objectives-goals', widgetId: 'objectives-goals', x: 8, y: 0, w: 4, h: 4 },
  { i: 'finances-transactions', widgetId: 'finances-transactions', x: 0, y: 4, w: 4, h: 4 },
  { i: 'objectives-tasks', widgetId: 'objectives-tasks', x: 8, y: 4, w: 4, h: 4 },
];

type LayoutState = {
  widgets: WidgetLayoutItem[];
  updateLayout: (items: WidgetLayoutItem[]) => void;
  addWidget: (widgetId: string) => void;
  removeWidget: (instanceId: string) => void;
  resetLayout: () => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_LAYOUT,

      updateLayout: (items) => set({ widgets: items }),

      addWidget: (widgetId) => {
        const { widgets } = get();
        const existing = widgets.filter((w) => w.widgetId === widgetId);
        const instanceId = existing.length > 0 ? `${widgetId}-${existing.length}` : widgetId;
        const maxY = widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
        const def = WIDGET_REGISTRY[widgetId];
        if (!def) return;

        set({
          widgets: [
            ...widgets,
            {
              i: instanceId,
              widgetId,
              x: 0,
              y: maxY,
              w: def.defaultSize.w,
              h: def.defaultSize.h,
            },
          ],
        });
      },

      removeWidget: (instanceId) => {
        set({ widgets: get().widgets.filter((w) => w.i !== instanceId) });
      },

      resetLayout: () => set({ widgets: DEFAULT_LAYOUT }),
    }),
    {
      name: 'hawk-layout',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.widgets = state.widgets.filter((w) => !!WIDGET_REGISTRY[w.widgetId]);
        }
      },
    },
  ),
);
