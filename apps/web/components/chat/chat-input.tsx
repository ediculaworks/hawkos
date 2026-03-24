'use client';

import { Paperclip, SendHorizontal, Square } from 'lucide-react';
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  loading?: boolean;
}

export function ChatInput({ onSend, loading }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resize on value change
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`; // max ~6 rows
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, loading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !loading;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="flex items-end gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]/30 transition-all">
        <button
          type="button"
          className="flex-shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer"
          title="Anexar arquivo"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none min-h-[24px] max-h-[160px] py-0.5"
        />
        <button
          type="button"
          onClick={loading ? undefined : handleSend}
          disabled={!canSend && !loading}
          className={`flex-shrink-0 p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
            loading
              ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
              : canSend
                ? 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
                : 'text-[var(--color-text-muted)] cursor-not-allowed'
          }`}
          title={loading ? 'Parar' : 'Enviar'}
        >
          {loading ? <Square className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex justify-center mt-1.5">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Enter para enviar · Shift+Enter para nova linha
        </span>
      </div>
    </div>
  );
}
