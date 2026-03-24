'use client';

import { quickSaveUrl } from '@/lib/actions/knowledge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

const URL_PATTERN = /^https?:\/\/.+/i;

function isUrl(value: string): boolean {
  return URL_PATTERN.test(value.trim());
}

export function QuickSaveBar() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = value.trim();
      // Separate #tags and note text from the URL portion
      const urlMatch = trimmed.match(/^(https?:\/\/\S+)(.*)?$/i);
      if (urlMatch) {
        const url = urlMatch[1] ?? trimmed;
        const rest = (urlMatch[2] ?? '').trim();
        return quickSaveUrl(url, rest || undefined);
      }
      return quickSaveUrl(trimmed);
    },
    onSuccess: () => {
      setValue('');
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'unread'] });
      setTimeout(() => setSaved(false), 2000);
      inputRef.current?.focus();
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Erro ao salvar');
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      mutation.mutate();
    }
  };

  const looksLikeUrl = isUrl(value);
  const canSave = value.trim().length > 0 && !mutation.isPending;

  return (
    <div className="w-full">
      <div className="flex items-center gap-0 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] transition-colors focus-within:border-[var(--color-accent)]">
        {/* Prefix icon */}
        <span className="flex items-center pl-[var(--space-3)] pr-[var(--space-1-5)] text-[var(--color-text-muted)]">
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" />
          ) : looksLikeUrl ? (
            <Link2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          ) : (
            <span className="text-[11px] font-mono select-none opacity-40">#</span>
          )}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Cole uma URL para salvar..."
          disabled={mutation.isPending}
          className="flex-1 bg-transparent py-[var(--space-2)] pr-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50"
        />

        {/* Inline feedback */}
        {saved && (
          <span className="pr-[var(--space-2)] text-xs font-medium text-[var(--color-success)]">
            Salvo!
          </span>
        )}

        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canSave}
          className="m-[var(--space-1)] rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-[var(--space-3)] py-[var(--space-1)] text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Salvar
        </button>
      </div>

      {error && (
        <p className="mt-[var(--space-1)] text-[11px] text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}
