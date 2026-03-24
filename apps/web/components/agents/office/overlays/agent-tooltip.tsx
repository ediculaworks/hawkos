'use client';

import { useOfficeStore } from '../store/office-store';

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  orchestrator: { label: 'Orchestrador', color: '#ffd700' },
  specialist: { label: 'Especialista', color: '#44cc88' },
  worker: { label: 'Worker', color: '#888888' },
};

export function AgentTooltip() {
  const hoveredAgentId = useOfficeStore((s) => s.hoveredAgentId);
  const hoveredPosition = useOfficeStore((s) => s.hoveredPosition);
  const agents = useOfficeStore((s) => s.agents);
  const activeSessions = useOfficeStore((s) => s.activeSessions);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const hawkCommandOpen = useOfficeStore((s) => s.hawkCommandOpen);

  if (!hoveredAgentId || !hoveredPosition || hoveredAgentId === selectedAgentId || hawkCommandOpen)
    return null;

  const agent = agents.find((a) => a.id === hoveredAgentId);
  if (!agent) return null;

  const tier = TIER_LABELS[agent.agent_tier ?? 'specialist'] ?? TIER_LABELS.specialist!;
  const isActive = activeSessions.has(agent.id) || agent.name === 'Hawk';
  const status = isActive ? 'Trabalhando' : 'Descansando';

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: hoveredPosition.x + 16,
        top: hoveredPosition.y - 8,
      }}
    >
      <div className="bg-[#1e1e2e] border-2 border-[#4a4a6a] px-3 py-2 font-mono text-xs shadow-[2px_2px_0px_#0a0a14]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-bold">{agent.name}</span>
          <span
            className="text-[10px] px-1.5 py-0.5"
            style={{ color: tier.color, backgroundColor: `${tier.color}22` }}
          >
            {tier.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isActive ? '#44cc88' : '#888888' }}
          />
          <span className="text-[#aaaaaa]">{status}</span>
        </div>
        {agent.tagline && <div className="text-[#777777] mt-1 text-[10px]">{agent.tagline}</div>}
      </div>
    </div>
  );
}
