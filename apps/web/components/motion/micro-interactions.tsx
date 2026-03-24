'use client';

import { EASE } from '@/lib/animations/constants';
import { motion } from 'motion/react';

/** Pops on completion (wrap checkbox/button) */
export function CheckPop({
  completed,
  children,
}: { completed: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={completed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
      transition={{ duration: 0.25, ease: EASE.outQuart }}
    >
      {children}
    </motion.div>
  );
}

/** Shrinks out on delete — must be inside AnimatePresence */
export function DeletableItem({
  id,
  children,
  className,
}: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      key={id}
      layout
      initial={{ opacity: 1, height: 'auto' }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        overflow: 'hidden',
      }}
      transition={{ duration: 0.2, ease: EASE.inOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Slides in newly added items */
export function AddSlideIn({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      transition={{ duration: 0.25, ease: EASE.outQuart }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
