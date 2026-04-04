'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ChatSession } from '@/lib/agent-chat';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChatHistoryPanelProps {
  open: boolean;
  sessions: ChatSession[];
  activeSession: string | null;
  loading?: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onNewSession: () => void;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0)
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
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

export function ChatHistoryPanel({
  open,
  sessions,
  activeSession,
  loading,
  onClose,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onNewSession,
}: ChatHistoryPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = new Map<string, ChatSession[]>();
  for (const session of sessions) {
    const group = getSessionGroup(session.lastActivity);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)?.push(session);
  }

  return (
    <>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismissal */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 z-50 h-full w-[300px] bg-[var(--color-surface-1)] border-l border-[var(--color-border)] flex flex-col shadow-xl"
        role="dialog"
        aria-label="Histórico de sessões"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Histórico</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewSession}
              title="Nova sessão"
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <span className="text-xs text-[var(--color-text-muted)]">Carregando...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-[var(--color-text-muted)]">Nenhuma sessão</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, groupSessions]) => (
              <div key={group} className="mb-3">
                <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-2 block mb-1">
                  {group}
                </span>
                {groupSessions.map((session) => (
                  <HistorySessionItem
                    key={session.id}
                    session={session}
                    isActive={activeSession === session.id}
                    onSelect={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                    onDelete={() => onDeleteSession(session.id)}
                    onRename={(title) => onRenameSession(session.id, title)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function HistorySessionItem({
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
    if (editValue.trim()) onRename(editValue.trim());
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
      <div className="w-5 h-5 rounded-full bg-[var(--color-surface-3)] border border-[var(--color-border-subtle)] flex items-center justify-center text-xs leading-none flex-shrink-0">
        🦅
      </div>

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
