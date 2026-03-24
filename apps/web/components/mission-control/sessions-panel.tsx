'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import type { AgentSession } from '@/lib/agent-api';
import { MessageSquare, X } from 'lucide-react';

interface SessionsPanelProps {
  sessions: AgentSession[];
  onKillSession: (sessionId: string) => boolean;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export function SessionsPanel({ sessions, onKillSession }: SessionsPanelProps) {
  const handleKill = (sessionId: string) => {
    if (confirm('Encerrar esta sessão?')) {
      onKillSession(sessionId);
    }
  };

  const sessionList = Array.isArray(sessions) ? sessions : [];

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-5)]">
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-4)]">
        SESSIONS
      </h2>

      {sessionList.length === 0 ? (
        <div className="h-24 flex items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma sessão ativa"
            description="Inicie uma nova conversa no chat"
          />
        </div>
      ) : (
        <div className="space-y-[var(--space-2)]">
          {sessionList.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-[var(--space-3)]"
            >
              <div className="flex items-center gap-[var(--space-3)]">
                <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {session.channel}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {session.messageCount} msgs • {formatTimeAgo(session.lastActivity)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleKill(session.id)}
                className="text-[var(--color-error)] hover:text-[var(--color-error)]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
