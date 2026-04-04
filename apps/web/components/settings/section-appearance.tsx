'use client';

import { ReactBitsGuard } from '@/components/react-bits/_adapter';
import SpotlightCard from '@/components/react-bits/components/spotlight-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLayoutStore } from '@/lib/stores/layout-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { Download, Palette, Upload } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ThemeOption {
  id: string;
  label: string;
  colors: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
  available: boolean;
}

const THEMES: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    colors: {
      bg: 'oklch(0.13 0.012 260)',
      surface: 'oklch(0.17 0.012 260)',
      accent: 'oklch(0.65 0.19 260)',
      text: 'oklch(0.9 0.005 260)',
    },
    available: true,
  },
  {
    id: 'light',
    label: 'Light',
    colors: {
      bg: 'oklch(0.97 0.005 260)',
      surface: 'oklch(0.94 0.006 260)',
      accent: 'oklch(0.55 0.19 260)',
      text: 'oklch(0.2 0.012 260)',
    },
    available: true,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    colors: {
      bg: 'oklch(0.10 0.03 270)',
      surface: 'oklch(0.15 0.04 270)',
      accent: 'oklch(0.65 0.22 270)',
      text: 'oklch(0.85 0.02 260)',
    },
    available: false,
  },
  {
    id: 'nord',
    label: 'Nord',
    colors: {
      bg: 'oklch(0.22 0.02 230)',
      surface: 'oklch(0.27 0.02 230)',
      accent: 'oklch(0.72 0.12 200)',
      text: 'oklch(0.90 0.01 220)',
    },
    available: false,
  },
  {
    id: 'rose',
    label: 'Rose',
    colors: {
      bg: 'oklch(0.14 0.02 350)',
      surface: 'oklch(0.19 0.03 350)',
      accent: 'oklch(0.68 0.18 350)',
      text: 'oklch(0.90 0.01 350)',
    },
    available: false,
  },
  {
    id: 'emerald',
    label: 'Emerald',
    colors: {
      bg: 'oklch(0.13 0.02 160)',
      surface: 'oklch(0.18 0.03 160)',
      accent: 'oklch(0.70 0.17 160)',
      text: 'oklch(0.90 0.01 160)',
    },
    available: false,
  },
];

export function SectionAppearance() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const widgets = useLayoutStore((s) => s.widgets);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-[var(--space-8)]">
      <div>
        <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
          <Palette className="h-5 w-5 text-[var(--color-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Aparencia</h2>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Personalize a interface do dashboard.
        </p>
      </div>

      <div className="space-y-[var(--space-6)] max-w-2xl">
        {/* Theme Grid */}
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-3)]">
            Tema
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--space-3)]">
            {THEMES.map((t) => {
              const isActive = theme === t.id;
              const card = (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => t.available && setTheme(t.id as 'dark' | 'light')}
                  disabled={!t.available}
                  className={`relative group rounded-[var(--radius-lg)] border-2 transition-all duration-200 overflow-hidden ${
                    isActive
                      ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                      : t.available
                        ? 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] cursor-pointer'
                        : 'border-[var(--color-border)]/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {/* Theme preview */}
                  <div
                    className="p-[var(--space-3)]"
                    style={{ backgroundColor: t.colors.bg }}
                  >
                    {/* Mini mockup */}
                    <div className="flex gap-1.5 mb-2">
                      <div
                        className="w-6 h-full rounded-sm"
                        style={{ backgroundColor: t.colors.surface, minHeight: 32 }}
                      />
                      <div className="flex-1 space-y-1.5">
                        <div
                          className="h-2.5 rounded-sm w-3/4"
                          style={{ backgroundColor: t.colors.surface }}
                        />
                        <div
                          className="h-2 rounded-sm w-1/2"
                          style={{ backgroundColor: t.colors.accent, opacity: 0.7 }}
                        />
                        <div className="flex gap-1">
                          <div
                            className="h-5 flex-1 rounded-sm"
                            style={{ backgroundColor: t.colors.surface }}
                          />
                          <div
                            className="h-5 flex-1 rounded-sm"
                            style={{ backgroundColor: t.colors.surface }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Label */}
                  <div
                    className="px-[var(--space-3)] py-[var(--space-2)] text-center"
                    style={{ backgroundColor: t.colors.surface }}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{ color: t.colors.text }}
                    >
                      {t.label}
                    </span>
                    {!t.available && (
                      <span
                        className="block text-[9px] mt-0.5"
                        style={{ color: t.colors.text, opacity: 0.5 }}
                      >
                        Em breve
                      </span>
                    )}
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        className="text-white"
                      >
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );

              // Wrap available themes in SpotlightCard
              if (t.available) {
                return (
                  <ReactBitsGuard key={t.id} fallback={card}>
                    <SpotlightCard
                      spotlightColor="var(--color-accent)"
                      className="rounded-[var(--radius-lg)]"
                    >
                      {card}
                    </SpotlightCard>
                  </ReactBitsGuard>
                );
              }

              return card;
            })}
          </div>
        </div>

        {/* Layout options */}
        <div className="space-y-[var(--space-4)] max-w-lg">
          <div className="p-[var(--space-4)] rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-4)]">
              Layout
            </h3>
            <div className="flex items-center justify-between mb-[var(--space-4)]">
              <div>
                <Label>Sidebar colapsada</Label>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Manter a sidebar recolhida por padrao
                </p>
              </div>
              <Switch checked={sidebarCollapsed} onCheckedChange={setSidebarCollapsed} />
            </div>

            <div className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
              <h4 className="text-xs font-medium text-[var(--color-text-secondary)] mb-[var(--space-3)]">
                Layout do Dashboard
              </h4>
              <div className="flex gap-[var(--space-2)]">
                <Button variant="outline" size="sm" onClick={handleExportLayout}>
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportLayout}>
                  <Upload className="h-3.5 w-3.5" />
                  Importar
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
      </div>
    </div>
  );
}
