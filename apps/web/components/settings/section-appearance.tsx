'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUIStore } from '@/lib/stores/ui-store';

export function SectionAppearance() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Aparência</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-[var(--space-1)]">
          Personalize a interface do dashboard.
        </p>
      </div>

      <div className="space-y-[var(--space-6)] max-w-lg">
        {/* Theme */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-3)]">
            Tema
          </h3>
          <div className="grid grid-cols-3 gap-[var(--space-3)]">
            <button
              type="button"
              className="p-[var(--space-3)] rounded-[var(--radius-lg)] border-2 border-[var(--color-accent)] bg-[var(--color-surface-1)] text-center cursor-default"
            >
              <div className="w-full h-8 rounded-[var(--radius-md)] bg-[oklch(0.13_0.012_260)] mb-[var(--space-2)]" />
              <span className="text-xs font-medium text-[var(--color-text-primary)]">Dark</span>
            </button>
            <button
              type="button"
              className="p-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-center opacity-40 cursor-not-allowed"
              disabled
            >
              <div className="w-full h-8 rounded-[var(--radius-md)] bg-gray-200 mb-[var(--space-2)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Light</span>
            </button>
            <button
              type="button"
              className="p-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-center opacity-40 cursor-not-allowed"
              disabled
            >
              <div className="w-full h-8 rounded-[var(--radius-md)] bg-gradient-to-r from-gray-800 to-gray-200 mb-[var(--space-2)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Auto</span>
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-[var(--space-2)]">
            Temas Light e Auto em breve.
          </p>
        </div>

        {/* Sidebar */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Layout
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <Label>Sidebar colapsada</Label>
              <p className="text-xs text-[var(--color-text-muted)]">
                Manter a sidebar recolhida por padrão
              </p>
            </div>
            <Switch checked={sidebarCollapsed} onCheckedChange={setSidebarCollapsed} />
          </div>
        </div>
      </div>
    </div>
  );
}
