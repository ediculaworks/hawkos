import type { Variants } from 'motion/react';
import { DURATION, EASE } from './constants';

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE.outQuart },
  },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE.outQuart },
  },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.normal, ease: EASE.outQuart },
  },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.normal, ease: EASE.outQuart },
  },
};

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE.outQuint },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: DURATION.normal, ease: EASE.inOut },
  },
};
