'use client';

import { useReducedMotion } from '@/lib/animations/use-reduced-motion';
import { staggerContainer, staggerItem } from '@/lib/animations/variants';
import { motion } from 'motion/react';

export function AnimatedList({
  children,
  className,
  staggerDelay,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  const container = staggerDelay
    ? {
        ...staggerContainer,
        animate: { transition: { staggerChildren: staggerDelay, delayChildren: 0.06 } },
      }
    : staggerContainer;

  return (
    <motion.div variants={container} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}

export function AnimatedItem({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}
