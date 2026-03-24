'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { fetchProjects, fetchWorkSummary, fetchWorkspaces } from '@/lib/actions/career';
import { formatCurrency } from '@/lib/utils/format';
import type { WorkspaceType } from '@hawk/module-career/types';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ExternalLink, FolderOpen } from 'lucide-react';
import Link from 'next/link';

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

export function ProjectsView() {
  const { data: workspaces } = useQuery({
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

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="space-y-[var(--space-3)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          Nenhum workspace configurado. Configure sua carreira primeiro.
        </p>
        <Link
          href="/dashboard/career"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Ir para Carreira →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-5)]">
      {/* Hours summary — compact bar */}
      {summaries && summaries.length > 0 && (
        <div className="flex items-center gap-[var(--space-4)] flex-wrap">
          {summaries.map((s) => (
            <div key={s.workspace.id} className="flex items-center gap-[var(--space-2)]">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: TYPE_COLORS[s.workspace.type] }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">{s.workspace.name}</span>
              <span className="text-xs font-mono text-[var(--color-text-primary)]">
                {s.total_hours_week}h/sem
              </span>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                {s.total_hours_month}h/mês
              </span>
              {s.workspace.hourly_rate && (
                <span className="text-[11px] text-[var(--color-success)]">
                  {formatCurrency(s.total_hours_month * s.workspace.hourly_rate)}
                </span>
              )}
            </div>
          ))}
          <Link
            href="/dashboard/career"
            className="text-[11px] text-[var(--color-accent)] hover:underline ml-auto"
          >
            Gerenciar carreira →
          </Link>
        </div>
      )}

      {/* Projects grouped by workspace */}
      {workspaces.map((ws) => {
        const wsProjects = (projects ?? []).filter((p) => p.workspace_id === ws.id);
        if (wsProjects.length === 0) return null;

        return (
          <div key={ws.id}>
            <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
              <Briefcase className="h-3.5 w-3.5" style={{ color: TYPE_COLORS[ws.type] }} />
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: TYPE_COLORS[ws.type] }}
              >
                {ws.name}
              </span>
              <Badge variant="muted">{TYPE_LABELS[ws.type]}</Badge>
            </div>
            <div className="space-y-[var(--space-2)] ml-[var(--space-1)]">
              {wsProjects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="pt-[var(--space-3)] pb-[var(--space-3)]">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <FolderOpen
                            className="h-3.5 w-3.5 flex-shrink-0"
                            style={{ color: TYPE_COLORS[ws.type] }}
                          />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {project.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                            P{project.priority}
                          </span>
                          {project.github_repo && (
                            <a
                              href={project.github_repo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-accent)] hover:underline flex-shrink-0"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-[var(--space-1)] ml-[calc(var(--space-2)+14px)]">
                            {project.description}
                          </p>
                        )}
                      </div>

                      {project.start_date && (
                        <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                          desde{' '}
                          {new Date(`${project.start_date}T12:00:00`).toLocaleDateString('pt-BR', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Orphan projects (no workspace) */}
      {projects && projects.filter((p) => !p.workspace_id).length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-2)] block">
            Sem workspace
          </span>
          <div className="space-y-[var(--space-2)]">
            {projects
              .filter((p) => !p.workspace_id)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-[var(--space-2)] text-sm text-[var(--color-text-secondary)]"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  {p.name}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
