import { type TileCoord, TileType } from '../engine/types';

/** Check if a tile is walkable */
export function isWalkable(
  col: number,
  row: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  const rows = tileMap.length;
  const cols = rows > 0 ? (tileMap[0]?.length ?? 0) : 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const t = tileMap[row]?.[col];
  if (t === TileType.WALL || t === TileType.VOID) return false;
  if (blockedTiles.has(`${col},${row}`)) return false;
  return true;
}

/** Get all walkable tile positions for wandering */
export function getWalkableTiles(tileMap: TileType[][], blockedTiles: Set<string>): TileCoord[] {
  const rows = tileMap.length;
  const cols = rows > 0 ? (tileMap[0]?.length ?? 0) : 0;
  const tiles: TileCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isWalkable(c, r, tileMap, blockedTiles)) {
        tiles.push({ col: c, row: r });
      }
    }
  }
  return tiles;
}

/** Get walkable tiles within a specific room */
export function getWalkableTilesInRoom(
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  roomMap: (string | null)[][],
  roomId: string,
): TileCoord[] {
  return getWalkableTiles(tileMap, blockedTiles).filter((t) => roomMap[t.row]?.[t.col] === roomId);
}

/** BFS pathfinding on 4-connected grid. Returns path excluding start, including end. */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): TileCoord[] {
  if (startCol === endCol && startRow === endRow) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(startCol, startRow);
  const endKey = key(endCol, endRow);

  if (!isWalkable(endCol, endRow, tileMap, blockedTiles)) return [];

  const visited = new Set<string>();
  visited.add(startKey);

  const parent = new Map<string, string>();
  const queue: TileCoord[] = [{ col: startCol, row: startRow }];

  const dirs = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = key(curr.col, curr.row);

    if (currKey === endKey) {
      const path: TileCoord[] = [];
      let k = endKey;
      while (k !== startKey) {
        const parts = k.split(',').map(Number);
        path.unshift({ col: parts[0] ?? 0, row: parts[1] ?? 0 });
        k = parent.get(k)!;
      }
      return path;
    }

    for (const d of dirs) {
      const nc = curr.col + d.dc;
      const nr = curr.row + d.dr;
      const nk = key(nc, nr);

      if (visited.has(nk)) continue;
      if (!isWalkable(nc, nr, tileMap, blockedTiles)) continue;

      visited.add(nk);
      parent.set(nk, currKey);
      queue.push({ col: nc, row: nr });
    }
  }

  return [];
}

// Path cache for frequently used routes
const pathCache = new Map<string, TileCoord[]>();
const PATH_CACHE_MAX = 50;

export function findPathCached(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): TileCoord[] {
  const cacheKey = `${startCol},${startRow}->${endCol},${endRow}`;
  const cached = pathCache.get(cacheKey);
  if (cached) return [...cached]; // Return copy

  const path = findPath(startCol, startRow, endCol, endRow, tileMap, blockedTiles);

  if (path.length > 0) {
    if (pathCache.size >= PATH_CACHE_MAX) {
      const firstKey = pathCache.keys().next().value;
      if (firstKey) pathCache.delete(firstKey);
    }
    pathCache.set(cacheKey, path);
  }

  return path;
}

export function clearPathCache(): void {
  pathCache.clear();
}
