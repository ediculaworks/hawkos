'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { type ActivityLog, fetchActivityLogs } from '@/lib/agent-api';
import { Activity, AlertCircle, Brain, Calendar, Settings, Terminal, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  tool_call: <Wrench className="h-3.5 w-3.5" />,
  automation: <Calendar className="h-3.5 w-3.5" />,
  alert: <AlertCircle className="h-3.5 w-3.5" />,
  memory_created: <Brain className="h-3.5 w-3.5" />,
  memory_merged: <Brain className="h-3.5 w-3.5" />,
  session_committed: <Settings className="h-3.5 w-3.5" />,
  command: <Terminal className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />,
};

const EVENT_COLORS: Record<string, string> = {
  tool_call: 'text-[var(--color-accent)]',
  automation: 'text-[var(--color-success)]',
  alert: 'text-[var(--color-warning)]',
  memory_created: 'text-purple-400',
  memory_merged: 'text-purple-400',
  session_committed: 'text-[var(--color-text-muted)]',
  command: 'text-blue-400',
  error: 'text-[var(--color-error)]',
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return date.toLocaleDateString('pt-BR');
}

export function ActivityLogPanel() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchActivityLogs({ limit: 50 }).then((res) => {
      if (mounted) {
        setLogs(res.logs);
        setLoading(false);
      }
    });

    const interval = setInterval(() => {
      fetchActivityLogs({ limit: 50 }).then((res) => {
        if (mounted) setLogs(res.logs);
      });
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-[var(--space-5)]">
      <div className="flex items-center justify-between mb-[var(--space-4)]">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">ACTIVITY LOG</h2>
        <Link href="/dashboard/logs" className="text-xs text-[var(--color-accent)] hover:underline">
          Ver todos
        </Link>
      </div>

      {loading ? (
        <ListSkeleton items={5} />
      ) : logs.length === 0 ? (
        <div className="h-24 flex items-center justify-center">
          <EmptyState
            icon={Activity}
            title="Nenhuma atividade recente"
            description="Atividades aparecerão aqui conforme você usa o sistema"
          />
        </div>
      ) : (
        <div className="space-y-[var(--space-1)] max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-[var(--space-2)] text-xs">
              <span className={EVENT_COLORS[log.event_type] || 'text-[var(--color-text-muted)]'}>
                {EVENT_ICONS[log.event_type] || <Activity className="h-3.5 w-3.5" />}
              </span>
              <span className="text-[var(--color-text-muted)] min-w-[40px]">
                {formatTime(log.created_at)}
              </span>
              <span className="text-[var(--color-text-secondary)] flex-1 truncate">
                {log.summary}
              </span>
              {log.module && (
                <span className="text-[var(--color-text-muted)] opacity-60">{log.module}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
