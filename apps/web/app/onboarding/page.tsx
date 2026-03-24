'use client';

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { EASE } from '@/lib/animations/constants';
import { motion } from 'motion/react';

export default function OnboardingPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-surface-0)] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full opacity-10"
          style={{
            background: 'var(--color-accent)',
            filter: 'blur(120px)',
            animation: 'blob-float-1 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/2 right-1/4 h-[350px] w-[350px] rounded-full opacity-10"
          style={{
            background: 'var(--color-mod-finances)',
            filter: 'blur(120px)',
            animation: 'blob-float-2 10s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full opacity-10"
          style={{
            background: 'var(--color-mod-people)',
            filter: 'blur(120px)',
            animation: 'blob-float-3 12s ease-in-out infinite',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.outQuart }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="rounded-[var(--radius-xl)] border border-white/[0.06] bg-[var(--color-surface-1)]/60 p-8 shadow-lg backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Hawk OS
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Configure seu workspace</p>
          </div>

          <OnboardingWizard slots={[]} />
        </div>

        <p className="mt-4 text-center text-[10px] text-[var(--color-text-muted)]">
          hawk-os • {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
