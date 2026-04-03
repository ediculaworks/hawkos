'use client';

import ShinyText from '@/components/react-bits/text/shiny-text';
import { EASE } from '@/lib/animations/constants';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

const STATUS_MESSAGES = ['Carregando modulos...', 'Conectando...', 'Pronto'];

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStatusIndex(1), 500),
      setTimeout(() => setStatusIndex(2), 1000),
      setTimeout(() => onComplete(), 1400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      key="splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3, ease: EASE.outQuart }}
      className="flex flex-col items-center justify-center gap-8"
    >
      {/* Logo */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.outQuart }}
        className="text-4xl font-bold tracking-tight"
      >
        <ShinyText
          text="Hawk OS"
          speed={2}
          color="var(--color-text-primary)"
          shineColor="var(--color-accent)"
        />
      </motion.h1>

      {/* Progress bar */}
      <div className="w-48 space-y-3">
        <div className="h-[2px] w-full rounded-full bg-[var(--color-surface-3)] overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.2, ease: EASE.inOut }}
            className="h-full rounded-full bg-[var(--color-accent)]"
          />
        </div>

        {/* Status text */}
        <motion.p
          key={statusIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="text-xs text-center text-[var(--color-text-muted)]"
        >
          {STATUS_MESSAGES[statusIndex]}
        </motion.p>
      </div>
    </motion.div>
  );
}
