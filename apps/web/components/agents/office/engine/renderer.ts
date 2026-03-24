import { getAccessories, renderAccessories } from '../characters/accessories';
import { renderBackground } from '../effects/background';
import { WINDOWS } from '../world/layout';
import { getImage } from './asset-loader';
import {
  type BackgroundTheme,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  type Character,
  CharacterState,
  type Direction,
  type ElevatorEntity,
  ElevatorState,
  type FurnitureDef,
  GRID_COLS,
  GRID_ROWS,
  IdleActivity,
  PORING_BOUNCE_HEIGHT,
  type PoringEntity,
  type RoomId,
  TILE_SIZE,
  TileType,
  ZOOM,
} from './types';

const CHAR_SPRITE_W = 16;
const CHAR_SPRITE_H = 32;
const CHAR_SPRITE_PAD_TOP = 8;
const CHAR_VISIBLE_H = CHAR_SPRITE_H - CHAR_SPRITE_PAD_TOP;
const WALK_CYCLE = [0, 1, 2, 1];

let bgCanvas: HTMLCanvasElement | null = null;

// ── Tile hash ──
function tileHash(col: number, row: number, seed: number): number {
  return ((col * 73856093 + row * 19349663 + seed) & 0x7fffffff) / 0x7fffffff;
}

function lerpColor(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ── Floor palettes ──
interface WoodPalette {
  base: [number, number, number];
  light: [number, number, number];
  dark: [number, number, number];
  gap: string;
}

function getWoodPalette(room: RoomId | null): WoodPalette {
  switch (room) {
    case 'hawks_office':
      return {
        base: hexToRgb('#5c3d2e'),
        light: hexToRgb('#6b4835'),
        dark: hexToRgb('#4f3526'),
        gap: '#3a2518',
      };
    case 'open_office':
      return {
        base: hexToRgb('#7a5c3e'),
        light: hexToRgb('#8a6b4a'),
        dark: hexToRgb('#6e5236'),
        gap: '#5a4028',
      };
    case 'reception':
      return {
        base: hexToRgb('#8c7050'),
        light: hexToRgb('#9c7e5a'),
        dark: hexToRgb('#7c6244'),
        gap: '#6a4e30',
      };
    default:
      return {
        base: hexToRgb('#6a5040'),
        light: hexToRgb('#7a5e4c'),
        dark: hexToRgb('#5c4436'),
        gap: '#4a3420',
      };
  }
}

// ── Procedural floors ──

function drawWoodFloor(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  sz: number,
  room: RoomId | null,
  col: number,
  row: number,
): void {
  const pal = getWoodPalette(room);
  const h1 = tileHash(col, row, 1);
  const h2 = tileHash(col, row, 2);
  const halfSz = sz / 2;
  for (let p = 0; p < 2; p++) {
    const plankY = py + p * halfSz;
    const h = p === 0 ? h1 : h2;
    const t = h * 2 - 1;
    const r = lerpColor(pal.base[0], t > 0 ? pal.light[0] : pal.dark[0], Math.abs(t) * 0.6);
    const g = lerpColor(pal.base[1], t > 0 ? pal.light[1] : pal.dark[1], Math.abs(t) * 0.6);
    const b = lerpColor(pal.base[2], t > 0 ? pal.light[2] : pal.dark[2], Math.abs(t) * 0.6);
    ctx.fillStyle = rgbToHex(r, g, b);
    ctx.fillRect(px, plankY, sz, halfSz);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    const gy = plankY + halfSz * (0.3 + tileHash(col, row, 10 + p * 3) * 0.4);
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(px + sz, gy);
    ctx.stroke();
  }
  ctx.fillStyle = pal.gap;
  ctx.fillRect(px, py + halfSz - 0.5, sz, 1);
  if (tileHash(col, row, 99) > 0.92) {
    ctx.fillStyle = 'rgba(40,20,10,0.25)';
    ctx.beginPath();
    ctx.arc(
      px + sz * (0.3 + tileHash(col, row, 100) * 0.4),
      py + sz * (0.2 + tileHash(col, row, 101) * 0.6),
      2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawCarpetFloor(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  sz: number,
  col: number,
  row: number,
): void {
  ctx.fillStyle = '#3d5c4a';
  ctx.fillRect(px, py, sz, sz);
  const dots = 8 + Math.floor(tileHash(col, row, 1) * 5);
  for (let i = 0; i < dots; i++) {
    const dx = px + tileHash(col, row, 20 + i) * sz;
    const dy = py + tileHash(col, row, 40 + i) * sz;
    const bright = tileHash(col, row, 60 + i);
    ctx.fillStyle = rgbToHex(
      lerpColor(0x36, 0x4a, bright),
      lerpColor(0x52, 0x6b, bright),
      lerpColor(0x44, 0x56, bright),
    );
    ctx.fillRect(dx, dy, 1, 1);
  }
}

function drawTileFloor(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  sz: number,
  col: number,
  row: number,
  color1: string,
  color2: string,
): void {
  ctx.fillStyle = (col + row) % 2 === 0 ? color1 : color2;
  ctx.fillRect(px, py, sz, sz);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px + 0.5, py + 0.5, sz - 1, sz - 1);
}

function drawStoneFloor(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  sz: number,
  col: number,
  row: number,
): void {
  const quarter = sz / 2;
  for (let sr = 0; sr < 2; sr++) {
    for (let sc = 0; sc < 2; sc++) {
      const bright = tileHash(col * 2 + sc, row * 2 + sr, 5);
      const base = 0x4a;
      const r = lerpColor(base - 6, base + 8, bright);
      ctx.fillStyle = rgbToHex(r, r, r + 8);
      ctx.fillRect(px + sc * quarter + 1, py + sr * quarter + 1, quarter - 2, quarter - 2);
    }
  }
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(px + quarter - 0.5, py, 1, sz);
  ctx.fillRect(px, py + quarter - 0.5, sz, 1);
}

// ── Pre-render background ──

export function prerenderBackground(
  tileMap: TileType[][],
  roomMap: (RoomId | null)[][],
  bgTheme: BackgroundTheme,
): void {
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = GRID_COLS * TILE_SIZE * ZOOM;
  bgCanvas.height = GRID_ROWS * TILE_SIZE * ZOOM;
  const ctx = bgCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const z = ZOOM;
  const ts = TILE_SIZE;

  // Draw exterior background first (fills entire canvas)
  renderBackground(ctx, bgTheme);

  // Pass 1: Floors
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const tile = tileMap[r]?.[c];
      if (tile !== TileType.FLOOR && tile !== TileType.DOOR) continue;
      const px = c * ts * z;
      const py = r * ts * z;
      const sz = ts * z;
      const room = roomMap[r]?.[c] ?? null;

      switch (room) {
        case 'lounge':
          drawCarpetFloor(ctx, px, py, sz, c, r);
          break;
        case 'hallway':
          drawStoneFloor(ctx, px, py, sz, c, r);
          break;
        case 'kitchen':
          drawTileFloor(ctx, px, py, sz, c, r, '#e8e0d4', '#d8d0c4');
          break;
        case 'bathroom':
          drawTileFloor(ctx, px, py, sz, c, r, '#d0d8e0', '#c0c8d0');
          break;
        default:
          drawWoodFloor(ctx, px, py, sz, room, c, r);
          break;
      }

      // Door rendering
      if (tile === TileType.DOOR) {
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(px + 2, py + 2, sz - 4, sz - 4);
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px, py, 2, sz);
        ctx.fillRect(px + sz - 2, py, 2, sz);
        // Handle
        ctx.fillStyle = '#c0a060';
        ctx.beginPath();
        ctx.arc(px + sz - 6, py + sz / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Pass 2: Walls
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const tile = tileMap[r]?.[c];
      if (tile !== TileType.WALL) continue;
      const px = c * ts * z;
      const py = r * ts * z;
      const sz = ts * z;

      const grad = ctx.createLinearGradient(px, py, px, py + sz);
      grad.addColorStop(0, '#2e2e44');
      grad.addColorStop(1, '#22223a');
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, sz, sz);
      ctx.fillStyle = '#4a4a6c';
      ctx.fillRect(px, py, sz, 2 * z);
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(px, py + sz - z, sz, z);
    }
  }

  // Pass 3: Windows
  for (const win of WINDOWS) {
    const wx = win.col * ts * z;
    const wy = win.row * ts * z;
    const ww = win.horizontal ? 2 * ts * z : ts * z;
    const wh = win.horizontal ? ts * z : 2 * ts * z;

    // Window opening (shows background behind)
    ctx.clearRect(wx + 3, wy + 3, ww - 6, wh - 6);
    // Re-render background in window area
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx + 3, wy + 3, ww - 6, wh - 6);
    ctx.clip();
    renderBackground(ctx, bgTheme);
    ctx.restore();

    // Window frame
    ctx.strokeStyle = '#3a3a5c';
    ctx.lineWidth = 3;
    ctx.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
    // Glass tint
    ctx.fillStyle = 'rgba(150,200,255,0.08)';
    ctx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
    // Cross bar
    if (win.horizontal) {
      ctx.fillStyle = '#3a3a5c';
      ctx.fillRect(wx + ww / 2 - 1, wy + 2, 2, wh - 4);
    }
  }

  // Pass 4: Shadows and baseboards
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const tile = tileMap[r]?.[c];
      if (tile !== TileType.FLOOR && tile !== TileType.DOOR) continue;
      const px = c * ts * z;
      const py = r * ts * z;
      const sz = ts * z;

      const tileAbove = r > 0 ? tileMap[r - 1]?.[c] : undefined;
      if (tileAbove === TileType.WALL) {
        const shadowGrad = ctx.createLinearGradient(px, py, px, py + 5 * z);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(px, py, sz, 5 * z);
        const room = roomMap[r]?.[c] ?? null;
        ctx.fillStyle = room === 'lounge' ? '#2d4a3a' : '#3a2820';
        ctx.fillRect(px, py, sz, 2);
      }

      const tileLeft = c > 0 ? tileMap[r]?.[c - 1] : undefined;
      if (tileLeft === TileType.WALL) {
        const shadowGrad = ctx.createLinearGradient(px, py, px + 4 * z, py);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(px, py, 4 * z, sz);
      }
    }
  }
}

// ── Main render ──

export function render(
  ctx: CanvasRenderingContext2D,
  _tileMap: TileType[][],
  furniture: FurnitureDef[],
  characters: Character[],
  porings: PoringEntity[],
  elevator: ElevatorEntity | null,
  hoveredId: string | null,
  selectedId: string | null,
  dayNightOverlay: { color: string; alpha: number } | null,
  cubicleCount: number,
): void {
  const w = GRID_COLS * TILE_SIZE * ZOOM;
  const h = GRID_ROWS * TILE_SIZE * ZOOM;

  ctx.clearRect(0, 0, w, h);
  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);

  // Cubicle dividers
  renderCubicleDividers(ctx, cubicleCount);

  // Z-sorted scene
  const drawables: Array<{ type: string; zY: number; data: unknown }> = [];
  for (const f of furniture) drawables.push({ type: 'furniture', zY: f.zAnchor, data: f });
  for (const ch of characters) {
    if (!ch.visible) continue;
    drawables.push({
      type: 'character',
      zY: ch.y + TILE_SIZE + CHARACTER_Z_SORT_OFFSET,
      data: ch,
    });
  }
  for (const p of porings) drawables.push({ type: 'poring', zY: p.y + TILE_SIZE / 2, data: p });
  if (elevator)
    drawables.push({ type: 'elevator', zY: (elevator.tileRow + 3) * TILE_SIZE, data: elevator });

  drawables.sort((a, b) => a.zY - b.zY);

  for (const d of drawables) {
    switch (d.type) {
      case 'furniture':
        renderFurniture(ctx, d.data as FurnitureDef);
        break;
      case 'character':
        renderCharacter(ctx, d.data as Character, hoveredId, selectedId);
        break;
      case 'poring':
        renderPoring(ctx, d.data as PoringEntity);
        break;
      case 'elevator':
        renderElevator(ctx, d.data as ElevatorEntity);
        break;
    }
  }

  // Speech bubbles + ZZZ
  for (const ch of characters) {
    if (!ch.visible) continue;
    if (ch.idleActivity === IdleActivity.NAP && ch.state === CharacterState.REST) {
      renderZZZ(ctx, ch);
    } else if (ch.bubbleText && ch.bubbleTimer > 0) {
      renderSpeechBubble(ctx, ch);
    }
  }

  // Desk lamp glow
  if (dayNightOverlay && dayNightOverlay.alpha > 0.08) {
    for (const ch of characters) {
      if (ch.visible && ch.state === CharacterState.WORK) renderDeskLampGlow(ctx, ch);
    }
  }

  // Day/night
  if (dayNightOverlay && dayNightOverlay.alpha > 0) {
    ctx.globalAlpha = dayNightOverlay.alpha;
    ctx.fillStyle = dayNightOverlay.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1.0;
  }

  // Elevator glow
  if (elevator && elevator.state === ElevatorState.CLOSED) renderElevatorGlow(ctx, elevator);
}

// ── Cubicle dividers ──

function renderCubicleDividers(ctx: CanvasRenderingContext2D, count: number): void {
  const z = ZOOM;
  const ts = TILE_SIZE;
  const cols = [14, 18, 22, 26, 30, 34];
  const rowSets = [
    [3, 6],
    [7, 10],
  ];

  let idx = 0;
  for (const rowSet of rowSets) {
    const sr = rowSet[0] ?? 3;
    const er = rowSet[1] ?? 6;
    for (const col of cols) {
      if (idx >= count) return;
      const dx = (col - 1) * ts * z + ts * z - z;
      const dy = sr * ts * z;
      const dh = (er - sr + 1) * ts * z;
      ctx.fillStyle = '#5a5a6a';
      ctx.fillRect(dx, dy, 2, dh);
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect((col - 1) * ts * z, sr * ts * z, 3 * ts * z, 2);
      idx++;
    }
  }
}

// ── Furniture ──

function renderFurniture(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  // Procedural rendering for special furniture
  if (f.id === 'kitchen_fridge') {
    renderFridge(ctx, f);
    return;
  }
  if (f.id === 'kitchen_stove') {
    renderStove(ctx, f);
    return;
  }
  if (f.id === 'kitchen_sink') {
    renderSink(ctx, f);
    return;
  }
  if (f.id === 'hall_vending') {
    renderVendingMachine(ctx, f);
    return;
  }
  if (f.id === 'hall_cooler') {
    renderWaterCooler(ctx, f);
    return;
  }
  if (f.id === 'bathroom_toilet') {
    renderToilet(ctx, f);
    return;
  }
  if (f.id === 'bathroom_sink') {
    renderBathroomSink(ctx, f);
    return;
  }

  const spriteKey = f.animFrames
    ? (f.animFrames[Math.floor(Date.now() / ((f.animSpeed ?? 0.3) * 1000)) % f.animFrames.length] ??
      f.sprite)
    : f.sprite;
  const sprite = getImage(spriteKey);
  if (!sprite) return;

  const z = ZOOM;
  const dx = f.x * z;
  const dy = f.y * z;
  const dw = sprite.naturalWidth * z;
  const dh = sprite.naturalHeight * z;

  if (f.zAnchor <= f.y + TILE_SIZE) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(dx + 2 * z, dy + 2 * z, dw, dh);
  }
  ctx.drawImage(sprite, dx, dy, dw, dh);
}

// ── Procedural furniture ──

function renderFridge(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  const w = 16 * z;
  const h = 28 * z;
  ctx.fillStyle = '#d0d0d4';
  ctx.fillRect(x, y - 12 * z, w, h);
  ctx.fillStyle = '#b0b0b4';
  ctx.fillRect(x + w - 2 * z, y - 8 * z, 2 * z, 8 * z);
  ctx.fillStyle = '#888';
  ctx.fillRect(x + w - 3 * z, y - 4 * z, z, 3 * z);
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y - 12 * z + 1, w - 2, h - 2);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(x, y + 2 * z, w, 1);
}

function renderStove(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  const w = 16 * z;
  const h = 16 * z;
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 2 * z, y + 2 * z, 5 * z, 5 * z);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + 9 * z, y + 2 * z, 5 * z, 5 * z);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y + 10 * z, w, 6 * z);
  ctx.fillStyle = '#cc4422';
  ctx.fillRect(x + w - 3 * z, y + 12 * z, 2 * z, z);
}

function renderSink(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  ctx.fillStyle = '#c0c0c8';
  ctx.fillRect(x, y, 16 * z, 16 * z);
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(x + 3 * z, y + 3 * z, 10 * z, 8 * z);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(x + 7 * z, y + z, 2 * z, 3 * z);
}

function renderVendingMachine(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  const w = 16 * z;
  const h = 26 * z;
  ctx.fillStyle = '#2244aa';
  ctx.fillRect(x, y - 10 * z, w, h);
  ctx.fillStyle = '#111122';
  ctx.fillRect(x + 2 * z, y - 6 * z, w - 4 * z, 12 * z);
  ctx.fillStyle = '#ccaa33';
  ctx.fillRect(x + 3 * z, y - 4 * z, 3 * z, 2 * z);
  ctx.fillStyle = '#33cc66';
  ctx.fillRect(x + 7 * z, y - 4 * z, 3 * z, 2 * z);
  ctx.fillStyle = '#cc3333';
  ctx.fillRect(x + 3 * z, y - z, 3 * z, 2 * z);
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 3 * z, y + 8 * z, w - 6 * z, 5 * z);
  ctx.fillStyle = '#aaa';
  ctx.font = `${4 * z}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('SNACKS', x + w / 2, y - 7 * z);
}

function renderWaterCooler(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  ctx.fillStyle = '#aabbcc';
  ctx.fillRect(x + 3 * z, y, 10 * z, 16 * z);
  ctx.fillStyle = '#4488cc';
  ctx.beginPath();
  ctx.arc(x + 8 * z, y - 2 * z, 4 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(x + 7 * z, y - 4 * z, 2 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#888';
  ctx.fillRect(x + 6 * z, y + 8 * z, 4 * z, 2 * z);
}

function renderToilet(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(x + 2 * z, y + 2 * z, 12 * z, 12 * z);
  ctx.fillStyle = '#d0d0d0';
  ctx.beginPath();
  ctx.ellipse(x + 8 * z, y + 8 * z, 5 * z, 4 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ccc';
  ctx.fillRect(x + 4 * z, y, 8 * z, 4 * z);
}

function renderBathroomSink(ctx: CanvasRenderingContext2D, f: FurnitureDef): void {
  const z = ZOOM;
  const x = f.x * z;
  const y = f.y * z;
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(x + 2 * z, y + 4 * z, 12 * z, 10 * z);
  ctx.fillStyle = '#aaccee';
  ctx.fillRect(x + 4 * z, y + 6 * z, 8 * z, 6 * z);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(x + 7 * z, y + 2 * z, 2 * z, 4 * z);
}

// ── Character ──

function renderCharacter(
  ctx: CanvasRenderingContext2D,
  ch: Character,
  hoveredId: string | null,
  selectedId: string | null,
): void {
  const z = ZOOM;
  const charImg = getImage(`char_${ch.palette % 6}`);
  if (!charImg) return;

  const frameIdx = getCharacterFrameIndex(ch);
  const dirRow = getDirectionRow(ch.dir);
  const flipH = ch.dir === 3;
  const sx = frameIdx * CHAR_SPRITE_W;
  const sy = dirRow * CHAR_SPRITE_H;
  const sittingOffset =
    ch.state === CharacterState.WORK ||
    (ch.state === CharacterState.REST && ch.idleActivity === IdleActivity.SIT_SOFA)
      ? CHARACTER_SITTING_OFFSET_PX
      : 0;
  const dx = (ch.x - CHAR_SPRITE_W / 2) * z;
  const dy = (ch.y - CHAR_VISIBLE_H + sittingOffset) * z;
  const dw = CHAR_SPRITE_W * z;
  const dh = CHAR_SPRITE_H * z;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(ch.x * z, (ch.y + 2) * z, 6 * z, 3 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  if (ch.agentId === selectedId || ch.agentId === hoveredId) {
    const alpha = ch.agentId === selectedId ? 0.4 : 0.2;
    ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(ch.x * z, (ch.y + 2) * z, 8 * z, 4 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprite
  if (flipH) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(charImg, sx, sy, CHAR_SPRITE_W, CHAR_SPRITE_H, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(charImg, sx, sy, CHAR_SPRITE_W, CHAR_SPRITE_H, dx, dy, dw, dh);
  }

  // Accessories
  const acc = getAccessories(ch.name);
  renderAccessories(ctx, acc, ch.x * z, dy, dirRow, flipH);

  // Name only on hover/select (not always)
  if (ch.agentId === hoveredId || ch.agentId === selectedId) {
    renderNameLabel(ctx, ch);
  }
}

function getCharacterFrameIndex(ch: Character): number {
  switch (ch.state) {
    case CharacterState.WORK:
      return 3 + (ch.frame % 2);
    case CharacterState.WALK:
    case CharacterState.ARRIVE:
      return WALK_CYCLE[ch.frame % 4] ?? 1;
    case CharacterState.REST:
      if (ch.idleActivity === IdleActivity.DRINK_COFFEE || ch.idleActivity === IdleActivity.NAP)
        return 1;
      return 5 + (ch.frame % 2);
    default:
      return 1;
  }
}

function getDirectionRow(dir: Direction): number {
  switch (dir) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 2;
    default:
      return 0;
  }
}

function renderNameLabel(ctx: CanvasRenderingContext2D, ch: Character): void {
  const z = ZOOM;
  const labelX = ch.x * z;
  const labelY = (ch.y - CHAR_VISIBLE_H - 4) * z;
  ctx.font = `${8 * z}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const metrics = ctx.measureText(ch.name);
  const padX = 3 * z;
  const padY = 2 * z;
  const bgW = metrics.width + padX * 2;
  const bgH = 8 * z + padY * 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(labelX - bgW / 2, labelY - bgH, bgW, bgH);
  ctx.fillStyle = ch.tier === 'orchestrator' ? '#ffd700' : '#ffffff';
  ctx.fillText(ch.name, labelX, labelY - padY);
}

// ── Bubbles ──

function renderSpeechBubble(ctx: CanvasRenderingContext2D, ch: Character): void {
  if (!ch.bubbleText) return;
  const z = ZOOM;
  const bx = ch.x * z;
  const by = (ch.y - CHAR_VISIBLE_H - 16) * z;
  const alpha = ch.bubbleTimer < 1.0 ? ch.bubbleTimer : 1.0;
  ctx.globalAlpha = alpha;
  ctx.font = `${6 * z}px monospace`;
  ctx.textAlign = 'center';
  const metrics = ctx.measureText(ch.bubbleText);
  const padX = 4 * z;
  const padY = 3 * z;
  const bgW = metrics.width + padX * 2;
  const bgH = 6 * z + padY * 2;
  ctx.fillStyle = '#1e1e2e';
  ctx.strokeStyle = '#4a4a6a';
  ctx.lineWidth = z;
  ctx.fillRect(bx - bgW / 2, by - bgH, bgW, bgH);
  ctx.strokeRect(bx - bgW / 2, by - bgH, bgW, bgH);
  ctx.fillStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.moveTo(bx - 3 * z, by);
  ctx.lineTo(bx, by + 4 * z);
  ctx.lineTo(bx + 3 * z, by);
  ctx.fill();
  ctx.fillStyle = '#e0e0e0';
  ctx.fillText(ch.bubbleText, bx, by - padY);
  ctx.globalAlpha = 1.0;
}

function renderZZZ(ctx: CanvasRenderingContext2D, ch: Character): void {
  const z = ZOOM;
  const time = Date.now() / 1000;
  const baseX = ch.x * z;
  const baseY = (ch.y - CHAR_VISIBLE_H - 8) * z;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const phase = (time * 0.8 + i * 0.4) % 2.0;
    const floatY = baseY - phase * 8 * z;
    const floatX = baseX + (i - 1) * 5 * z;
    const alpha = phase < 1.5 ? 1.0 : 1.0 - (phase - 1.5) * 2.0;
    ctx.globalAlpha = Math.max(0, alpha) * 0.8;
    ctx.fillStyle = '#88aaff';
    ctx.font = `bold ${(5 + i * 2) * z}px monospace`;
    ctx.fillText('z', floatX, floatY);
  }
  ctx.globalAlpha = 1.0;
}

// ── Poring (fixed bounce) ──

function renderPoring(ctx: CanvasRenderingContext2D, p: PoringEntity): void {
  const z = ZOOM;
  const rawBounce = Math.sin(p.bouncePhase);
  const bounceY = -Math.abs(rawBounce) * PORING_BOUNCE_HEIGHT; // Always up
  const squash = 1 - Math.abs(rawBounce) * 0.15;
  const py = (p.y - 8 + bounceY) * z;
  const widthMul = 1 + (1 - squash) * 0.5;

  // Shadow (smaller when bounced)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x * z, (p.y + 2) * z, 5 * z * squash, 2 * z * squash, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (squash & stretch)
  ctx.fillStyle = '#ff88aa';
  ctx.beginPath();
  ctx.ellipse(p.x * z, py + 6 * z, 6 * z * widthMul, 5 * z * squash, 0, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = '#ffbbcc';
  ctx.beginPath();
  ctx.ellipse(p.x * z - 2 * z, py + 4 * z, 2 * z, 2 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect((p.x - 3) * z, py + 5 * z, 2 * z, 2 * z);
  ctx.fillRect((p.x + 1) * z, py + 5 * z, 2 * z, 2 * z);

  // Mouth
  ctx.fillStyle = '#cc4466';
  ctx.fillRect((p.x - 1) * z, py + 8 * z, 2 * z, z);
}

// ── Elevator ──

function renderElevator(ctx: CanvasRenderingContext2D, elev: ElevatorEntity): void {
  const z = ZOOM;
  const ts = TILE_SIZE;
  const ex = elev.x * z;
  const ey = elev.y * z;
  const ew = 2 * ts * z;
  const eh = 3 * ts * z;

  // Shaft walls
  ctx.fillStyle = '#22223a';
  ctx.fillRect(ex - 2 * z, ey, 2 * z, eh);
  ctx.fillRect(ex + ew, ey, 2 * z, eh);

  if (elev.doorOffset > 0) {
    ctx.fillStyle = '#1a1a28';
    ctx.fillRect(ex + 3 * z, ey + ts * z, ew - 6 * z, 2 * ts * z);
    ctx.fillStyle = 'rgba(200,200,180,0.15)';
    ctx.fillRect(ex + ew / 2 - 6 * z, ey + ts * z + 2, 12 * z, 3 * z);
    if (elev.doorOffset > 0.5) {
      const grad = ctx.createRadialGradient(ex + ew / 2, ey + eh, 0, ex + ew / 2, ey + eh, 20 * z);
      grad.addColorStop(0, 'rgba(200,200,160,0.08)');
      grad.addColorStop(1, 'rgba(200,200,160,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(ex - 10 * z, ey + eh, ew + 20 * z, 20 * z);
    }
  }

  // Frame
  ctx.fillStyle = '#2a2a3e';
  ctx.fillRect(ex, ey, ew, 3 * z);
  ctx.fillRect(ex, ey, 3 * z, eh);
  ctx.fillRect(ex + ew - 3 * z, ey, 3 * z, eh);
  ctx.fillRect(ex, ey + eh - 3 * z, ew, 3 * z);

  // Doors
  const halfDoor = (ew - 6 * z) / 2;
  const doorOpen = halfDoor * elev.doorOffset;
  const doorTop = ey + ts * z;
  const doorH = 2 * ts * z;
  const doorLeft = ex + 3 * z;
  const doorRight = ex + 3 * z + halfDoor;

  if (halfDoor - doorOpen > 1) {
    ctx.fillStyle = '#4a4a5e';
    ctx.fillRect(doorLeft, doorTop, halfDoor - doorOpen, doorH);
    ctx.fillStyle = '#3a3a4e';
    ctx.fillRect(doorLeft + halfDoor - doorOpen - 1, doorTop, 2, doorH);
  }
  if (halfDoor - doorOpen > 1) {
    ctx.fillStyle = '#4a4a5e';
    ctx.fillRect(doorRight + doorOpen, doorTop, halfDoor - doorOpen, doorH);
    ctx.fillStyle = '#3a3a4e';
    ctx.fillRect(doorRight + doorOpen, doorTop, 2, doorH);
  }

  // LED
  const ledColor =
    elev.state === ElevatorState.CLOSED
      ? '#cc4444'
      : elev.state === ElevatorState.OPEN
        ? '#44cc88'
        : '#ccaa44';
  ctx.fillStyle = ledColor;
  ctx.fillRect(ex + ew / 2 - 3 * z, ey + 4 * z, 6 * z, 4 * z);

  // Call button on wall
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(ex + ew + 5 * z, ey + eh / 2, 3 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = elev.state === ElevatorState.CLOSED ? '#444' : '#44cc88';
  ctx.beginPath();
  ctx.arc(ex + ew + 5 * z, ey + eh / 2, 2 * z, 0, Math.PI * 2);
  ctx.fill();

  // 1F
  ctx.fillStyle = '#aaa';
  ctx.font = `${5 * z}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('1F', ex + ew / 2, ey + ts * z - 2 * z);
}

function renderElevatorGlow(ctx: CanvasRenderingContext2D, elev: ElevatorEntity): void {
  const z = ZOOM;
  const ts = TILE_SIZE;
  const pulse = Math.sin(Date.now() / 800) * 0.1 + 0.15;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#4488ff';
  ctx.fillRect(elev.x * z - z, elev.y * z - z, 2 * ts * z + 2 * z, 3 * ts * z + 2 * z);
  ctx.globalAlpha = 1.0;
}

function renderDeskLampGlow(ctx: CanvasRenderingContext2D, ch: Character): void {
  const z = ZOOM;
  const lampX = ch.x * z;
  const lampY = (ch.y - 12) * z;
  const radius = 20 * z;
  const grad = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, radius);
  grad.addColorStop(0, 'rgba(255, 220, 140, 0.12)');
  grad.addColorStop(0.5, 'rgba(255, 200, 100, 0.06)');
  grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(lampX - radius, lampY - radius, radius * 2, radius * 2);
}
