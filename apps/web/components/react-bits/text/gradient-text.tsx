'use client';

import { motion, useAnimationFrame, useMotionValue, useTransform } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  pauseOnHover?: boolean;
  yoyo?: boolean;
}

export default function GradientText({
  children,
  className = '',
  colors = ['var(--color-accent)', 'var(--color-mod-finances)', 'var(--color-accent)'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animationDuration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      if (cycleTime < animationDuration) {
        progress.set((cycleTime / animationDuration) * 100);
      } else {
        progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
      }
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset animation on config change
  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, yoyo]);

  const backgroundPosition = useTransform(progress, (p) => {
    if (direction === 'horizontal') return `${p}% 50%`;
    if (direction === 'vertical') return `50% ${p}%`;
    return `${p}% 50%`;
  });

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const gradientAngle =
    direction === 'horizontal'
      ? 'to right'
      : direction === 'vertical'
        ? 'to bottom'
        : 'to bottom right';
  const gradientColors = [...colors, colors[0]].join(', ');
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize:
      direction === 'horizontal'
        ? '300% 100%'
        : direction === 'vertical'
          ? '100% 300%'
          : '300% 300%',
    backgroundRepeat: 'repeat' as const,
  };

  return (
    <motion.span
      className={`inline-block relative ${showBorder ? 'py-1 px-2' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBorder && (
        <motion.span
          className="absolute inset-0 z-0 pointer-events-none rounded-[var(--radius-md)]"
          style={{ ...gradientStyle, backgroundPosition }}
        >
          <span
            className="absolute bg-[var(--color-surface-0)] rounded-[var(--radius-md)] z-[-1]"
            style={{
              width: 'calc(100% - 2px)',
              height: 'calc(100% - 2px)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </motion.span>
      )}
      <motion.span
        className="inline-block relative z-[2] text-transparent bg-clip-text"
        style={{
          ...gradientStyle,
          backgroundPosition,
          WebkitBackgroundClip: 'text',
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
