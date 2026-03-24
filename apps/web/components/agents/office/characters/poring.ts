import {
  Direction,
  PORING_BOUNCE_SPEED,
  PORING_WALK_SPEED,
  type PoringEntity,
  TILE_SIZE,
  type TileCoord,
  type TileType,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
} from '../engine/types';
import { findPath } from '../world/pathfinding';

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

function directionBetween(fc: number, fr: number, tc: number, tr: number): Direction {
  const dc = tc - fc;
  const dr = tr - fr;
  if (dc > 0) return Direction.RIGHT;
  if (dc < 0) return Direction.LEFT;
  if (dr > 0) return Direction.DOWN;
  return Direction.UP;
}

export function createPoring(id: number, startCol: number, startRow: number): PoringEntity {
  const center = tileCenter(startCol, startRow);
  return {
    id,
    x: center.x,
    y: center.y,
    tileCol: startCol,
    tileRow: startRow,
    path: [],
    moveProgress: 0,
    dir: Direction.DOWN,
    bouncePhase: Math.random() * Math.PI * 2, // Random start phase
    wanderTimer: randomRange(3, 10),
    frame: 0,
    frameTimer: 0,
  };
}

export function updatePoring(
  p: PoringEntity,
  dt: number,
  walkableTiles: TileCoord[],
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): void {
  // Always bounce
  p.bouncePhase += PORING_BOUNCE_SPEED * dt;

  if (p.path.length === 0) {
    // Idle: wait then pick new target
    p.wanderTimer -= dt;
    if (p.wanderTimer <= 0) {
      if (walkableTiles.length > 0) {
        const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)]!;
        const path = findPath(p.tileCol, p.tileRow, target.col, target.row, tileMap, blockedTiles);
        if (path.length > 0 && path.length < 20) {
          // Only short paths for porings
          p.path = path;
          p.moveProgress = 0;
        }
      }
      p.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC * 2, WANDER_PAUSE_MAX_SEC * 2);
    }
  } else {
    // Walking
    const nextTile = p.path[0]!;
    p.dir = directionBetween(p.tileCol, p.tileRow, nextTile.col, nextTile.row);
    p.moveProgress += (PORING_WALK_SPEED / TILE_SIZE) * dt;

    const from = tileCenter(p.tileCol, p.tileRow);
    const to = tileCenter(nextTile.col, nextTile.row);
    const t = Math.min(p.moveProgress, 1);
    p.x = from.x + (to.x - from.x) * t;
    p.y = from.y + (to.y - from.y) * t;

    if (p.moveProgress >= 1) {
      p.tileCol = nextTile.col;
      p.tileRow = nextTile.row;
      p.x = to.x;
      p.y = to.y;
      p.path.shift();
      p.moveProgress = 0;
    }
  }
}
