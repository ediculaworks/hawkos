'use client';

import { AgentSprite } from '@/components/agents/agent-sprite';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Agent, ChatSession } from '@/lib/agent-chat';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface ChatSidebarProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  sessions: ChatSession[];
  activeSession: string | null;
  connected: boolean;
  loading?: boolean;
  onSelectAgent: (agent: Agent) => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  }
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

function getSessionGroup(dateStr?: string): string {
  if (!dateStr) return 'Mais antigo';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return 'Esta semana';
  return 'Mais antigo';
}

export function ChatSidebar({
  agents,
  selectedAgent,
  sessions,
  activeSession,
  connected,
  loading,
  onSelectAgent,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: ChatSidebarProps) {
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);

  // Group sessions by date
  const grouped = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const group = getSessionGroup(session.lastActivity);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)?.push(session);
  }

  const userFacingAgents = agents.filter((a) => a.is_user_facing !== false);

  return (
    <div className="w-[264px] flex-shrink-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Agent selector */}
      <div className="p-3 border-b border-[var(--color-border-subtle)]">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer"
          >
            {selectedAgent?.sprite_folder ? (
              <AgentSprite folder={selectedAgent.sprite_folder} size={24} speed={600} />
            ) : (
              <span className="text-base">
                {selectedAgent?.avatar === 'hawk' ? '\u{1F985}' : '\u{1F916}'}
              </span>
            )}
            <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] text-left truncate">
              {selectedAgent?.name ?? 'Selecionar agente'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {agentDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setAgentDropdownOpen(false)}
                onKeyDown={() => {}}
              />
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[var(--shadow-lg)] py-1 max-h-60 overflow-y-auto">
                {userFacingAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      onSelectAgent(agent);
                      setAgentDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer ${
                      selectedAgent?.id === agent.id ? 'bg-[var(--color-accent)]/10' : ''
                    }`}
                  >
                    {agent.sprite_folder ? (
                      <AgentSprite
                        folder={agent.sprite_folder}
                        size={20}
                        speed={selectedAgent?.id === agent.id ? 500 : 0}
                      />
                    ) : (
                      <span className="text-sm">
                        {agent.avatar === 'hawk' ? '\u{1F985}' : '\u{1F916}'}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--color-text-primary)] block truncate">
                        {agent.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Sessões
        </span>
        <button
          type="button"
          onClick={onNewSession}
          className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          title="Nova sessão"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="space-y-2 px-1">
            {Array.from({ length: 4 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-[var(--color-text-muted)]">Nenhuma sessão</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([group, groupSessions]) => (
            <div key={group} className="mb-2">
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-2 block mb-1">
                {group}
              </span>
              {groupSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={activeSession === session.id}
                  onSelect={() => onSelectSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                  onRename={(title) => onRenameSession(session.id, title)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Connection status */}
      <div className="px-3 py-2 border-t border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div
              className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
            />
            {connected && (
              <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-ping opacity-40" />
            )}
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {connected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const startEdit = () => {
    setEditValue(session.title ?? '');
    setEditing(true);
  };

  const saveEdit = () => {
    if (editValue.trim()) {
      onRename(editValue.trim());
    }
    setEditing(false);
  };

  const title = session.title || session.lastMessage?.slice(0, 40) || 'Nova sessão';

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-md)] cursor-pointer transition-colors ${
        isActive
          ? 'bg-[var(--color-accent)]/10 border-l-2 border-[var(--color-accent)]'
          : 'hover:bg-[var(--color-surface-2)] border-l-2 border-transparent'
      }`}
    >
      {/* Mini sprite */}
      {session.agentSpriteFolder ? (
        <AgentSprite
          folder={session.agentSpriteFolder}
          size={20}
          speed={isActive ? 500 : 0}
          className="flex-shrink-0"
        />
      ) : (
        <div className="w-5 h-5 flex-shrink-0" />
      )}

      {editing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="flex-1 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] focus:outline-none"
          />
          <button type="button" onClick={saveEdit} className="cursor-pointer">
            <Check className="h-3 w-3 text-[var(--color-success)]" />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="cursor-pointer">
            <X className="h-3 w-3 text-[var(--color-text-muted)]" />
          </button>
        </div>
      ) : (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: session selection via click */}
          <div className="flex-1 min-w-0" onClick={onSelect}>
            <span className="text-xs text-[var(--color-text-primary)] block truncate">{title}</span>
            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              {formatRelativeDate(session.lastActivity)}
              {session.channel === 'discord' && (
                <span className="inline-flex items-center px-1 rounded bg-[#5865F2]/15 text-[#5865F2] text-[8px] font-semibold leading-tight">
                  Discord
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmingDelete(true);
              }}
              className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onConfirm={() => {
          onDelete();
          setConfirmingDelete(false);
        }}
        onCancel={() => setConfirmingDelete(false)}
        title="Deletar sessão"
        description="Tem certeza? Todo o histórico desta conversa será perdido."
        confirmLabel="Deletar"
        variant="danger"
      />
    </div>
  );
}
