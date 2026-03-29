'use client';
import { type PaletteCommand, useCommandPalette } from '@/hooks/use-command-palette';
import { useUIStore } from '@/lib/stores/ui-store';
import { cn } from '@/lib/utils/cn';
import { Command, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

function HelpOverlay({ close }: { close: () => void }) {
  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'Abrir paleta de comandos' },
    { keys: ['⌘', '/'], description: 'Alternar barra lateral' },
    { keys: ['?'], description: 'Mostrar atalhos' },
    { keys: ['↑', '↓'], description: 'Navegar' },
    { keys: ['Enter'], description: 'Selecionar' },
    { keys: ['Esc'], description: 'Fechar' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-[var(--space-4)] py-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-2)]">
            <Command className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Atalhos de teclado
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar atalhos de teclado"
            className="p-[var(--space-1)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-[var(--space-4)] space-y-[var(--space-2)]">
          {shortcuts.map((s) => (
            <div key={s.description} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{s.description}</span>
              <div className="flex items-center gap-[var(--space-1)]">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-2)] py-[var(--space-0-5)] text-[11px] text-[var(--color-text-primary)] font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Command row ─────────────────────────────────────────────────────────────

function CommandRow({
  cmd,
  isActive,
  onActivate,
}: {
  cmd: PaletteCommand;
  isActive: boolean;
  onActivate: () => void;
}) {
  const Icon = cmd.icon;
  return (
    <button
      type="button"
      data-active={isActive}
      onClick={cmd.action}
      onMouseEnter={onActivate}
      role="option"
      aria-selected={isActive}
      className={cn(
        'w-full flex items-center gap-[var(--space-3)]',
        'px-[var(--space-4)] py-[var(--space-2)]',
        'text-left text-sm group cursor-pointer',
        'transition-colors duration-[var(--duration-fast)]',
        isActive
          ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)]',
          'transition-colors duration-[var(--duration-fast)]',
          isActive ? 'bg-[var(--color-surface-4)]' : 'bg-[var(--color-surface-2)]',
        )}
      >
        <Icon className="h-[14px] w-[14px]" style={{ color: cmd.iconColor }} />
      </span>
      <span className="flex-1 truncate">{cmd.label}</span>
      {cmd.shortcut ? (
        <kbd
          className={cn(
            'text-[10px] font-mono shrink-0',
            'border border-[var(--color-border)] rounded-[var(--radius-sm)]',
            'px-[var(--space-1-5)] py-[var(--space-0-5)]',
            'transition-opacity duration-[var(--duration-fast)]',
            isActive
              ? 'text-[var(--color-text-secondary)] opacity-100'
              : 'text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100',
          )}
        >
          {cmd.shortcut}
        </kbd>
      ) : (
        <span
          className={cn(
            'text-[10px] font-mono shrink-0',
            'border border-[var(--color-border)] rounded-[var(--radius-sm)]',
            'px-[var(--space-1-5)] py-[var(--space-0-5)]',
            'text-[var(--color-text-muted)]',
            'transition-opacity duration-[var(--duration-fast)]',
            isActive ? 'opacity-100' : 'opacity-0',
          )}
        >
          ↵
        </span>
      )}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function CommandPalette() {
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const {
    showHelp,
    query,
    selectedIndex,
    filteredCommands,
    close,
    closeHelp,
    setQuery,
    execute,
    moveSelection,
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when palette opens
  useEffect(() => {
    if (commandPaletteOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 16);
      return () => clearTimeout(id);
    }
  }, [commandPaletteOpen]);

  // Scroll active item into view on keyboard nav
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only on selectedIndex change
  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [selectedIndex]);

  if (showHelp) return <HelpOverlay close={closeHelp} />;
  if (!commandPaletteOpen) return null;

  // Group by category (insertion-ordered)
  const grouped = new Map<string, PaletteCommand[]>();
  for (const cmd of filteredCommands) {
    if (!grouped.has(cmd.category)) grouped.set(cmd.category, []);
    grouped.get(cmd.category)?.push(cmd);
  }
  const groupEntries = Array.from(grouped.entries());

  // Mutable cursor: maps flat selectedIndex back to grouped rows
  let cursor = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: 'clamp(72px, 12vh, 140px)' }}
    >
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled by input */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className={cn(
          'relative z-10 w-full max-w-[560px] mx-[var(--space-4)]',
          'rounded-[var(--radius-lg)] border border-[var(--color-border)]',
          'bg-[var(--color-surface-1)]',
          'shadow-[0_24px_64px_oklch(0_0_0/0.5),0_4px_16px_oklch(0_0_0/0.3)]',
          'flex flex-col overflow-hidden',
        )}
        style={{ maxHeight: 'min(580px, 80vh)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-[var(--space-3)] px-[var(--space-4)] border-b border-[var(--color-border-subtle)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar módulo, página ou ação..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSelection(1);
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSelection(-1);
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                execute();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
            className="flex-1 py-[var(--space-4)] bg-transparent outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
          <kbd className="hidden sm:block shrink-0 text-[10px] font-mono text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-[var(--space-1-5)] py-[var(--space-0-5)]">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto overscroll-contain py-[var(--space-1-5)]"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}
          role="listbox"
          tabIndex={-1}
          aria-label="Comandos disponíveis"
        >
          {filteredCommands.length === 0 ? (
            <div className="flex flex-col items-center gap-[var(--space-2)] py-[var(--space-10)] text-center">
              <Command className="h-8 w-8 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                Nenhum resultado para{' '}
                <span className="text-[var(--color-text-secondary)]">"{query}"</span>
              </p>
            </div>
          ) : (
            groupEntries.map(([category, cmds], groupIdx) => (
              <div key={category}>
                <div className="px-[var(--space-4)] pt-[var(--space-2)] pb-[var(--space-1)]">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                    {category}
                  </span>
                </div>
                {cmds.map((cmd) => {
                  const idx = cursor++;
                  return (
                    <CommandRow
                      key={cmd.id}
                      cmd={cmd}
                      isActive={selectedIndex === idx}
                      onActivate={() => {
                        const delta = idx - selectedIndex;
                        if (delta !== 0) moveSelection(delta);
                      }}
                    />
                  );
                })}
                {groupIdx < groupEntries.length - 1 && (
                  <div className="mx-[var(--space-4)] mt-[var(--space-2)] mb-[var(--space-0-5)] border-t border-[var(--color-border-subtle)]" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-2)] border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]/60">
          <div className="flex items-center gap-[var(--space-4)]">
            {[
              { keys: ['↑', '↓'], label: 'navegar' },
              { keys: ['↵'], label: 'abrir' },
              { keys: ['Esc'], label: 'fechar' },
            ].map(({ keys, label }) => (
              <span key={label} className="flex items-center gap-[var(--space-1)]">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="text-[10px] font-mono text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-[var(--space-1)] py-px leading-none"
                  >
                    {k}
                  </kbd>
                ))}
                <span className="text-[10px] text-[var(--color-text-muted)]">{label}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-[var(--space-1)]">
            <Command className="h-3 w-3 text-[var(--color-text-muted)]" />
            <span className="text-[10px] text-[var(--color-text-muted)]">Hawk OS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
