'use client';

import type { DemandLog } from '@hawk/module-demands/types';

const LOG_TYPE_COLORS: Record<string, string> = {
  info: 'var(--color-text-muted)',
  agent_action: 'var(--color-accent)',
  agent_comms: 'var(--color-accent)',
  tool_call: 'var(--color-warning)',
  error: 'var(--color-danger)',
  retry: 'var(--color-warning)',
  checkpoint: 'var(--color-warning)',
  human_input: 'var(--color-success)',
  status_change: 'var(--color-text-secondary)',
};

const LOG_TYPE_LABELS: Record<string, string> = {
  info: 'Info',
  agent_action: 'Acao',
  agent_comms: 'Comms',
  tool_call: 'Tool',
  error: 'Erro',
  retry: 'Retry',
  checkpoint: 'Checkpoint',
  human_input: 'Humano',
  status_change: 'Status',
};

type Props = {
  logs: DemandLog[];
};

export function DemandActivityFeed({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] py-[var(--space-4)] text-center">
        Nenhuma atividade registrada
      </p>
    );
  }

  return (
    <div className="space-y-[var(--space-2)] max-h-[500px] overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-[var(--space-2)] text-xs">
          {/* Type indicator */}
          <div
            className="w-1 rounded-full shrink-0 mt-1"
            style={{
              backgroundColor: LOG_TYPE_COLORS[log.log_type] ?? 'var(--color-text-muted)',
              minHeight: '16px',
            }}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[var(--space-2)]">
              <span
                className="text-[10px] font-medium"
                style={{ color: LOG_TYPE_COLORS[log.log_type] }}
              >
                {LOG_TYPE_LABELS[log.log_type] ?? log.log_type}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] ml-auto shrink-0">
                {formatTime(log.created_at)}
              </span>
            </div>
            <p className="text-[var(--color-text-secondary)] mt-0.5 break-words">{log.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
