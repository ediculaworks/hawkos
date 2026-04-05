'use client';

import { AnimatedPage } from '@/components/motion/animated-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardSkeleton } from '@/components/ui/skeleton';
import {
  addProject,
  addWorkspace,
  fetchCareerCertifications,
  fetchCareerEducations,
  fetchCareerExperiences,
  fetchCareerProfile,
  fetchCareerSkills,
  fetchProjects,
  fetchRecentLogs,
  fetchWorkSummary,
  fetchWorkspaces,
} from '@/lib/actions/career';
import { CAREER_TEMPLATES } from '@/lib/career-templates';
import { formatCurrency, formatRelativeDay } from '@/lib/utils/format';
import type { SkillCategory, WorkspaceType } from '@hawk/module-career';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  MapPin,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

type CareerTab = 'work' | 'development' | 'history';

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

const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: 'Técnico',
  soft: 'Soft Skills',
  language: 'Idioma',
  tool: 'Ferramenta',
  domain: 'Domínio',
};

const SKILL_CATEGORY_COLORS: Record<SkillCategory, string> = {
  technical: 'var(--color-accent)',
  soft: 'var(--color-success)',
  language: 'var(--color-warning)',
  tool: 'var(--color-text-muted)',
  domain: 'var(--color-mod-career)',
};

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: CareerTab; onChange: (t: CareerTab) => void }) {
  const tabs: { id: CareerTab; label: string }[] = [
    { id: 'work', label: 'Trabalho' },
    { id: 'development', label: 'Desenvolvimento' },
    { id: 'history', label: 'Historial' },
  ];
  return (
    <div className="flex gap-1 border-b border-[var(--color-border-subtle)] pb-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t.id
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Tab: Trabalho ─────────────────────────────────────────────────────────────

function WorkTab() {
  const { data: workspaces } = useQuery({
    queryKey: ['career', 'workspaces'],
    queryFn: fetchWorkspaces,
  });
  const { data: projects } = useQuery({
    queryKey: ['career', 'projects'],
    queryFn: fetchProjects,
  });
  const { data: summaries } = useQuery({
    queryKey: ['career', 'summary'],
    queryFn: fetchWorkSummary,
  });
  const { data: recentLogs } = useQuery({
    queryKey: ['career', 'logs'],
    queryFn: () => fetchRecentLogs(15),
  });

  const totalMonthlyIncome = summaries
    ? summaries.reduce((acc, s) => {
        const fixed = s.workspace.monthly_income ?? 0;
        const hourly = s.workspace.hourly_rate ? s.total_hours_month * s.workspace.hourly_rate : 0;
        return acc + fixed + hourly;
      }, 0)
    : 0;

  return (
    <div className="space-y-[var(--space-5)]">
      {/* Total income */}
      {totalMonthlyIncome > 0 && (
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
        <div className="flex-1 min-w-0 space-y-[var(--space-5)]">
          {/* Workspace cards */}
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
                        <p className="text-lg font-semibold font-mono text-[var(--color-text-primary)]">
                          {s.total_hours_week}h
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--color-text-muted)]">Mês</span>
                        <p className="text-lg font-semibold font-mono text-[var(--color-text-primary)]">
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
              href="/dashboard/legal"
              className="flex items-center gap-[var(--space-1-5)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              Contratos → Jurídico
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Desenvolvimento ──────────────────────────────────────────────────────

function DevelopmentTab() {
  const { data: profile } = useQuery({
    queryKey: ['career', 'profile'],
    queryFn: fetchCareerProfile,
  });
  const { data: skills } = useQuery({
    queryKey: ['career', 'skills'],
    queryFn: fetchCareerSkills,
  });
  const { data: certifications } = useQuery({
    queryKey: ['career', 'certifications'],
    queryFn: fetchCareerCertifications,
  });

  const today = new Date().toISOString().split('T')[0] ?? '';

  // Group skills by category
  const skillsByCategory = (skills ?? []).reduce<Record<string, typeof skills>>((acc, s) => {
    const cat = s.category ?? 'technical';
    if (!acc[cat]) acc[cat] = [];
    (acc[cat] as NonNullable<typeof skills>).push(s);
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-6)]">
      {/* Situação de carreira */}
      <div className="lg:col-span-1 space-y-[var(--space-4)]">
        <Card>
          <CardContent className="pt-[var(--space-4)] space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
              Situação de Carreira
            </div>

            {profile ? (
              <div className="space-y-2">
                {profile.open_to_work && (
                  <span className="inline-block rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Open to Work
                  </span>
                )}
                {profile.headline && (
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {profile.headline}
                  </p>
                )}
                {profile.target_role && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Target:{' '}
                    <span className="text-[var(--color-text-secondary)]">
                      {profile.target_role}
                    </span>
                  </div>
                )}
                {profile.salary_expectation && (
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Pretensão:{' '}
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {formatCurrency(profile.salary_expectation)}
                    </span>
                  </div>
                )}
                {profile.location && (
                  <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <MapPin className="h-3 w-3" />
                    {profile.location}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      LinkedIn
                    </a>
                  )}
                  {profile.github_url && (
                    <a
                      href={profile.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      GitHub
                    </a>
                  )}
                  {profile.portfolio_url && (
                    <a
                      href={profile.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      Portfolio
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                Perfil não configurado. Usa o agente para preencher o teu perfil de carreira.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Certifications */}
        {certifications && certifications.length > 0 && (
          <Card>
            <CardContent className="pt-[var(--space-4)] space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                <Award className="h-4 w-4 text-[var(--color-warning)]" />
                Certificações
              </div>
              {certifications.map((c) => {
                const expired = c.expiry_date && c.expiry_date < today;
                const expiringSoon =
                  c.expiry_date &&
                  c.expiry_date > today &&
                  new Date(c.expiry_date).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[var(--color-text-primary)]">{c.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{c.issuer}</p>
                    </div>
                    {c.expiry_date && (
                      <span
                        className={`text-[10px] whitespace-nowrap ${
                          expired
                            ? 'text-[var(--color-danger)]'
                            : expiringSoon
                              ? 'text-[var(--color-warning)]'
                              : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {expired ? 'Expirada' : `até ${c.expiry_date}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skills matrix */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="pt-[var(--space-4)] space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <Zap className="h-4 w-4 text-[var(--color-accent)]" />
              Skills
            </div>
            {Object.keys(skillsByCategory).length > 0 ? (
              Object.entries(skillsByCategory).map(([cat, catSkills]) => (
                <div key={cat}>
                  <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    {SKILL_CATEGORY_LABELS[cat as SkillCategory] ?? cat}
                  </p>
                  <div className="space-y-1.5">
                    {(catSkills ?? []).map((s) => (
                      <div key={s.id} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--color-text-primary)] w-32 truncate flex-shrink-0">
                          {s.name}
                        </span>
                        <div className="flex-1 h-1.5 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${((s.level ?? 1) / 5) * 100}%`,
                              backgroundColor: SKILL_CATEGORY_COLORS[s.category ?? 'technical'],
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)] w-4 text-right">
                          {s.level ?? 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                Nenhuma skill registada. Usa <code>/skill add</code> no agente para adicionar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Tab: Historial ────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: experiences } = useQuery({
    queryKey: ['career', 'experiences'],
    queryFn: fetchCareerExperiences,
  });
  const { data: educations } = useQuery({
    queryKey: ['career', 'educations'],
    queryFn: fetchCareerEducations,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-6)]">
      {/* Experiências */}
      <div>
        <div className="flex items-center gap-2 mb-[var(--space-4)]">
          <Briefcase className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Experiência</h3>
        </div>
        {experiences && experiences.length > 0 ? (
          <div className="space-y-[var(--space-3)]">
            {experiences.map((exp) => (
              <div
                key={exp.id}
                className="border-l-2 border-[var(--color-border-subtle)] pl-[var(--space-4)] space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {exp.title ?? exp.company_name}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{exp.company_name}</p>
                  </div>
                  {exp.is_current && (
                    <span className="text-[10px] text-[var(--color-success)] border border-[var(--color-success)]/30 rounded px-1.5 py-0.5 flex-shrink-0">
                      Atual
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {exp.start_date} → {exp.is_current ? 'Presente' : (exp.end_date ?? '?')}
                </p>
                {exp.description && (
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Sem experiências. Usa <code>/experiencia add</code> no agente.
          </p>
        )}
      </div>

      {/* Formação */}
      <div>
        <div className="flex items-center gap-2 mb-[var(--space-4)]">
          <GraduationCap className="h-4 w-4 text-[var(--color-warning)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Formação</h3>
        </div>
        {educations && educations.length > 0 ? (
          <div className="space-y-[var(--space-3)]">
            {educations.map((edu) => (
              <div
                key={edu.id}
                className="border-l-2 border-[var(--color-border-subtle)] pl-[var(--space-4)] space-y-1"
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {edu.degree}
                  {edu.field_of_study ? ` em ${edu.field_of_study}` : ''}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">{edu.institution}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {edu.start_date ?? '?'} → {edu.is_current ? 'Presente' : (edu.end_date ?? '?')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">
            Sem formação. Usa <code>/formacao add</code> no agente.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CareerPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CareerTab>('work');

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ['career', 'workspaces'],
    queryFn: fetchWorkspaces,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['career'] });
  const hasWorkspaces = workspaces && workspaces.length > 0;

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

  return (
    <AnimatedPage className="space-y-[var(--space-5)]">
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'work' && <WorkTab />}
      {activeTab === 'development' && <DevelopmentTab />}
      {activeTab === 'history' && <HistoryTab />}
    </AnimatedPage>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────

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
