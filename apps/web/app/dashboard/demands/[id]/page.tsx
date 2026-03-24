'use client';

import { DemandActivityFeed } from '@/components/demands/demand-activity-feed';
import { DemandArtifacts } from '@/components/demands/demand-artifacts';
import { DemandStepsTimeline } from '@/components/demands/demand-steps-timeline';
import { AnimatedPage } from '@/components/motion/animated-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  cancelDemandAction,
  fetchDemandFull,
  pauseDemandAction,
  resumeDemandAction,
} from '@/lib/actions/demands';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, Rocket, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  draft: 'muted',
  triaging: 'default',
  planned: 'warning',
  running: 'default',
  paused: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'muted',
};

export default function DemandDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: demand, isLoading } = useQuery({
    queryKey: ['demands', 'detail', id],
    queryFn: () => fetchDemandFull(id),
    refetchInterval: 10000, // poll every 10s for progress
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelDemandAction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['demands'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseDemandAction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['demands'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeDemandAction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['demands'] }),
  });

  if (isLoading) {
    return (
      <AnimatedPage className="space-y-[var(--space-5)]">
        <ListSkeleton items={5} />
      </AnimatedPage>
    );
  }

  if (!demand) {
    return (
      <AnimatedPage>
        <p className="text-sm text-[var(--color-text-muted)]">Demanda nao encontrada.</p>
      </AnimatedPage>
    );
  }

  const isActive = ['running', 'paused', 'planned'].includes(demand.status);

  return (
    <AnimatedPage className="space-y-[var(--space-5)]">
      {/* Back link */}
      <Link
        href="/dashboard/objectives"
        className="inline-flex items-center gap-[var(--space-1)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div className="flex-1">
          <div className="flex items-center gap-[var(--space-2)]">
            <Rocket className="h-4 w-4 text-[var(--color-accent)]" />
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {demand.title}
            </h1>
          </div>
          {demand.description && (
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{demand.description}</p>
          )}
        </div>

        <div className="flex items-center gap-[var(--space-2)]">
          <Badge variant={STATUS_BADGE[demand.status] ?? 'muted'}>{demand.status}</Badge>
          {isActive && (
            <>
              {demand.status === 'running' && (
                <Button size="sm" variant="ghost" onClick={() => pauseMutation.mutate()}>
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              )}
              {demand.status === 'paused' && (
                <Button size="sm" variant="ghost" onClick={() => resumeMutation.mutate()}>
                  <Play className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate()}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>
            {demand.completed_steps}/{demand.total_steps} steps concluidos
          </span>
          <span className="font-medium text-[var(--color-text-primary)]">{demand.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${demand.progress}%`,
              backgroundColor:
                demand.progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
            }}
          />
        </div>
      </div>

      {/* Main content: 2/3 + 1/3 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--space-5)]">
        {/* Left: Steps + Artifacts */}
        <div className="lg:col-span-2 space-y-[var(--space-5)]">
          {/* Steps Timeline */}
          <section>
            <h2 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
              Etapas
            </h2>
            <DemandStepsTimeline steps={demand.steps} demandId={demand.id} />
          </section>

          {/* Artifacts */}
          {demand.artifacts.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
                Artefatos
              </h2>
              <DemandArtifacts artifacts={demand.artifacts} />
            </section>
          )}
        </div>

        {/* Right: Activity Feed */}
        <div>
          <h2 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
            Atividade
          </h2>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-[var(--space-3)]">
            <DemandActivityFeed logs={demand.logs} />
          </div>

          {/* Metadata */}
          <div className="mt-[var(--space-4)] space-y-[var(--space-2)] text-[10px] text-[var(--color-text-muted)]">
            {demand.module && (
              <div className="flex justify-between">
                <span>Modulo</span>
                <span className="text-[var(--color-text-secondary)]">{demand.module}</span>
              </div>
            )}
            {demand.priority && (
              <div className="flex justify-between">
                <span>Prioridade</span>
                <span className="text-[var(--color-text-secondary)]">{demand.priority}</span>
              </div>
            )}
            {demand.deadline && (
              <div className="flex justify-between">
                <span>Prazo</span>
                <span className="text-[var(--color-text-secondary)]">
                  {new Date(demand.deadline).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Criada em</span>
              <span className="text-[var(--color-text-secondary)]">
                {new Date(demand.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Origem</span>
              <span className="text-[var(--color-text-secondary)]">{demand.origin}</span>
            </div>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
