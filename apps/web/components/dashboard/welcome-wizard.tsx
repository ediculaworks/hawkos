'use client';

import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

const WIZARD_KEY = 'hawk-wizard-completed';

const STEPS = [
  {
    title: 'Bem-vindo ao Hawk OS',
    description: 'Seu sistema operacional de vida pessoal. Vamos configurar o essencial.',
    icon: '🦅',
  },
  {
    title: 'Widgets',
    description:
      'O dashboard e personalizavel. Clique em "+" para adicionar widgets e arraste para reorganizar.',
    icon: '📊',
  },
  {
    title: 'Agente AI',
    description:
      'Converse com o agente via Discord ou pelo chat integrado. Ele aprende com suas interacoes.',
    icon: '🤖',
  },
  {
    title: 'Atalhos',
    description:
      'Use Cmd+K para abrir a paleta de comandos. "g" seguido de uma letra navega entre modulos.',
    icon: '⌨️',
  },
  {
    title: 'Pronto!',
    description: 'Explore os modulos na sidebar. Comece pelo que faz mais sentido para voce.',
    icon: '✅',
  },
];

export function WelcomeWizard() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(WIZARD_KEY)) {
      setVisible(true);
    }
  }, []);

  function complete() {
    localStorage.setItem(WIZARD_KEY, '1');
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      complete();
    }
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];
  if (!current) return null;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-white/[0.06] bg-[var(--color-surface-1)] p-8 shadow-2xl">
        {/* Icon */}
        <div className="mb-6 text-center">
          <span className="text-5xl">{current.icon}</span>
        </div>

        {/* Content */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Step dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1.5 rounded-full transition-all duration-[var(--duration-base)] ${
                i === step ? 'w-6 bg-[var(--color-accent)]' : 'w-1.5 bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={complete}>
            Pular
          </Button>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                Voltar
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? 'Comecar' : 'Proximo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
