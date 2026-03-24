'use client';

import { getModuleConfig } from '@/lib/modules';
import { useLayoutStore } from '@/lib/stores/layout-store';
import { listWidgetsByModule } from '@/lib/widgets/registry';
import { X } from 'lucide-react';

type WidgetPickerProps = {
  onClose: () => void;
};

export function WidgetPicker({ onClose }: WidgetPickerProps) {
  const addWidget = useLayoutStore((s) => s.addWidget);
  const grouped = listWidgetsByModule();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex items-center justify-between px-[var(--space-5)] py-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Adicionar widget
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Widget list */}
        <div className="max-h-[60vh] overflow-auto p-[var(--space-4)] space-y-[var(--space-5)]">
          {Object.entries(grouped).map(([moduleId, entries]) => {
            const mod = getModuleConfig(moduleId as Parameters<typeof getModuleConfig>[0]);
            if (!mod) return null;

            return (
              <div key={moduleId}>
                <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                  <mod.icon className="h-3.5 w-3.5" style={{ color: mod.colorVar }} />
                  <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    {mod.label}
                  </span>
                </div>
                <div className="space-y-[var(--space-1)]">
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        addWidget(entry.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                    >
                      <entry.icon
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: mod.colorVar }}
                      />
                      {entry.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
