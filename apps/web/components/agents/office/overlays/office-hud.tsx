'use client';

import { Building2, Moon, Mountain, Palmtree } from 'lucide-react';
import { useState } from 'react';
import type { BackgroundTheme } from '../engine/types';
import { useOfficeStore } from '../store/office-store';
import { AgentDetailPanel } from './agent-detail-panel';
import { AgentTooltip } from './agent-tooltip';
import { HawkCommandPanel } from './hawk-command';
import { HiringWizard } from './hiring-wizard';
import { MuteToggle } from './mute-toggle';

const BG_OPTIONS: Array<{ id: BackgroundTheme; label: string; icon: typeof Palmtree }> = [
  { id: 'beach', label: 'Praia', icon: Palmtree },
  { id: 'city', label: 'Cidade', icon: Building2 },
  { id: 'mountain', label: 'Montanha', icon: Mountain },
  { id: 'night', label: 'Noturno', icon: Moon },
];

export function OfficeHUD() {
  const agents = useOfficeStore((s) => s.agents);
  const activeSessions = useOfficeStore((s) => s.activeSessions);
  const bgTheme = useOfficeStore((s) => s.backgroundTheme);
  const setBgTheme = useOfficeStore((s) => s.setBackgroundTheme);
  const [showBgPicker, setShowBgPicker] = useState(false);

  const totalAgents = agents.length;
  const activeCount = agents.filter((a) => activeSessions.has(a.id) || a.name === 'Hawk').length;

  return (
    <>
      {/* Top-left status bar */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div className="bg-[#1e1e2e] border-2 border-[#4a4a6a] px-3 py-1.5 font-mono text-xs shadow-[2px_2px_0px_#0a0a14]">
          <span className="text-[#ffd700] font-bold">HAWK OFFICE</span>
          <span className="text-[#666] mx-2">|</span>
          <span className="text-[#44cc88]">{activeCount}</span>
          <span className="text-[#888]">/{totalAgents} ativos</span>
        </div>
      </div>

      {/* Top-right: background picker + mute */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBgPicker(!showBgPicker)}
            className="w-8 h-8 flex items-center justify-center bg-[#1e1e2e] border-2 border-[#4a4a6a] text-[#aaa] hover:text-white transition-colors shadow-[2px_2px_0px_#0a0a14]"
            title="Mudar paisagem"
          >
            <Palmtree className="h-4 w-4" />
          </button>
          {showBgPicker && (
            <div className="absolute top-10 right-0 bg-[#1e1e2e] border-2 border-[#4a4a6a] shadow-[2px_2px_0px_#0a0a14] p-1">
              {BG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setBgTheme(opt.id);
                    setShowBgPicker(false);
                    // Trigger re-render of background
                    window.location.reload();
                  }}
                  className={`flex items-center gap-2 w-full px-2 py-1 text-[10px] font-mono transition-colors ${
                    bgTheme === opt.id
                      ? 'text-[#ffd700] bg-[#2a2a3e]'
                      : 'text-[#aaa] hover:text-white hover:bg-[#2a2a3e]'
                  }`}
                >
                  <opt.icon className="h-3 w-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <MuteToggle />
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-[#1e1e2e]/80 border border-[#4a4a6a]/50 px-3 py-1 font-mono text-[10px] text-[#666]">
          Clique no Hawk para comandar &middot; Clique no elevador para contratar
        </div>
      </div>

      <AgentTooltip />
      <AgentDetailPanel />
      <HawkCommandPanel />
      <HiringWizard />
    </>
  );
}
