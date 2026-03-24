'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAgentWebSocket } from '@/lib/agent-api';
import { MessageSquare, X } from 'lucide-react';

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export default function AgentSessionsWidget() {
  const ws = useAgentWebSocket();
  const sessions = ws.status?.sessions ?? [];

  const handleKill = (sessionId: string) => {
    if (confirm('Encerrar esta sessão?')) {
      ws.killSession(sessionId);
    }
  };

  return (
    <div className="h-full flex flex-col gap-[var(--space-3)] p-[var(--space-1)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Sessões ativas
        </p>
        <span className="text-xs text-[var(--color-text-muted)]">{sessions.length}</span>
      </div>

      {sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma sessão ativa"
            description="Inicie uma conversa no chat"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-2)] overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-[var(--space-3)] py-[var(--space-2)]"
            >
              <div className="flex items-center gap-[var(--space-2)] min-w-0">
                <MessageSquare className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                    {session.channel}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {session.messageCount} msgs · {formatTimeAgo(session.lastActivity)}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-[var(--color-error)] hover:text-[var(--color-error)]"
                onClick={() => handleKill(session.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
