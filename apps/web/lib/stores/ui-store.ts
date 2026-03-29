'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

type UIState = {
  theme: Theme;
  timezone: string;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  commandPaletteOpen: boolean;
  sectionOrders: Record<string, string[]>;
  collapsedSections: Record<string, string[]>;
  setTheme: (theme: Theme) => void;
  setTimezone: (timezone: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  toggleSidebarMobile: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  getSectionOrder: (moduleId: string) => string[];
  setSectionOrder: (moduleId: string, order: string[]) => void;
  isSectionCollapsed: (moduleId: string, sectionId: string) => boolean;
  toggleSectionCollapse: (moduleId: string, sectionId: string) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark' as Theme,
      timezone: 'America/Sao_Paulo',
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      commandPaletteOpen: false,
      sectionOrders: {},
      collapsedSections: {},
      setTheme: (theme) => {
        set({ theme });
        // Apply to document immediately for CSS variable switching
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.colorScheme = theme;
        }
      },
      setTimezone: (timezone) => {
        set({ timezone });
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.timezone = timezone;
        }
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      toggleSidebarMobile: () => set((s) => ({ sidebarMobileOpen: !s.sidebarMobileOpen })),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      getSectionOrder: (moduleId) => get().sectionOrders[moduleId] ?? [],
      setSectionOrder: (moduleId, order) =>
        set((s) => ({
          sectionOrders: { ...s.sectionOrders, [moduleId]: order },
        })),
      isSectionCollapsed: (moduleId, sectionId) =>
        (get().collapsedSections[moduleId] ?? []).includes(sectionId),
      toggleSectionCollapse: (moduleId, sectionId) =>
        set((s) => {
          const current = s.collapsedSections[moduleId] ?? [];
          const next = current.includes(sectionId)
            ? current.filter((id) => id !== sectionId)
            : [...current, sectionId];
          return { collapsedSections: { ...s.collapsedSections, [moduleId]: next } };
        }),
    }),
    {
      name: 'hawk-ui',
      version: 2,
      skipHydration: true,
      migrate: (persisted) => persisted as UIState,
    },
  ),
);
