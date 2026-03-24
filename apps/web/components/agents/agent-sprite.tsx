'use client';

import { useEffect, useRef, useState } from 'react';

interface AgentSpriteProps {
  folder: string;
  size?: number;
  speed?: number; // ms per frame, default 400
  className?: string;
}

const FRAME_COUNT = 8;

export function AgentSprite({ folder, size = 120, speed = 400, className }: AgentSpriteProps) {
  const [frame, setFrame] = useState(0);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Preload all 8 frames
  useEffect(() => {
    let mounted = true;
    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `/sprites/${folder}/${i}.png`;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT && mounted) {
          setLoaded(true);
        }
      };
      images.push(img);
    }

    imagesRef.current = images;
    return () => {
      mounted = false;
    };
  }, [folder]);

  // Cycle frames
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAME_COUNT);
    }, speed);
    return () => clearInterval(interval);
  }, [loaded, speed]);

  if (!loaded) {
    return (
      <div
        className={`animate-pulse rounded-lg bg-[var(--color-surface-2)] ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={`/sprites/${folder}/${frame + 1}.png`}
      alt="Agent sprite"
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: 'pixelated' }}
      draggable={false}
    />
  );
}
