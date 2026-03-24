'use client';

import { useAgentWebSocket } from '@/lib/agent-api';
import { Clock, Heart, MessageSquare, Radio, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AgentStatusWidget() {
  const ws = useAgentWebSocket();
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | undefined>();
  const [heartbeatHistory, setHeartbeatHistory] = useState<Date[]>([]);

  useEffect(() => {
    if (ws.lastMessage && typeof ws.lastMessage === 'object') {
      const msg = ws.lastMessage as { type?: string };
      if (msg.type === 'heartbeat' || msg.type === 'connected') {
        const now = new Date();
        setLastHeartbeat(now);
        setHeartbeatHistory((prev) => [...prev, now].slice(-8));
      }
    }
  }, [ws.lastMessage]);

  const status = ws.status;
  const isOnline = status?.status === 'online';

  return (
    <div className="h-full flex flex-col gap-[var(--space-4)] p-[var(--space-1)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-2)]">
          <div className="relative">
            <Heart
              className={`h-4 w-4 ${isOnline ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}
              fill={isOnline ? 'currentColor' : 'none'}
            />
            {isOnline && (
              <span className="absolute inset-0 animate-ping opacity-75">
                <Heart className="h-4 w-4 text-[var(--color-success)]" fill="currentColor" />
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {isOnline ? 'Online' : status ? status.status : 'Conectando...'}
          </span>
        </div>
        <div className="flex gap-[var(--space-1)]">
          {heartbeatHistory.map((hb, i) => (
            <span
              key={`${hb.getTime()}-${i}`}
              className="h-2 w-2 rounded-full bg-[var(--color-success)]"
              title={hb.toLocaleTimeString('pt-BR')}
            />
          ))}
        </div>
      </div>

      {/* Stats grid */}
      {status && (
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Uptime</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {status.uptimeFormatted}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[var(--space-2)]">
            <MessageSquare className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Sessões</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {status.sessions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[var(--space-2)]">
            <Radio className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">WS clients</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {status.wsClients}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[var(--space-2)]">
            <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Último HB</p>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {lastHeartbeat ? lastHeartbeat.toLocaleTimeString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending automation */}
      {status?.pendingAutomation && (
        <div className="flex items-center gap-[var(--space-2)] text-[var(--color-warning)] text-xs">
          <Zap className="h-3.5 w-3.5" />
          <span>{status.pendingAutomation}</span>
        </div>
      )}

      {!status && <p className="text-sm text-[var(--color-text-muted)]">Conectando ao agent...</p>}
    </div>
  );
}
