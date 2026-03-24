'use client';

import type { DemandArtifact } from '@hawk/module-demands/types';
import { Brain, Database, File, FileText, ListTodo, StickyNote } from 'lucide-react';

const ARTIFACT_ICONS: Record<string, typeof FileText> = {
  text: FileText,
  data: Database,
  file: File,
  task: ListTodo,
  memory: Brain,
  note: StickyNote,
};

type Props = {
  artifacts: DemandArtifact[];
};

export function DemandArtifacts({ artifacts }: Props) {
  if (artifacts.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] py-[var(--space-3)] text-center">
        Nenhum artefato produzido
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-[var(--space-2)]">
      {artifacts.map((artifact) => {
        const Icon = ARTIFACT_ICONS[artifact.artifact_type] ?? FileText;

        return (
          <div
            key={artifact.id}
            className="flex items-start gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-surface-0)] border border-[var(--color-border-subtle)]"
          >
            <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                {artifact.title}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{artifact.artifact_type}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
