'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addReflection } from '@/lib/actions/spirituality';
import type { ReflectionType } from '@hawk/module-spirituality/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';

const TYPE_OPTIONS: { value: ReflectionType; label: string }[] = [
  { value: 'reflection', label: 'Reflexão' },
  { value: 'gratitude', label: 'Gratidão' },
  { value: 'intention', label: 'Intenção' },
  { value: 'values', label: 'Valores' },
  { value: 'mantra', label: 'Mantra' },
];

export function ReflectionForm() {
  const [content, setContent] = useState('');
  const [type, setType] = useState<ReflectionType>('reflection');
  const [mood, setMood] = useState(7);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addReflection({ content, type, mood }),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['spirituality'] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Nova Reflexão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-[var(--space-3)]">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que está em sua mente hoje?"
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none"
        />
        <div className="flex items-center gap-[var(--space-4)]">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[var(--color-text-muted)]">Humor</span>
              <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                {mood}/10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="w-full h-1 accent-[var(--color-accent)] cursor-pointer"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReflectionType)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!content.trim() || mutation.isPending}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
