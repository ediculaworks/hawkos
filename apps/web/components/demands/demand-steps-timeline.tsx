'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { approveDemandStepAction } from '@/lib/actions/demands';
import type { DemandStep } from '@hawk/module-demands/types';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

const STATUS_ICONS: Record<string, { emoji: string; color: string }> = {
  pending: { emoji: '\u2B1C', color: 'var(--color-text-muted)' },
  ready: { emoji: '\u25B6\uFE0F', color: 'var(--color-accent)' },
  running: { emoji: '\uD83D\uDD04', color: 'var(--color-warning)' },
  waiting_human: { emoji: '\u23F3', color: 'var(--color-warning)' },
  completed: { emoji: '\u2705', color: 'var(--color-success)' },
  failed: { emoji: '\u274C', color: 'var(--color-danger)' },
  skipped: { emoji: '\u23ED\uFE0F', color: 'var(--color-text-muted)' },
  cancelled: { emoji: '\u26D4', color: 'var(--color-text-muted)' },
};

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'muted'> = {
  pending: 'muted',
  ready: 'default',
  running: 'warning',
  waiting_human: 'warning',
  completed: 'success',
  failed: 'danger',
  skipped: 'muted',
  cancelled: 'muted',
};

type Props = {
  steps: DemandStep[];
  demandId: string;
};

export function DemandStepsTimeline({ steps, demandId: _demandId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function handleApprove(stepId: string, approved: boolean) {
    await approveDemandStepAction(stepId, approved);
    queryClient.invalidateQueries({ queryKey: ['demands'] });
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const statusInfo = (STATUS_ICONS[step.status] ?? STATUS_ICONS.pending) as {
          emoji: string;
          color: string;
        };
        const isExpanded = expanded === step.id;

        return (
          <div key={step.id} className="flex gap-[var(--space-3)]">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 border"
                style={{
                  borderColor: statusInfo.color,
                  color: statusInfo.color,
                }}
              >
                {idx + 1}
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 min-h-[var(--space-4)]"
                  style={{
                    backgroundColor:
                      step.status === 'completed'
                        ? 'var(--color-success)'
                        : 'var(--color-border-subtle)',
                  }}
                />
              )}
            </div>

            {/* Step content */}
            <div className={`flex-1 pb-[var(--space-4)] ${isLast ? '' : ''}`}>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : step.id)}
                className="flex items-center gap-[var(--space-2)] w-full text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-[var(--color-text-muted)] shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-[var(--color-text-muted)] shrink-0" />
                )}
                <span className="text-sm text-[var(--color-text-primary)] flex-1">
                  {step.title}
                </span>
                <Badge variant={STATUS_BADGE[step.status] ?? 'muted'} className="text-[10px]">
                  {step.status.replace('_', ' ')}
                </Badge>
              </button>

              {isExpanded && (
                <div className="mt-[var(--space-2)] ml-5 space-y-[var(--space-2)]">
                  {step.description && (
                    <p className="text-xs text-[var(--color-text-muted)]">{step.description}</p>
                  )}

                  {step.result && (
                    <div className="text-xs bg-[var(--color-surface-0)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] p-[var(--space-2)] text-[var(--color-text-secondary)]">
                      <span className="font-medium">Resultado:</span>
                      <p className="mt-1 whitespace-pre-wrap">{step.result}</p>
                    </div>
                  )}

                  {step.error_message && (
                    <div className="text-xs bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-[var(--radius-md)] p-[var(--space-2)] text-[var(--color-danger)]">
                      {step.error_message}
                    </div>
                  )}

                  {step.status === 'waiting_human' && (
                    <div className="flex gap-[var(--space-2)]">
                      <Button size="sm" onClick={() => handleApprove(step.id, true)}>
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(step.id, false)}
                      >
                        <X className="h-3.5 w-3.5" /> Rejeitar
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-[var(--space-3)] text-[10px] text-[var(--color-text-muted)]">
                    {step.execution_type !== 'sequential' && (
                      <span className="bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded">
                        {step.execution_type}
                      </span>
                    )}
                    {step.tool_name && (
                      <span className="bg-[var(--color-surface-3)] px-1.5 py-0.5 rounded">
                        tool: {step.tool_name}
                      </span>
                    )}
                    {step.retry_count > 0 && (
                      <span>
                        Retries: {step.retry_count}/{step.max_retries}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
