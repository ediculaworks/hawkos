'use client';

import { AnimatedPage } from '@/components/motion/animated-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import {
  addProject,
  addWorkspace,
  fetchProjects,
  fetchRecentLogs,
  fetchWorkSummary,
  fetchWorkspaces,
} from '@/lib/actions/career';
import { CAREER_TEMPLATES } from '@/lib/career-templates';
import { formatCurrency, formatRelativeDay } from '@/lib/utils/format';
import type { WorkspaceType } from '@hawk/module-career/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ExternalLink, FolderOpen, Target } from 'lucide-react';
import { useState } from 'react';

const TYPE_LABELS: Record<WorkspaceType, string> = {
  employment: 'Emprego',
  company: 'Empresa',
  freelance: 'Freelance',
};

const TYPE_COLORS: Record<WorkspaceType, string> = {
  employment: 'var(--color-accent)',
  company: 'var(--color-success)',
  freelance: 'var(--color-warning)',
};

export default function CareerPage() {
  const queryClient = useQueryClient();

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ['career', 'workspaces'],
    queryFn: () => fetchWorkspaces(),
  });
  const { data: projects } = useQuery({
    queryKey: ['career', 'projects'],
    queryFn: () => fetchProjects(),
  });
  const { data: summaries } = useQuery({
    queryKey: ['career', 'summary'],
    queryFn: () => fetchWorkSummary(),
  });
  const { data: recentLogs } = useQuery({
    queryKey: ['career', 'logs'],
    queryFn: () => fetchRecentLogs(15),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['career'] });
  const hasWorkspaces = workspaces && workspaces.length > 0;

  // Loading state
  if (wsLoading && !workspaces) {
    return (
      <AnimatedPage className="space-y-[var(--space-5)]">
        <div className="grid grid-cols-1 gap-[var(--space-3)] md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AnimatedPage>
    );
  }

  // Show template picker if no workspaces
  if (workspaces && !hasWorkspaces) {
    return (
      <AnimatedPage className="space-y-[var(--space-6)]">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Configurar Carreira
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-1)]">
            Escolha um template ou crie do zero
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-3">
          {CAREER_TEMPLATES.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              template={tmpl}
              onApply={async () => {
                for (const ws of tmpl.workspaces) {
                  await addWorkspace(ws);
                }
                // Projects need workspace IDs — fetch after creation
                const created = await fetchWorkspaces();
                for (const proj of tmpl.projects) {
                  const ws = created.find((w) => w.name === proj.workspace_name);
                  if (ws)
                    await addProject({
                      name: proj.name,
                      workspace_id: ws.id,
                      description: proj.description,
                      priority: proj.priority,
                    });
                }
                invalidate();
              }}
            />
          ))}
        </div>
      </AnimatedPage>
    );
  }

  // Total income calculation
  const totalMonthlyIncome = summaries
    ? summaries.reduce((acc, s) => {
        const fixed = s.workspace.monthly_income ?? 0;
        const hourly = s.workspace.hourly_rate ? s.total_hours_month * s.workspace.hourly_rate : 0;
        return acc + fixed + hourly;
      }, 0)
    : 0;

  // Main career view
  return (
    <AnimatedPage className="space-y-[var(--space-5)]">
      {/* Total income summary */}
      {summaries && summaries.length > 0 && totalMonthlyIncome > 0 && (
        <Card>
          <CardContent className="pt-[var(--space-4)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Renda Mensal Total
              </span>
              <p className="text-2xl font-bold font-mono text-[var(--color-success)]">
                {formatCurrency(totalMonthlyIncome)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-[var(--space-6)] items-start">
        {/* Main: Summaries + Logs */}
        <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
          {/* Workspace summaries */}
          {summaries && summaries.length > 0 && (
            <div className="grid grid-cols-1 gap-[var(--space-3)] md:grid-cols-2">
              {summaries.map((s) => (
                <Card key={s.workspace.id}>
                  <CardContent className="pt-[var(--space-4)]">
                    <div className="flex items-center justify-between mb-[var(--space-3)]">
                      <div className="flex items-center gap-[var(--space-2)]">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: TYPE_COLORS[s.workspace.type] }}
                        />
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {s.workspace.name}
                        </span>
                        <Badge variant="muted">{TYPE_LABELS[s.workspace.type]}</Badge>
                      </div>
                      {s.workspace.hourly_rate && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {formatCurrency(s.workspace.hourly_rate)}/h
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-[var(--space-3)]">
                      <div>
                        <span className="text-[11px] text-[var(--color-text-muted)]">Semana</span>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)] font-mono">
                          {s.total_hours_week}h
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--color-text-muted)]">Mês</span>
                        <p className="text-lg font-semibold text-[var(--color-text-primary)] font-mono">
                          {s.total_hours_month}h
                        </p>
                      </div>
                    </div>

                    {s.workspace.hourly_rate && (
                      <div className="mt-[var(--space-2)] pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]">
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          Faturamento mês
                        </span>
                        <p className="text-sm font-mono text-[var(--color-success)]">
                          {formatCurrency(s.total_hours_month * s.workspace.hourly_rate)}
                        </p>
                      </div>
                    )}
                    {s.workspace.monthly_income && (
                      <div className="mt-[var(--space-2)] pt-[var(--space-2)] border-t border-[var(--color-border-subtle)]">
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          Renda fixa
                        </span>
                        <p className="text-sm font-mono text-[var(--color-success)]">
                          {formatCurrency(s.workspace.monthly_income)}/mês
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recent logs */}
          {recentLogs && recentLogs.length > 0 && (
            <div>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Registros recentes
              </span>
              <div className="mt-[var(--space-2)] space-y-[var(--space-1)]">
                {recentLogs.map((log) => {
                  const ws = workspaces?.find((w) => w.id === log.workspace_id);
                  const proj = projects?.find((p) => p.id === log.project_id);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-[var(--space-3)] py-[var(--space-1-5)]"
                    >
                      <span className="text-[11px] text-[var(--color-text-muted)] w-16 flex-shrink-0">
                        {formatRelativeDay(log.date)}
                      </span>
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: ws ? TYPE_COLORS[ws.type] : 'var(--color-text-muted)',
                        }}
                      />
                      <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">
                        {log.description || ws?.name || '—'}
                      </span>
                      {proj && <Badge variant="muted">{proj.name}</Badge>}
                      <span className="text-xs font-mono text-[var(--color-text-secondary)] flex-shrink-0">
                        {Math.floor(log.duration_minutes / 60)}h
                        {log.duration_minutes % 60 > 0 ? `${log.duration_minutes % 60}m` : ''}
                      </span>
                      {log.billable && (
                        <span className="text-[10px] text-[var(--color-success)]">$</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Projects */}
        <div className="w-64 flex-shrink-0 space-y-[var(--space-4)] hidden lg:block">
          {projects && projects.length > 0 && (
            <div className="space-y-[var(--space-2)]">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Projetos ativos
              </span>
              {projects.map((p) => {
                const ws = workspaces?.find((w) => w.id === p.workspace_id);
                return (
                  <div key={p.id} className="space-y-[var(--space-0-5)]">
                    <div className="flex items-center gap-[var(--space-1-5)]">
                      <FolderOpen className="h-3 w-3 text-[var(--color-text-muted)]" />
                      <span className="text-xs text-[var(--color-text-primary)] truncate">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-[var(--space-2)] ml-[var(--space-4)]">
                      {ws && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {ws.name}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        P{p.priority}
                      </span>
                      {p.github_repo && (
                        <a
                          href={p.github_repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Integration links */}
          <div className="space-y-[var(--space-2)] text-[11px]">
            <span className="font-medium text-[var(--color-text-muted)] uppercase tracking-wider block">
              Integrações
            </span>
            <a
              href="/dashboard/objectives"
              className="flex items-center gap-[var(--space-1-5)] text-[var(--color-accent)] hover:underline"
            >
              <Target className="h-3 w-3" /> Ver projetos em Objetivos
            </a>
            <a
              href="/dashboard/health"
              className="flex items-center gap-[var(--space-1-5)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              Médico → Saúde
            </a>
            <a
              href="/dashboard/legal"
              className="flex items-center gap-[var(--space-1-5)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              Contratos → Jurídico
            </a>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}

function TemplateCard({
  template,
  onApply,
}: { template: (typeof CAREER_TEMPLATES)[number]; onApply: () => Promise<void> }) {
  const [applying, setApplying] = useState(false);

  return (
    <Card>
      <CardContent className="pt-[var(--space-5)]">
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-3)]">
          <span className="text-2xl">{template.icon}</span>
          <div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {template.label}
            </span>
            <p className="text-[11px] text-[var(--color-text-muted)]">{template.description}</p>
          </div>
        </div>

        <div className="space-y-[var(--space-1)] mb-[var(--space-3)]">
          <span className="text-[11px] text-[var(--color-text-muted)]">Inclui:</span>
          {template.workspaces.map((ws) => (
            <div
              key={ws.name}
              className="flex items-center gap-[var(--space-1-5)] text-xs text-[var(--color-text-secondary)]"
            >
              <Briefcase className="h-3 w-3" /> {ws.name}
              <Badge variant="muted">{ws.type}</Badge>
            </div>
          ))}
          {template.projects.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-[var(--space-1-5)] text-xs text-[var(--color-text-secondary)]"
            >
              <FolderOpen className="h-3 w-3" /> {p.name}
            </div>
          ))}
        </div>

        {template.integrations.length > 0 && (
          <div className="mb-[var(--space-3)]">
            <span className="text-[11px] text-[var(--color-text-muted)]">Integra com: </span>
            {template.integrations.map((mod) => (
              <Badge key={mod} variant="default">
                {mod}
              </Badge>
            ))}
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={async () => {
            setApplying(true);
            await onApply();
            setApplying(false);
          }}
          disabled={applying}
        >
          {applying ? 'Aplicando...' : 'Usar template'}
        </Button>
      </CardContent>
    </Card>
  );
}
