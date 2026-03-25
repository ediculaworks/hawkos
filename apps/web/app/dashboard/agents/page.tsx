'use client';

import { AgentFormModal } from '@/components/agents/agent-form-modal';
import { DelegateModal } from '@/components/agents/delegate-modal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Agent } from '@/lib/agent-chat';
import { Bot, ChevronDown, ChevronRight, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const AGENT_EMOJIS: Record<string, string> = {
  '🦅': '🦅', '🦉': '🦉', '🐺': '🐺', '🦚': '🦚',
  '🐝': '🐝', '🦫': '🦫', '🐂': '🐂', '🦊': '🦊',
  '🐻': '🐻', '🦁': '🦁', '🐯': '🐯', '🦈': '🦈',
  '🐬': '🐬', '🦜': '🦜', '🐸': '🐸', '🦎': '🦎',
};

function getAgentEmoji(agent: { avatar?: string; name: string }): string {
  if (agent.avatar && AGENT_EMOJIS[agent.avatar]) return agent.avatar;
  const nameMap: Record<string, string> = {
    Hawk: '🦅', Owl: '🦉', Wolf: '🐺', Peacock: '🦚',
    Bee: '🐝', Beaver: '🦫', Bull: '🐂', Fox: '🦊',
  };
  return nameMap[agent.name] || agent.name.slice(0, 2).toUpperCase();
}

function getTierBadgeClass(tier: string): string {
  if (tier === 'orchestrator') return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
  if (tier === 'specialist') return 'bg-transparent text-[var(--color-text-muted)] border border-[var(--color-border)]';
  return 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]';
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    orchestrator: 'Orquestrador',
    specialist: 'Especialista',
    worker: 'Worker',
  };
  return labels[tier] ?? tier;
}

function truncateModel(model: string | null): string {
  if (!model) return '—';
  const parts = model.split('/');
  const name = parts[parts.length - 1] ?? model;
  return name.length > 24 ? `${name.slice(0, 24)}…` : name;
}

// ─── Agent row ───────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  onEdit,
  onDelegate,
  onDelete,
}: {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelegate: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-2)] transition-colors group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-subtle)] flex items-center justify-center text-[22px] leading-none">
        {getAgentEmoji(agent)}
      </div>

      {/* Name + tagline */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{agent.name}</p>
        {agent.tagline && (
          <p className="text-xs text-[var(--color-text-muted)] truncate">{agent.tagline}</p>
        )}
      </div>

      {/* Tier badge */}
      <div className="hidden sm:block flex-shrink-0">
        <span className={`inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium ${getTierBadgeClass(agent.agent_tier)}`}>
          {getTierLabel(agent.agent_tier)}
        </span>
      </div>

      {/* Model */}
      <div className="hidden md:block flex-shrink-0 w-40">
        <p className="text-xs font-mono text-[var(--color-text-muted)] truncate" title={agent.llm_model ?? undefined}>
          {truncateModel(agent.llm_model)}
        </p>
      </div>

      {/* Tools count */}
      <div className="hidden lg:block flex-shrink-0 w-20 text-right">
        <span className="text-xs text-[var(--color-text-muted)]">
          {agent.enabled_tools?.length ?? 0} módulos
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          type="button"
          title="Editar agente"
          onClick={() => onEdit(agent)}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Delegar tarefa"
          onClick={() => onDelegate(agent)}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Deletar agente"
          onClick={() => onDelete(agent)}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateAgent, setDelegateAgent] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // UI state
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [page, setPage] = useState(1);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Erro ao carregar agentes');
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormOpen(true);
  };

  const handleNewAgent = () => {
    setEditingAgent(null);
    setFormOpen(true);
  };

  const handleDelegate = (agent: Agent) => {
    setDelegateAgent(agent);
    setDelegateOpen(true);
  };

  const handleDeleteRequest = (agent: Agent) => {
    setDeleteTarget(agent);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar agente');
      setDeleteTarget(null);
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar');
    } finally {
      setDeleting(false);
    }
  };

  const userFacing = agents.filter((a) => a.is_user_facing !== false);
  const internal = agents.filter((a) => a.is_user_facing === false);

  const totalPages = Math.ceil(userFacing.length / PAGE_SIZE);
  const pagedAgents = userFacing.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Agentes</h1>
          {!loading && (
            <span className="inline-flex items-center rounded-[var(--radius-full)] px-2.5 py-0.5 text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">
              {userFacing.length}
            </span>
          )}
        </div>
        <Button size="sm" onClick={handleNewAgent} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Novo agente
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* User-facing agents */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <div className="w-9 flex-shrink-0" />
          <div className="flex-1 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Agente
          </div>
          <div className="hidden sm:block flex-shrink-0 w-28 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Tier
          </div>
          <div className="hidden md:block flex-shrink-0 w-40 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Modelo
          </div>
          <div className="hidden lg:block flex-shrink-0 w-20 text-right text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Módulos
          </div>
          <div className="flex-shrink-0 w-24" />
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {Array.from({ length: 4 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-surface-3)] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-[var(--color-surface-3)] rounded animate-pulse" />
                  <div className="h-3 w-48 bg-[var(--color-surface-3)] rounded animate-pulse" />
                </div>
                <div className="hidden sm:block h-5 w-20 bg-[var(--color-surface-3)] rounded-full animate-pulse" />
                <div className="hidden md:block h-3.5 w-36 bg-[var(--color-surface-3)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : pagedAgents.length === 0 ? (
          <div className="py-16 text-center">
            <Bot className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Nenhum agente configurado
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Crie o seu primeiro agente para começar
            </p>
            <Button size="sm" onClick={handleNewAgent} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Novo agente
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {pagedAgents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                onEdit={handleEdit}
                onDelegate={handleDelegate}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <span className="text-xs text-[var(--color-text-muted)]">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, userFacing.length)} de {userFacing.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Internal agents */}
      {internal.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
          <button
            type="button"
            onClick={() => setInternalExpanded((p) => !p)}
            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            {internalExpanded ? (
              <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
            )}
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              Agentes internos
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
              {internal.length}
            </span>
          </button>

          {internalExpanded && (
            <div className="divide-y divide-[var(--color-border-subtle)] border-t border-[var(--color-border)]">
              {internal.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  onEdit={handleEdit}
                  onDelegate={handleDelegate}
                  onDelete={handleDeleteRequest}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AgentFormModal
        open={formOpen}
        agent={editingAgent}
        onClose={() => {
          setFormOpen(false);
          setEditingAgent(null);
        }}
        onSaved={loadAgents}
      />

      <DelegateModal
        open={delegateOpen}
        agent={delegateAgent}
        onClose={() => {
          setDelegateOpen(false);
          setDelegateAgent(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        title={`Deletar ${deleteTarget?.name ?? 'agente'}`}
        description="Esta ação é irreversível. Todas as sessões associadas a este agente serão preservadas, mas o agente será removido."
        confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
        variant="danger"
      />
    </div>
  );
}
