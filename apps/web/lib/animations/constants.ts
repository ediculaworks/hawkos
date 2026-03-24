// Mirror CSS design tokens for motion library
export const DURATION = {
  fast: 0.12,
  normal: 0.2,
  slow: 0.35,
} as const;

export const EASE = {
  outQuart: [0.25, 1, 0.5, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  inOut: [0.45, 0, 0.55, 1] as const,
  spring: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 1 },
  springGentle: { type: 'spring' as const, stiffness: 300, damping: 25, mass: 1 },
};
