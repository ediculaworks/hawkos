'use client';

import { type EntitySearchResult, searchEntities } from '@/lib/actions/search';
import { cn } from '@/lib/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, BookOpen, Brain, Target, User, Wallet } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

const TYPE_CONFIG: Record<string, { icon: typeof User; color: string; label: string }> = {
  person: { icon: User, color: 'var(--color-mod-people)', label: 'Pessoas' },
  objective: { icon: Target, color: 'var(--color-mod-objectives)', label: 'Metas' },
  task: { icon: Brain, color: 'var(--color-mod-objectives)', label: 'Tarefas' },
  account: { icon: Wallet, color: 'var(--color-mod-finances)', label: 'Contas' },
  note: { icon: BookOpen, color: 'var(--color-mod-knowledge)', label: 'Notas' },
  book: { icon: BookMarked, color: 'var(--color-mod-knowledge)', label: 'Livros' },
  memory: { icon: Brain, color: 'var(--color-accent)', label: 'Memórias' },
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export function MentionInput({ value, onChange, placeholder, rows = 3, className }: Props) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ['mention-search', mentionQuery],
    queryFn: () => searchEntities(mentionQuery ?? ''),
    enabled: !!mentionQuery && mentionQuery.length >= 2,
    staleTime: 10_000,
  });

  const handleInput = useCallback(
    (newValue: string) => {
      onChange(newValue);

      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = textarea.selectionStart;
      setCursorPos(pos);

      // Detect @ trigger
      const textBefore = newValue.slice(0, pos);
      const atMatch = textBefore.match(/@(\w*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1] ?? '');
        setSelectedIdx(0);
      } else {
        setMentionQuery(null);
      }
    },
    [onChange],
  );

  const insertMention = useCallback(
    (entity: EntitySearchResult) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const textBefore = value.slice(0, cursorPos);
      const textAfter = value.slice(cursorPos);
      const atIdx = textBefore.lastIndexOf('@');
      if (atIdx === -1) return;

      const mention = `@[${entity.type}:${entity.label}](${entity.id})`;
      const newValue = `${textBefore.slice(0, atIdx) + mention} ${textAfter}`;
      onChange(newValue);
      setMentionQuery(null);

      // Restore focus
      requestAnimationFrame(() => {
        const newPos = atIdx + mention.length + 1;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      });
    },
    [value, cursorPos, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionQuery || !results || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      insertMention(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isOpen = mentionQuery !== null && results && results.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]',
          className,
        )}
      />

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[var(--shadow-lg)] max-h-48 overflow-auto py-1"
        >
          {results.map((entity, idx) => {
            const config = TYPE_CONFIG[entity.type];
            const Icon = config?.icon ?? User;
            return (
              <button
                key={`${entity.type}-${entity.id}`}
                type="button"
                onClick={() => insertMention(entity)}
                className={cn(
                  'flex w-full items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-1-5)] text-left transition-colors cursor-pointer',
                  idx === selectedIdx
                    ? 'bg-[var(--color-surface-3)]'
                    : 'hover:bg-[var(--color-surface-3)]/50',
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: config?.color }} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-[var(--color-text-primary)] truncate block">
                    {entity.label}
                  </span>
                  {entity.sublabel && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {entity.sublabel}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
                  {config?.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
