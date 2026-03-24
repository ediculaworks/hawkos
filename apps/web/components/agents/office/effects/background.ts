import type { BackgroundTheme } from '../engine/types';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, ZOOM } from '../engine/types';

interface ThemeColors {
  skyTop: string;
  skyBot: string;
  midColor: string;
  groundColor: string;
}

const THEMES: Record<BackgroundTheme, ThemeColors> = {
  beach: { skyTop: '#87CEEB', skyBot: '#4A90C4', midColor: '#2266aa', groundColor: '#d4a574' },
  city: { skyTop: '#6B8FAD', skyBot: '#2C3E50', midColor: '#1a2030', groundColor: '#444444' },
  mountain: { skyTop: '#89CFF0', skyBot: '#5B86B5', midColor: '#4a6a3a', groundColor: '#3a5a2a' },
  night: { skyTop: '#0a0a2e', skyBot: '#1a1a3e', midColor: '#0a0a1e', groundColor: '#1a1a2a' },
};

/** Render the exterior background on the pre-render canvas */
export function renderBackground(ctx: CanvasRenderingContext2D, theme: BackgroundTheme): void {
  const z = ZOOM;
  const ts = TILE_SIZE;
  const w = GRID_COLS * ts * z;
  const h = GRID_ROWS * ts * z;
  const colors = THEMES[theme];

  // Sky gradient (rows 0-1 + left/right columns)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, colors.skyTop);
  skyGrad.addColorStop(0.3, colors.skyBot);
  skyGrad.addColorStop(0.6, colors.midColor);
  skyGrad.addColorStop(1, colors.groundColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // Theme-specific details
  switch (theme) {
    case 'beach':
      renderBeach(ctx, w, h, z);
      break;
    case 'city':
      renderCity(ctx, w, h, z);
      break;
    case 'mountain':
      renderMountain(ctx, w, h, z);
      break;
    case 'night':
      renderNight(ctx, w, h, z);
      break;
  }
}

function renderBeach(ctx: CanvasRenderingContext2D, w: number, h: number, z: number): void {
  // Clouds (top area)
  drawCloud(ctx, w * 0.15, 8 * z, 20 * z, z);
  drawCloud(ctx, w * 0.5, 5 * z, 25 * z, z);
  drawCloud(ctx, w * 0.8, 12 * z, 18 * z, z);

  // Ocean waves (bottom area, rows 20-24)
  const waveY = 20 * 16 * z;
  for (let i = 0; i < 6; i++) {
    const wy = waveY + i * 8 * z;
    ctx.fillStyle = `rgba(255,255,255,${0.08 - i * 0.01})`;
    ctx.beginPath();
    for (let x = 0; x < w; x += 4 * z) {
      const y = wy + Math.sin(x / (20 * z) + i * 0.5) * 3 * z;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, wy + 10 * z);
    ctx.lineTo(0, wy + 10 * z);
    ctx.fill();
  }

  // Sand (bottom rows)
  const sandY = 24 * 16 * z;
  ctx.fillStyle = '#d4a574';
  ctx.fillRect(0, sandY, w, h - sandY);

  // Sand texture
  for (let i = 0; i < 30; i++) {
    const sx = (i * 47 + 13) % w;
    const sy = sandY + ((i * 31 + 7) % (h - sandY));
    ctx.fillStyle = 'rgba(180,140,90,0.3)';
    ctx.fillRect(sx, sy, 2 * z, z);
  }
}

function renderCity(ctx: CanvasRenderingContext2D, w: number, h: number, z: number): void {
  // Skyline silhouettes (bottom area)
  const baseY = 20 * 16 * z;
  ctx.fillStyle = '#1a2030';

  // Buildings
  const buildings = [
    { x: 0.05, w: 0.08, h: 0.15 },
    { x: 0.14, w: 0.06, h: 0.22 },
    { x: 0.22, w: 0.1, h: 0.12 },
    { x: 0.35, w: 0.05, h: 0.28 },
    { x: 0.42, w: 0.08, h: 0.18 },
    { x: 0.55, w: 0.12, h: 0.1 },
    { x: 0.7, w: 0.06, h: 0.25 },
    { x: 0.78, w: 0.1, h: 0.14 },
    { x: 0.9, w: 0.08, h: 0.2 },
  ];

  for (const b of buildings) {
    const bx = w * b.x;
    const bw = w * b.w;
    const bh = h * b.h;
    ctx.fillRect(bx, baseY - bh, bw, bh + h);
  }

  // Building windows (small lit rectangles)
  ctx.fillStyle = '#ffcc6633';
  for (const b of buildings) {
    const bx = w * b.x;
    const bw = w * b.w;
    const bh = h * b.h;
    for (let wy = 0; wy < bh - 4 * z; wy += 6 * z) {
      for (let wx = 3 * z; wx < bw - 3 * z; wx += 5 * z) {
        if (Math.random() > 0.4) {
          ctx.fillRect(bx + wx, baseY - bh + wy + 2 * z, 2 * z, 3 * z);
        }
      }
    }
  }
}

function renderMountain(ctx: CanvasRenderingContext2D, w: number, h: number, z: number): void {
  const baseY = 20 * 16 * z;

  // Mountains
  const peaks = [
    { x: 0.1, h: 0.2, color: '#3a5a3a' },
    { x: 0.3, h: 0.3, color: '#2a4a2a' },
    { x: 0.5, h: 0.25, color: '#3a5a3a' },
    { x: 0.7, h: 0.35, color: '#2a4a2a' },
    { x: 0.9, h: 0.18, color: '#3a5a3a' },
  ];

  for (const p of peaks) {
    const px = w * p.x;
    const ph = h * p.h;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(px - w * 0.15, baseY);
    ctx.lineTo(px, baseY - ph);
    ctx.lineTo(px + w * 0.15, baseY);
    ctx.fill();

    // Snow cap
    ctx.fillStyle = '#e0e8f0';
    ctx.beginPath();
    ctx.moveTo(px - w * 0.03, baseY - ph + ph * 0.15);
    ctx.lineTo(px, baseY - ph);
    ctx.lineTo(px + w * 0.03, baseY - ph + ph * 0.15);
    ctx.fill();
  }

  // Grass
  ctx.fillStyle = '#3a6a2a';
  ctx.fillRect(0, baseY, w, h - baseY);
}

function renderNight(ctx: CanvasRenderingContext2D, w: number, h: number, z: number): void {
  // Stars
  for (let i = 0; i < 60; i++) {
    const sx = (((i * 97 + 13) % 1000) / 1000) * w;
    const sy = (((i * 61 + 29) % 500) / 500) * (h * 0.4);
    const brightness = 0.3 + ((i * 37) % 70) / 100;
    ctx.fillStyle = `rgba(255,255,240,${brightness})`;
    const size = i % 3 === 0 ? 2 * z : z;
    ctx.fillRect(sx, sy, size, size);
  }

  // Moon
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.arc(w * 0.8, h * 0.08, 10 * z, 0, Math.PI * 2);
  ctx.fill();
  // Moon glow
  const moonGrad = ctx.createRadialGradient(w * 0.8, h * 0.08, 10 * z, w * 0.8, h * 0.08, 30 * z);
  moonGrad.addColorStop(0, 'rgba(232,224,192,0.15)');
  moonGrad.addColorStop(1, 'rgba(232,224,192,0)');
  ctx.fillStyle = moonGrad;
  ctx.fillRect(w * 0.8 - 30 * z, h * 0.08 - 30 * z, 60 * z, 60 * z);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  _z: number,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - size * 0.4, y + size * 0.1, size * 0.6, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + size * 0.4, y + size * 0.1, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
