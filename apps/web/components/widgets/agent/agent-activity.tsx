'use client';

import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { type ActivityLog, fetchActivityLogs } from '@/lib/agent-api';
import {
  Activity,
  AlertCircle,
  Brain,
  Calendar,
  ScrollText,
  Settings,
  Terminal,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const EVENT_ICONS: Record<string, React.ReactNode> = {
  tool_call: <Wrench className="h-3 w-3" />,
  automation: <Calendar className="h-3 w-3" />,
  alert: <AlertCircle className="h-3 w-3" />,
  memory_created: <Brain className="h-3 w-3" />,
  memory_merged: <Brain className="h-3 w-3" />,
  session_committed: <Settings className="h-3 w-3" />,
  command: <Terminal className="h-3 w-3" />,
  error: <AlertCircle className="h-3 w-3" />,
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
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function AgentActivityWidget() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchActivityLogs({ limit: 30 }).then((res) => {
      if (mounted) {
        setLogs(res.logs);
        setLoading(false);
      }
    });
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchActivityLogs({ limit: 30 }).then((res) => {
        if (mounted) setLogs(res.logs);
      });
    }, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="h-full flex flex-col gap-[var(--space-3)] p-[var(--space-1)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          Atividade
        </p>
        <Link
          href="/dashboard/logs"
          className="text-[10px] text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          <ScrollText className="h-3 w-3" />
          Ver tudo
        </Link>
      </div>

      {loading ? (
        <ListSkeleton items={5} />
      ) : logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Activity}
            title="Sem atividade"
            description="Atividades aparecerão aqui"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-1)] overflow-y-auto flex-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-[var(--space-2)] text-[11px]">
              <span
                className={`mt-0.5 flex-shrink-0 ${EVENT_COLORS[log.event_type] ?? 'text-[var(--color-text-muted)]'}`}
              >
                {EVENT_ICONS[log.event_type] ?? <Activity className="h-3 w-3" />}
              </span>
              <span className="text-[var(--color-text-muted)] min-w-[32px] flex-shrink-0">
                {formatTime(log.created_at)}
              </span>
              <span className="text-[var(--color-text-secondary)] flex-1 truncate">
                {log.summary}
              </span>
              {log.module && (
                <span className="text-[var(--color-text-muted)] opacity-50 flex-shrink-0">
                  {log.module}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
