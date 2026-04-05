'use client';

import {
  Activity,
  ChevronDown,
  ChevronRight,
  Coins,
  Cpu,
  RefreshCw,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { deleteTenant, updateTenantStatus } from '@/lib/actions/admin';

// ── Types ────────────────────────────────────────────────────────────────────

interface LogEntry {
  level: 'log' | 'warn' | 'error';
  ts: string;
  text: string;
}

interface AdminDashboardProps {
  overview: {
    totalTenants: number;
    activeTenants: number;
    todayMessages: number;
    todayTokens: number;
    todayCost: number;
  };
  tenants: Array<{
    id: string;
    slug: string;
    label: string;
    status: string;
    schemaName: string;
    ownerEmail: string | null;
    createdAt: string;
    updatedAt: string;
    todayMessages: number;
    todayTokens: number;
    todayCost: number;
    memoryCount: number;
    lastActivity: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    details: Record<string, unknown>;
    performedBy: string;
    createdAt: string;
    tenantSlug: string;
    tenantLabel: string;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
  inactive: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

// ── Component ────────────────────────────────────────────────────────────────

export function AdminDashboard({ overview, tenants, activity }: AdminDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activityOpen, setActivityOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [logService, setLogService] = useState<string>('agent');
  const logsBottomRef = useRef<HTMLDivElement>(null);
  const logReaderRef = useRef<AbortController | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);

  const LOG_SERVICES = ['agent', 'web', 'postgres', 'caddy'] as const;

  const startLogStream = useCallback((service: string) => {
    logReaderRef.current?.abort();
    setLogLines([]);
    const ctrl = new AbortController();
    logReaderRef.current = ctrl;

    fetch(`/api/agent/admin/logs/stream?tail=200&service=${service}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          setLogLines([
            {
              level: 'error',
              ts: new Date().toISOString(),
              text: `${res.status} ${res.statusText}`,
            },
          ]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          const newEntries: LogEntry[] = [];
          for (const l of lines) {
            if (!l.startsWith('data:')) continue;
            try {
              const payload = JSON.parse(l.replace(/^data:\s?/, ''));
              if (payload.type === 'log') {
                newEntries.push({
                  level: payload.level ?? 'log',
                  ts: payload.ts ?? '',
                  text: payload.line ?? '',
                });
              }
            } catch {
              /* malformed */
            }
          }
          if (newEntries.length > 0) {
            setLogLines((prev) => [...prev, ...newEntries].slice(-500));
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLogLines((prev) => [
            ...prev,
            { level: 'error', ts: new Date().toISOString(), text: err.message },
          ]);
        }
      });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: logService excluded — service changes handled by onClick
  useEffect(() => {
    if (logsOpen) {
      startLogStream(logService);
    } else {
      logReaderRef.current?.abort();
    }
    return () => logReaderRef.current?.abort();
  }, [logsOpen, startLogStream]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new lines
  useEffect(() => {
    logsBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleStatusChange(tenantId: string, newStatus: string) {
    try {
      await updateTenantStatus(tenantId, newStatus);
      setStatusMenuOpen(null);
      startTransition(() => router.refresh());
    } catch {
      // status update failed — refresh will show current state
    }
  }

  async function handleDelete(tenantId: string) {
    try {
      await deleteTenant(tenantId);
      setConfirmDelete(null);
      startTransition(() => router.refresh());
    } catch {
      // delete failed — refresh will show current state
    }
  }

  return (
    <div className="space-y-[var(--space-6)] p-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Administração</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Painel de controle multi-tenant
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--space-4)]">
        <OverviewCard
          icon={<Users className="h-5 w-5" />}
          label="Total Tenants"
          value={String(overview.totalTenants)}
        />
        <OverviewCard
          icon={<Activity className="h-5 w-5" />}
          label="Tenants Ativos"
          value={String(overview.activeTenants)}
          accent
        />
        <OverviewCard
          icon={<Cpu className="h-5 w-5" />}
          label="Tokens Hoje"
          value={formatTokens(overview.todayTokens)}
        />
        <OverviewCard
          icon={<Coins className="h-5 w-5" />}
          label="Custo Hoje"
          value={formatCost(overview.todayCost)}
        />
      </div>

      {/* Tenant Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Tenants</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Slug
                </th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Label
                </th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Email
                </th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Criado em
                </th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Status
                </th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  LLM Calls
                </th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Tokens
                </th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Cost
                </th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Memories
                </th>
                <th className="text-left px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Last Active
                </th>
                <th className="text-right px-[var(--space-4)] py-[var(--space-2)] font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <td className="px-[var(--space-4)] py-[var(--space-3)] font-mono text-xs text-[var(--color-accent)]">
                    {t.slug}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-text-primary)]">
                    {t.label || '-'}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-text-secondary)]">
                    {t.ownerEmail ? (
                      <a
                        href={`mailto:${t.ownerEmail}`}
                        className="hover:text-[var(--color-accent)] transition-colors"
                      >
                        {t.ownerEmail}
                      </a>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-text-muted)] whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)]">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[t.status] ?? STATUS_COLORS.inactive}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right text-[var(--color-text-secondary)] tabular-nums">
                    {t.todayMessages}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right text-[var(--color-text-secondary)] tabular-nums">
                    {formatTokens(t.todayTokens)}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right text-[var(--color-text-secondary)] tabular-nums">
                    {formatCost(t.todayCost)}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right text-[var(--color-text-secondary)] tabular-nums">
                    {t.memoryCount}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-[var(--color-text-muted)]">
                    {formatRelativeTime(t.lastActivity)}
                  </td>
                  <td className="px-[var(--space-4)] py-[var(--space-3)] text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Status dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setStatusMenuOpen(statusMenuOpen === t.id ? null : t.id)}
                          className="rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)] transition-colors"
                        >
                          Status
                        </button>
                        {statusMenuOpen === t.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] py-1 shadow-lg">
                            {['active', 'pending', 'inactive', 'suspended'].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleStatusChange(t.id, s)}
                                disabled={t.status === s}
                                className="block w-full px-3 py-1.5 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(confirmDelete === t.id ? null : t.id)}
                        className="rounded-[var(--radius-md)] p-1 text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Delete tenant"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Confirm delete */}
                    {confirmDelete === t.id && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="text-[10px] text-red-400">
                          Confirmar delete de {t.slug}?
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id)}
                          className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/25 transition-colors"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-[var(--space-4)] py-[var(--space-6)] text-center text-[var(--color-text-muted)]"
                  >
                    Nenhum tenant encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setActivityOpen(!activityOpen)}
          className="flex w-full items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-2)]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Activity Feed
            </h2>
            <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
              ({activity.length})
            </span>
          </div>
          {activityOpen ? (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
          )}
        </button>
        {activityOpen && (
          <div className="max-h-[360px] overflow-y-auto">
            {activity.length === 0 ? (
              <div className="px-[var(--space-4)] py-[var(--space-6)] text-center text-sm text-[var(--color-text-muted)]">
                Nenhuma atividade registada.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-[var(--space-4)] py-[var(--space-3)]"
                  >
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {a.action}
                        </span>
                        {a.tenantSlug && (
                          <span className="text-[10px] font-mono text-[var(--color-accent)]">
                            {a.tenantSlug}
                          </span>
                        )}
                      </div>
                      {a.details && Object.keys(a.details).length > 0 && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                          {JSON.stringify(a.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap flex-shrink-0">
                      {formatRelativeTime(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent Logs Viewer */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setLogsOpen(!logsOpen)}
          className="flex w-full items-center justify-between px-[var(--space-4)] py-[var(--space-3)] border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-2)]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Logs</h2>
          </div>
          {logsOpen ? (
            <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
          )}
        </button>
        {logsOpen && (
          <div>
            <div className="flex items-center justify-between px-[var(--space-4)] py-2 border-b border-[var(--color-border-subtle)] bg-zinc-900">
              {/* Service selector */}
              <div className="flex items-center gap-1">
                {LOG_SERVICES.map((svc) => (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => {
                      setLogService(svc);
                      startLogStream(svc);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                      logService === svc
                        ? 'bg-zinc-600 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {svc}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => startLogStream(logService)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            <div className="bg-zinc-950 p-[var(--space-4)] min-h-[200px] max-h-[400px] overflow-y-auto font-mono text-xs">
              {logLines.length === 0 ? (
                <p className="text-zinc-600 animate-pulse">Connecting to agent logs…</p>
              ) : (
                logLines.map((entry, i) => (
                  <p
                    key={`${i}-${entry.ts}`}
                    className={
                      entry.level === 'error'
                        ? 'text-red-400/80'
                        : entry.level === 'warn'
                          ? 'text-amber-400/70'
                          : 'text-emerald-400/70'
                    }
                  >
                    <span className="text-zinc-600 mr-2">{entry.ts.slice(11, 19)}</span>
                    {entry.text}
                  </p>
                ))
              )}
              <div ref={logsBottomRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OverviewCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] p-[var(--space-4)]">
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${accent ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {value}
      </p>
    </div>
  );
}
