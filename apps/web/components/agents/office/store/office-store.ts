import { create } from 'zustand';
import type { AgentData, BackgroundTheme, Character, PoringEntity } from '../engine/types';

interface OfficeState {
  agents: AgentData[];
  activeSessions: Set<string>;
  characters: Character[];
  porings: PoringEntity[];
  backgroundTheme: BackgroundTheme;

  // UI state
  hoveredAgentId: string | null;
  hoveredPosition: { x: number; y: number } | null;
  selectedAgentId: string | null;
  selectedPopupPosition: { x: number; y: number } | null;
  hiringWizardOpen: boolean;
  hawkCommandOpen: boolean;
  soundMuted: boolean;
  loading: boolean;
  assetsLoaded: boolean;
  activatedAgentIds: string[];

  // Actions
  setAgents: (agents: AgentData[]) => void;
  setActiveSessions: (ids: Set<string>) => void;
  setCharacters: (chars: Character[]) => void;
  setPorings: (porings: PoringEntity[]) => void;
  hoverAgent: (id: string | null, pos?: { x: number; y: number }) => void;
  selectAgent: (id: string | null, popupPos?: { x: number; y: number }) => void;
  openHiringWizard: () => void;
  closeHiringWizard: () => void;
  openHawkCommand: () => void;
  closeHawkCommand: () => void;
  toggleMute: () => void;
  setLoading: (loading: boolean) => void;
  setAssetsLoaded: (loaded: boolean) => void;
  setActivatedAgentIds: (ids: string[]) => void;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  agents: [],
  activeSessions: new Set(),
  characters: [],
  porings: [],
  hoveredAgentId: null,
  hoveredPosition: null,
  selectedAgentId: null,
  selectedPopupPosition: null,
  hiringWizardOpen: false,
  hawkCommandOpen: false,
  soundMuted: false,
  loading: true,
  assetsLoaded: false,
  activatedAgentIds: [],
  backgroundTheme: 'beach' as BackgroundTheme,

  setAgents: (agents) => set({ agents }),
  setActiveSessions: (ids) => set({ activeSessions: ids }),
  setCharacters: (chars) => set({ characters: chars }),
  setPorings: (porings) => set({ porings }),
  hoverAgent: (id, pos) => set({ hoveredAgentId: id, hoveredPosition: pos ?? null }),
  selectAgent: (id, popupPos) =>
    set({ selectedAgentId: id, selectedPopupPosition: popupPos ?? null }),
  openHiringWizard: () => set({ hiringWizardOpen: true }),
  closeHiringWizard: () => set({ hiringWizardOpen: false }),
  openHawkCommand: () =>
    set({
      hawkCommandOpen: true,
      selectedAgentId: null,
      hoveredAgentId: null,
      selectedPopupPosition: null,
    }),
  closeHawkCommand: () => set({ hawkCommandOpen: false }),
  toggleMute: () => set((s) => ({ soundMuted: !s.soundMuted })),
  setLoading: (loading) => set({ loading }),
  setAssetsLoaded: (loaded) => set({ assetsLoaded: loaded }),
  setActivatedAgentIds: (ids) => set({ activatedAgentIds: ids }),
  setBackgroundTheme: (theme) => set({ backgroundTheme: theme }),
}));
