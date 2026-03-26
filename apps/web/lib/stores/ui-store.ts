'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UIState = {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  sectionOrders: Record<string, string[]>;
  collapsedSections: Record<string, string[]>;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
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
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      sectionOrders: {},
      collapsedSections: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
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
    { name: 'hawk-ui', skipHydration: true },
  ),
);
