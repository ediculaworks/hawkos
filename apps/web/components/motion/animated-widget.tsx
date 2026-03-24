'use client';

import { DURATION, EASE } from '@/lib/animations/constants';
import { useReducedMotion } from '@/lib/animations/use-reduced-motion';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';

export function AnimatedWidget({
  children,
  index = 0,
}: { children: React.ReactNode; index?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const reduced = useReducedMotion();

  if (reduced)
    return (
      <div ref={ref} className="h-full">
        {children}
      </div>
    );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={
        inView
          ? {
              opacity: 1,
              scale: 1,
              transition: { duration: DURATION.normal, ease: EASE.outQuart, delay: index * 0.05 },
            }
          : { opacity: 0, scale: 0.96 }
      }
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
