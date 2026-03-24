'use client';

import { Pencil, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOfficeStore } from '../store/office-store';

const TIER_COLORS: Record<string, string> = {
  orchestrator: '#ffd700',
  specialist: '#44cc88',
  worker: '#888888',
};

const TIER_LABELS: Record<string, string> = {
  orchestrator: 'Orchestrador',
  specialist: 'Especialista',
  worker: 'Worker',
};

const MODULE_LABELS: Record<string, string> = {
  finances: 'Finanças',
  health: 'Saúde',
  people: 'Pessoas',
  career: 'Carreira',
  objectives: 'Metas',
  knowledge: 'Conhecimento',
  routine: 'Rotina',
  assets: 'Patrimônio',
  entertainment: 'Entretenimento',
  legal: 'Jurídico',
  social: 'Social',
  housing: 'Moradia',
  calendar: 'Agenda',
};

export function AgentDetailPanel() {
  const router = useRouter();
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const popupPosition = useOfficeStore((s) => s.selectedPopupPosition);
  const agents = useOfficeStore((s) => s.agents);
  const activeSessions = useOfficeStore((s) => s.activeSessions);
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  if (!selectedAgentId || !popupPosition) return null;

  const agent = agents.find((a) => a.id === selectedAgentId);
  if (!agent) return null;

  const tierColor = TIER_COLORS[agent.agent_tier ?? 'specialist'] ?? '#44cc88';
  const tierLabel = TIER_LABELS[agent.agent_tier ?? 'specialist'] ?? 'Especialista';
  const isActive = activeSessions.has(agent.id) || agent.name === 'Hawk';

  const handleEdit = () => {
    router.push(`/dashboard/agents/${agent.id}/edit`);
  };

  const handleDelete = async () => {
    if (agent.is_system) return;
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      if (res.ok) {
        selectAgent(null);
        window.location.reload();
      }
    } catch {
      // ignore
    }
  };

  // Clamp position to viewport
  const x = Math.min(Math.max(popupPosition.x - 125, 8), window.innerWidth - 260);
  const y = Math.max(popupPosition.y, 8);

  return (
    <>
      {/* Backdrop to close on click outside */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Game UI backdrop */}
      <div className="fixed inset-0 z-40" onClick={() => selectAgent(null)} />

      {/* Popup */}
      <div className="fixed z-50 font-mono" style={{ left: x, top: y, maxWidth: 250 }}>
        <div
          className="bg-[#1e1e2e] border-2 border-[#4a4a6a] p-3"
          style={{ boxShadow: '3px 3px 0 #0a0a14' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-bold">{agent.name}</span>
              <span
                className="text-[9px] px-1.5 py-0.5"
                style={{ color: tierColor, backgroundColor: `${tierColor}22` }}
              >
                {tierLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={() => selectAgent(null)}
              className="text-[#666] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isActive ? '#44cc88' : '#666' }}
            />
            <span className="text-[#aaa] text-[10px]">
              {isActive ? 'Trabalhando' : 'Descansando'}
            </span>
          </div>

          {/* Model */}
          {agent.llm_model && (
            <div className="text-[9px] text-[#777] mb-2 truncate">
              {agent.llm_model.split('/').pop()?.replace(':free', '')}
            </div>
          )}

          {/* Modules */}
          {agent.enabled_tools && agent.enabled_tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {agent.enabled_tools.slice(0, 6).map((mod) => (
                <span key={mod} className="text-[8px] text-[#999] bg-[#2a2a3e] px-1 py-0.5">
                  {MODULE_LABELS[mod] ?? mod}
                </span>
              ))}
              {agent.enabled_tools.length > 6 && (
                <span className="text-[8px] text-[#666]">+{agent.enabled_tools.length - 6}</span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleEdit}
              className="flex-1 flex items-center justify-center gap-1 py-1 bg-[#2a2a3e] text-[#aaa] hover:text-white hover:bg-[#3a3a4e] text-[10px] transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            {!agent.is_system && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center justify-center gap-1 px-2 py-1 bg-[#2a2a3e] text-[#cc4444] hover:bg-[#3a2a2e] text-[10px] transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
