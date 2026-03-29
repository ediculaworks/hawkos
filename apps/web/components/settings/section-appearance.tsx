'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLayoutStore } from '@/lib/stores/layout-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { Download, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function SectionAppearance() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const widgets = useLayoutStore((s) => s.widgets);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme on mount (hydration)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function handleExportLayout() {
    const json = JSON.stringify(widgets, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hawk-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportLayout() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error('Invalid layout format');
        useLayoutStore.getState().updateLayout(parsed);
      } catch {
        console.error('[layout-import] Invalid layout file');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported if needed
    e.target.value = '';
  }

  const themes = [
    {
      id: 'dark' as const,
      label: 'Dark',
      preview: 'bg-[oklch(0.13_0.012_260)]',
    },
    {
      id: 'light' as const,
      label: 'Light',
      preview: 'bg-[oklch(0.94_0.006_260)]',
    },
  ];

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
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`p-[var(--space-3)] rounded-[var(--radius-lg)] border-2 bg-[var(--color-surface-1)] text-center transition-all duration-150 ${
                  theme === t.id
                    ? 'border-[var(--color-accent)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                <div
                  className={`w-full h-8 rounded-[var(--radius-md)] ${t.preview} mb-[var(--space-2)]`}
                />
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  {t.label}
                </span>
              </button>
            ))}
            {/* Auto — disabled for now */}
            <button
              type="button"
              className="p-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] text-center opacity-40 cursor-not-allowed"
              disabled
            >
              <div className="w-full h-8 rounded-[var(--radius-md)] bg-gradient-to-r from-gray-800 to-gray-200 mb-[var(--space-2)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Auto</span>
            </button>
          </div>
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

        {/* Layout Export/Import */}
        <div className="border-t border-[var(--color-border)] pt-[var(--space-5)]">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
            Layout do Dashboard
          </h3>
          <div className="flex gap-[var(--space-2)]">
            <Button variant="outline" size="sm" onClick={handleExportLayout}>
              <Download className="h-3.5 w-3.5" />
              Exportar layout
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportLayout}>
              <Upload className="h-3.5 w-3.5" />
              Importar layout
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}
