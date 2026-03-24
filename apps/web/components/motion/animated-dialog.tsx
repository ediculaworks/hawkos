'use client';

import { dialogVariants, overlayVariants } from '@/lib/animations/variants';
import { AnimatePresence, motion } from 'motion/react';

export function AnimatedDialog({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            variants={dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={className}
            role="dialog"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
