'use client';

import type { ChatSession } from '@/lib/agent-chat';
import { AlignLeft, Plus, X } from 'lucide-react';

interface ChatTabsProps {
  openTabs: string[];
  sessions: ChatSession[];
  activeSession: string | null;
  onSelectTab: (sessionId: string) => void;
  onCloseTab: (sessionId: string) => void;
  onNewSession: () => void;
  onOpenHistory: () => void;
}

function getTabLabel(session?: ChatSession): string {
  if (!session) return 'Sessão';
  const title = session.title || session.lastMessage?.slice(0, 30) || 'Nova sessão';
  return title.length > 22 ? `${title.slice(0, 22)}…` : title;
}

function getTabEmoji(session?: ChatSession): string {
  if (!session) return '🦅';
  if (session.agentName && session.agentName !== 'Hawk') {
    // Try to extract an emoji from the agent name
    const firstChar = session.agentName.codePointAt(0) ?? 0;
    if (firstChar > 127) return String.fromCodePoint(firstChar);
  }
  return '🦅';
}

export function ChatTabs({
  openTabs,
  sessions,
  activeSession,
  onSelectTab,
  onCloseTab,
  onNewSession,
  onOpenHistory,
}: ChatTabsProps) {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));

  return (
    <div className="flex items-center min-h-[36px] border-b border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-x-auto scrollbar-none flex-shrink-0">
      {/* Tabs */}
      <div className="flex items-stretch min-w-0 flex-1">
        {openTabs.map((tabId) => {
          const session = sessionMap.get(tabId);
          const isActive = tabId === activeSession;

          return (
            <div
              key={tabId}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 min-w-0 max-w-[180px] flex-shrink-0 cursor-pointer select-none border-r border-[var(--color-border-subtle)] transition-colors ${
                isActive
                  ? 'bg-[var(--color-surface-0)] border-b-2 border-b-[var(--color-accent)] -mb-px'
                  : 'bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-1)]'
              }`}
              onClick={() => onSelectTab(tabId)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectTab(tabId)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
            >
              <span className="text-sm leading-none flex-shrink-0">{getTabEmoji(session)}</span>
              <span
                className={`text-xs truncate flex-1 min-w-0 ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}
              >
                {getTabLabel(session)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tabId);
                }}
                className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-opacity cursor-pointer"
                aria-label="Fechar aba"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0">
        <button
          type="button"
          onClick={onNewSession}
          title="Nova sessão"
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          title="Histórico de sessões"
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
