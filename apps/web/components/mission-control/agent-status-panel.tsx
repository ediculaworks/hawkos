'use client';

import type { AgentStatus } from '@/lib/agent-api';
import { Clock, Heart, MessageSquare, Radio, Zap } from 'lucide-react';

interface AgentStatusPanelProps {
  status: AgentStatus | null;
  lastHeartbeat?: Date;
}

export function AgentStatusPanel({ status, lastHeartbeat }: AgentStatusPanelProps) {
  if (!status) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-5)]">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-4)]">
          AGENT STATUS
        </h2>
        <div className="flex items-center justify-center h-24 text-[var(--color-text-muted)]">
          Conectando ao agent...
        </div>
      </div>
    );
  }

  const isOnline = status.status === 'online';

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-5)]">
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-[var(--space-4)]">
        AGENT STATUS
      </h2>

      <div className="grid grid-cols-2 gap-[var(--space-4)]">
        {/* Status with Heartbeat */}
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="relative">
            <Heart
              className={`h-5 w-5 ${isOnline ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}
              fill={isOnline ? 'currentColor' : 'none'}
            />
            {isOnline && (
              <span className="absolute inset-0 animate-ping opacity-75">
                <Heart className="h-5 w-5 text-[var(--color-success)]" fill="currentColor" />
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Status</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
              {status.status}
            </p>
          </div>
        </div>

        {/* Last Heartbeat */}
        <div className="flex items-center gap-[var(--space-3)]">
          <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Último heartbeat</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {lastHeartbeat ? lastHeartbeat.toLocaleTimeString('pt-BR') : 'Aguardando...'}
            </p>
          </div>
        </div>

        {/* Uptime */}
        <div className="flex items-center gap-[var(--space-3)]">
          <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Uptime</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {status.uptimeFormatted}
            </p>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex items-center gap-[var(--space-3)]">
          <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Sessões ativas</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {status.sessions.length}
            </p>
          </div>
        </div>

        {/* WS Clients */}
        <div className="flex items-center gap-[var(--space-3)]">
          <Radio className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">WebSocket clients</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {status.wsClients}
            </p>
          </div>
        </div>
      </div>

      {/* Pending automation */}
      {status.pendingAutomation && (
        <div className="mt-[var(--space-4)] pt-[var(--space-4)] border-t border-[var(--color-border)]">
          <div className="flex items-center gap-[var(--space-2)] text-[var(--color-warning)]">
            <Zap className="h-4 w-4" />
            <span className="text-sm">Executando: {status.pendingAutomation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
