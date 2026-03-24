'use client';

import { useReducedMotion } from '@/lib/animations/use-reduced-motion';
import { pageVariants } from '@/lib/animations/variants';
import { motion } from 'motion/react';

export function AnimatedPage({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className={className}>
      {children}
    </motion.div>
  );
}
