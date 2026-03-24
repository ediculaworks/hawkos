'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface Step0WelcomeProps {
  onNext: (data: { workspaceLabel?: string }) => void;
}

export function Step0Slot({ onNext }: Step0WelcomeProps) {
  const [workspaceLabel, setWorkspaceLabel] = useState('');

  return (
    <div className="space-y-8 text-center py-4">
      <div className="space-y-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-4xl">
          🦅
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Bem-vindo ao Hawk OS
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-xs mx-auto leading-relaxed">
          Seu sistema operacional de vida pessoal. Configure uma vez, use para sempre.
        </p>
      </div>

      <div className="max-w-xs mx-auto space-y-2 text-left">
        <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
          Nome do workspace{' '}
          <span className="text-[var(--color-text-muted)] font-normal">(opcional)</span>
        </label>
        <Input
          placeholder="ex: Lucas OS, Meu Sistema..."
          value={workspaceLabel}
          onChange={(e) => setWorkspaceLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onNext({ workspaceLabel: workspaceLabel.trim() || undefined });
          }}
        />
        <p className="text-xs text-[var(--color-text-muted)]">
          Como você quer chamar seu workspace?
        </p>
      </div>

      <Button
        onClick={() => onNext({ workspaceLabel: workspaceLabel.trim() || undefined })}
        className="w-full max-w-xs"
      >
        Começar →
      </Button>
    </div>
  );
}
