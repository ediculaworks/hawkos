import { ZOOM } from '../engine/types';

export interface AccessorySet {
  hairStyle: number; // 0=short, 1=long, 2=spiky, 3=bald
  hairColor: string;
  hasGlasses: boolean;
  bodyAccessory: 'tie' | 'badge' | 'none';
  accentColor: string; // for tie/badge/shirt tint
}

const HAIR_COLORS = [
  '#2a1a0a',
  '#6b3a1a',
  '#d4a040',
  '#cc3333',
  '#1a1a3a',
  '#f0e8d0',
  '#ff6b35',
  '#8b45a6',
];

function nameHash(name: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Get deterministic accessories for an agent based on name */
export function getAccessories(agentName: string): AccessorySet {
  const h1 = nameHash(agentName, 1);
  const h2 = nameHash(agentName, 2);
  const h3 = nameHash(agentName, 3);
  const h4 = nameHash(agentName, 4);

  return {
    hairStyle: h1 % 4,
    hairColor: HAIR_COLORS[h2 % HAIR_COLORS.length] ?? '#2a1a0a',
    hasGlasses: h3 % 100 < 30,
    bodyAccessory: h4 % 100 < 20 ? 'tie' : h4 % 100 < 40 ? 'badge' : 'none',
    accentColor: HAIR_COLORS[(h4 + 3) % HAIR_COLORS.length] ?? '#cc3333',
  };
}

/** Draw accessories on top of a character sprite */
export function renderAccessories(
  ctx: CanvasRenderingContext2D,
  accessories: AccessorySet,
  charX: number, // character center x (world coords * zoom)
  charY: number, // character top y (world coords * zoom)
  dirRow: number, // 0=down, 1=up, 2=right/left
  flipH: boolean,
): void {
  const z = ZOOM;

  // ── Hair ──
  renderHair(ctx, accessories, charX, charY, dirRow, z);

  // ── Glasses ──
  if (accessories.hasGlasses && dirRow !== 1) {
    // Don't draw glasses when facing up
    const glassY = charY + 12 * z; // face level
    const glassX = charX - 3 * z;
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(glassX, glassY, 2 * z, 2 * z);
    ctx.fillRect(glassX + 3 * z, glassY, 2 * z, 2 * z);
    // Bridge
    ctx.fillRect(glassX + 2 * z, glassY + z * 0.5, z, z);
  }

  // ── Body accessory ──
  if (accessories.bodyAccessory === 'tie' && dirRow !== 1) {
    const tieX = charX - z * 0.5;
    const tieY = charY + 18 * z;
    ctx.fillStyle = accessories.accentColor;
    ctx.fillRect(tieX, tieY, z, 4 * z);
    // Tie knot
    ctx.fillRect(tieX - z * 0.5, tieY, 2 * z, z);
  } else if (accessories.bodyAccessory === 'badge' && dirRow !== 1) {
    const badgeX = flipH ? charX + z : charX - 3 * z;
    const badgeY = charY + 19 * z;
    ctx.fillStyle = accessories.accentColor;
    ctx.fillRect(badgeX, badgeY, 2 * z, 2 * z);
    // Badge shine
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(badgeX, badgeY, z, z);
  }
}

function renderHair(
  ctx: CanvasRenderingContext2D,
  acc: AccessorySet,
  cx: number,
  cy: number,
  dirRow: number,
  z: number,
): void {
  ctx.fillStyle = acc.hairColor;
  const headTop = cy + 8 * z; // top of visible head

  switch (acc.hairStyle) {
    case 0: // Short
      ctx.fillRect(cx - 4 * z, headTop - z, 8 * z, 3 * z);
      break;
    case 1: // Long (flows down sides)
      ctx.fillRect(cx - 4 * z, headTop - z, 8 * z, 3 * z);
      if (dirRow !== 1) {
        // Side strands
        ctx.fillRect(cx - 5 * z, headTop + 2 * z, 2 * z, 4 * z);
        ctx.fillRect(cx + 3 * z, headTop + 2 * z, 2 * z, 4 * z);
      }
      break;
    case 2: // Spiky
      ctx.fillRect(cx - 4 * z, headTop - z, 8 * z, 2 * z);
      // Spikes
      ctx.fillRect(cx - 3 * z, headTop - 3 * z, 2 * z, 2 * z);
      ctx.fillRect(cx + z, headTop - 3 * z, 2 * z, 2 * z);
      ctx.fillRect(cx - z, headTop - 4 * z, 2 * z, 2 * z);
      break;
    case 3: // Bald (no hair drawn)
      break;
  }
}
