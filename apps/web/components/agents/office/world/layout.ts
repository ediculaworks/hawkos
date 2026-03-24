import {
  Direction,
  type FurnitureDef,
  GRID_COLS,
  GRID_ROWS,
  type RoomId,
  type SeatDef,
  TILE_SIZE,
  TileType,
} from '../engine/types';

/**
 * Office Layout v4 — Complete Redesign
 *
 * 40×28 grid. Office occupies cols 2-37, rows 2-19. Exterior around it.
 *
 * R0-1:  [EXTERIOR — sky/background]
 * R2-11: ╔═══════════╦══════════════════════════╗
 *        ║ HAWK OFF  ║     OPEN OFFICE           ║
 *        ║ 10×10     ║  cubicles per agent 26×10  ║
 *        ╠═════╦═════╩═══╦═════╦═══════════╦═════╣
 * R12-19:║ WC  ║ KITCHEN  ║HALL ║  LOUNGE   ║RECV ║
 *        ║ 3×8 ║  8×8     ║ 4×8║  10×8     ║11×8 ║
 *        ╚═════╩══════════╩════╩═══════════╩═════╝
 * R20-27: [EXTERIOR — ground/beach/city]
 */

// ── Room boundaries ──
const ROOMS = {
  hawks_office: { x1: 2, y1: 2, x2: 11, y2: 11 },
  open_office: { x1: 12, y1: 2, x2: 37, y2: 11 },
  bathroom: { x1: 2, y1: 12, x2: 4, y2: 19 },
  kitchen: { x1: 5, y1: 12, x2: 12, y2: 19 },
  hallway: { x1: 13, y1: 12, x2: 16, y2: 19 },
  lounge: { x1: 17, y1: 12, x2: 26, y2: 19 },
  reception: { x1: 27, y1: 12, x2: 37, y2: 19 },
};

// ── Window positions (col positions on exterior walls) ──
export const WINDOWS: Array<{ col: number; row: number; horizontal: boolean }> = [
  // Top wall (row 2) — looking out
  { col: 5, row: 2, horizontal: true },
  { col: 8, row: 2, horizontal: true },
  { col: 15, row: 2, horizontal: true },
  { col: 20, row: 2, horizontal: true },
  { col: 25, row: 2, horizontal: true },
  { col: 30, row: 2, horizontal: true },
  { col: 35, row: 2, horizontal: true },
  // Bottom wall (row 19) — looking out
  { col: 7, row: 19, horizontal: true },
  { col: 20, row: 19, horizontal: true },
  { col: 30, row: 19, horizontal: true },
  // Left wall (col 2) — vertical windows
  { col: 2, row: 5, horizontal: false },
  { col: 2, row: 8, horizontal: false },
  { col: 2, row: 15, horizontal: false },
  // Right wall (col 37)
  { col: 37, row: 5, horizontal: false },
  { col: 37, row: 8, horizontal: false },
  { col: 37, row: 15, horizontal: false },
];

/** Generate the tile map */
export function createTileMap(): TileType[][] {
  const map: TileType[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push(getTileType(c, r));
    }
    map.push(row);
  }
  return map;
}

function isInRoom(col: number, row: number): boolean {
  return Object.values(ROOMS).some((r) => col >= r.x1 && col <= r.x2 && row >= r.y1 && row <= r.y2);
}

function getTileType(col: number, row: number): TileType {
  // Exterior
  if (row <= 1 || row >= 20 || col <= 1 || col >= 38) return TileType.VOID;

  // Office outer walls
  if (row === 2 || row === 19) {
    if (col >= 2 && col <= 37) return TileType.WALL;
  }
  if (col === 2 || col === 37) {
    if (row >= 2 && row <= 19) return TileType.WALL;
  }

  // Hawk office right wall
  if (col === 11 && row >= 2 && row <= 11) {
    if (row === 6 || row === 7) return TileType.DOOR;
    return TileType.WALL;
  }

  // Divider between upper and lower floors (row 12 top wall of lower rooms, row 11 bottom of upper)
  if (row === 12 && col >= 2 && col <= 37) {
    // Doors between floors
    if (col === 6 || col === 7) return TileType.DOOR; // Kitchen access
    if (col === 14 || col === 15) return TileType.DOOR; // Hallway access from open office
    if (col === 20 || col === 21) return TileType.DOOR; // Lounge access
    if (col === 30 || col === 31) return TileType.DOOR; // Reception access
    return TileType.WALL;
  }

  // Bathroom right wall
  if (col === 4 && row >= 12 && row <= 19) {
    if (row === 14 || row === 15) return TileType.DOOR;
    return TileType.WALL;
  }

  // Kitchen right wall
  if (col === 12 && row >= 12 && row <= 19) {
    if (row === 15 || row === 16) return TileType.DOOR;
    return TileType.WALL;
  }

  // Hallway right wall
  if (col === 16 && row >= 12 && row <= 19) {
    if (row === 15 || row === 16) return TileType.DOOR;
    return TileType.WALL;
  }

  // Lounge right wall
  if (col === 26 && row >= 12 && row <= 19) {
    if (row === 15 || row === 16) return TileType.DOOR;
    return TileType.WALL;
  }

  // Interior floor
  if (isInRoom(col, row)) return TileType.FLOOR;

  return TileType.VOID;
}

/** Generate room assignment map */
export function createRoomMap(): (RoomId | null)[][] {
  const map: (RoomId | null)[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: (RoomId | null)[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push(getRoomId(c, r));
    }
    map.push(row);
  }
  return map;
}

function getRoomId(col: number, row: number): RoomId | null {
  // Exterior
  if (row <= 1 || row >= 20 || col <= 1 || col >= 38) return 'exterior';

  for (const [id, bounds] of Object.entries(ROOMS)) {
    if (col >= bounds.x1 && col <= bounds.x2 && row >= bounds.y1 && row <= bounds.y2) {
      return id as RoomId;
    }
  }
  return null;
}

/** Generate blocked tiles from furniture + elevator */
export function getBlockedTiles(furniture: FurnitureDef[]): Set<string> {
  const blocked = new Set<string>();
  for (const f of furniture) {
    for (const fp of f.footprint) {
      blocked.add(`${fp.col},${fp.row}`);
    }
  }
  // Elevator (35-36, 12-14)
  for (let r = 12; r <= 14; r++) {
    for (let c = 35; c <= 36; c++) {
      blocked.add(`${c},${r}`);
    }
  }
  return blocked;
}

// ── Seats ──

export function createSeats(): SeatDef[] {
  return [
    // Hawk's desk seat
    { id: 'hawk_seat', col: 6, row: 7, facingDir: Direction.UP, room: 'hawks_office' },

    // Lounge sofa seats
    { id: 'sofa_1', col: 19, row: 14, facingDir: Direction.DOWN, room: 'lounge' },
    { id: 'sofa_2', col: 20, row: 14, facingDir: Direction.DOWN, room: 'lounge' },
    { id: 'sofa_3', col: 21, row: 14, facingDir: Direction.DOWN, room: 'lounge' },

    // Kitchen table seats
    { id: 'kitchen_seat_1', col: 8, row: 17, facingDir: Direction.UP, room: 'kitchen' },
    { id: 'kitchen_seat_2', col: 9, row: 17, facingDir: Direction.UP, room: 'kitchen' },

    // Coffee spot (kitchen)
    { id: 'coffee_spot', col: 11, row: 14, facingDir: Direction.UP, room: 'kitchen' },
  ];
}

/** Create dynamic cubicle seats based on agent count */
export function createCubicleSeats(agentCount: number): SeatDef[] {
  const seats: SeatDef[] = [];
  // Cubicles: 4 tiles wide, arranged in open office (cols 13-36, rows 3-10)
  // Row A: rows 3-6 (seat at row 5)
  // Row B: rows 7-10 (seat at row 9)
  const cubiclePositions = [
    // Row A
    { col: 15, row: 5 },
    { col: 19, row: 5 },
    { col: 23, row: 5 },
    { col: 27, row: 5 },
    { col: 31, row: 5 },
    { col: 35, row: 5 },
    // Row B
    { col: 15, row: 9 },
    { col: 19, row: 9 },
    { col: 23, row: 9 },
    { col: 27, row: 9 },
    { col: 31, row: 9 },
    { col: 35, row: 9 },
  ];

  for (let i = 0; i < Math.min(agentCount, cubiclePositions.length); i++) {
    const pos = cubiclePositions[i]!;
    seats.push({
      id: `cubicle_${i}`,
      col: pos.col,
      row: pos.row,
      facingDir: Direction.UP,
      room: 'open_office',
    });
  }
  return seats;
}

// ── Furniture ──

export function createFurniture(): FurnitureDef[] {
  const furniture: FurnitureDef[] = [];
  const ts = TILE_SIZE;

  // ── Hawk's Office ──
  furniture.push({
    id: 'hawk_desk',
    sprite: 'DESK_FRONT',
    x: 5 * ts,
    y: 5 * ts,
    footprint: [
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
      { col: 5, row: 6 },
      { col: 6, row: 6 },
      { col: 7, row: 6 },
    ],
    zAnchor: 7 * ts,
  });
  furniture.push({
    id: 'hawk_pc',
    sprite: 'PC_FRONT_ON_1',
    x: 6 * ts,
    y: 5 * ts,
    footprint: [],
    zAnchor: 6 * ts + 1,
    animFrames: ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'],
    animSpeed: 0.3,
  });
  furniture.push({
    id: 'hawk_bookshelf',
    sprite: 'DOUBLE_BOOKSHELF',
    x: 3 * ts,
    y: 3 * ts,
    footprint: [
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
    ],
    zAnchor: 4 * ts,
  });
  furniture.push({
    id: 'hawk_plant',
    sprite: 'LARGE_PLANT',
    x: 9 * ts,
    y: 3 * ts,
    footprint: [{ col: 9, row: 3 }],
    zAnchor: 4 * ts,
  });
  furniture.push({
    id: 'hawk_painting',
    sprite: 'LARGE_PAINTING',
    x: 7 * ts,
    y: 3 * ts,
    footprint: [],
    zAnchor: 3 * ts,
  });

  // ── Kitchen ──
  // Rendered procedurally but need footprints for blocking
  furniture.push({
    id: 'kitchen_fridge',
    sprite: 'BOOKSHELF',
    x: 6 * ts,
    y: 13 * ts,
    footprint: [{ col: 6, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'kitchen_stove',
    sprite: 'SMALL_TABLE_FRONT',
    x: 8 * ts,
    y: 13 * ts,
    footprint: [{ col: 8, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'kitchen_sink',
    sprite: 'COFFEE',
    x: 10 * ts,
    y: 13 * ts,
    footprint: [{ col: 10, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'kitchen_coffee',
    sprite: 'COFFEE',
    x: 11 * ts,
    y: 13 * ts,
    footprint: [{ col: 11, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'kitchen_table',
    sprite: 'SMALL_TABLE_FRONT',
    x: 7 * ts,
    y: 16 * ts,
    footprint: [
      { col: 7, row: 16 },
      { col: 8, row: 16 },
      { col: 9, row: 16 },
    ],
    zAnchor: 17 * ts,
  });

  // ── Bathroom ──
  furniture.push({
    id: 'bathroom_toilet',
    sprite: 'WOODEN_CHAIR_FRONT',
    x: 3 * ts,
    y: 15 * ts,
    footprint: [{ col: 3, row: 15 }],
    zAnchor: 16 * ts,
  });
  furniture.push({
    id: 'bathroom_sink',
    sprite: 'POT',
    x: 3 * ts,
    y: 13 * ts,
    footprint: [{ col: 3, row: 13 }],
    zAnchor: 14 * ts,
  });

  // ── Hallway ──
  furniture.push({
    id: 'hall_vending',
    sprite: 'BOOKSHELF',
    x: 14 * ts,
    y: 13 * ts,
    footprint: [{ col: 14, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'hall_cooler',
    sprite: 'COFFEE',
    x: 15 * ts,
    y: 13 * ts,
    footprint: [{ col: 15, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'hall_bin',
    sprite: 'BIN',
    x: 15 * ts,
    y: 18 * ts,
    footprint: [{ col: 15, row: 18 }],
    zAnchor: 19 * ts,
  });

  // ── Lounge ──
  furniture.push({
    id: 'lounge_sofa',
    sprite: 'SOFA_FRONT',
    x: 18 * ts,
    y: 13 * ts,
    footprint: [
      { col: 18, row: 13 },
      { col: 19, row: 13 },
      { col: 20, row: 13 },
      { col: 21, row: 13 },
    ],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'lounge_table',
    sprite: 'SMALL_TABLE_FRONT',
    x: 19 * ts,
    y: 16 * ts,
    footprint: [
      { col: 19, row: 16 },
      { col: 20, row: 16 },
    ],
    zAnchor: 17 * ts,
  });
  furniture.push({
    id: 'lounge_bookshelf',
    sprite: 'BOOKSHELF',
    x: 24 * ts,
    y: 13 * ts,
    footprint: [
      { col: 24, row: 13 },
      { col: 25, row: 13 },
    ],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'lounge_plant1',
    sprite: 'PLANT',
    x: 17 * ts,
    y: 18 * ts,
    footprint: [{ col: 17, row: 18 }],
    zAnchor: 19 * ts,
  });
  furniture.push({
    id: 'lounge_plant2',
    sprite: 'CACTUS',
    x: 25 * ts,
    y: 18 * ts,
    footprint: [{ col: 25, row: 18 }],
    zAnchor: 19 * ts,
  });
  furniture.push({
    id: 'lounge_painting',
    sprite: 'SMALL_PAINTING',
    x: 22 * ts,
    y: 13 * ts,
    footprint: [],
    zAnchor: 13 * ts,
  });

  // ── Reception ──
  furniture.push({
    id: 'rec_desk',
    sprite: 'DESK_FRONT',
    x: 29 * ts,
    y: 15 * ts,
    footprint: [
      { col: 29, row: 15 },
      { col: 30, row: 15 },
      { col: 31, row: 15 },
      { col: 29, row: 16 },
      { col: 30, row: 16 },
      { col: 31, row: 16 },
    ],
    zAnchor: 17 * ts,
  });
  furniture.push({
    id: 'rec_plant1',
    sprite: 'LARGE_PLANT',
    x: 28 * ts,
    y: 13 * ts,
    footprint: [{ col: 28, row: 13 }],
    zAnchor: 14 * ts,
  });
  furniture.push({
    id: 'rec_plant2',
    sprite: 'PLANT_2',
    x: 33 * ts,
    y: 18 * ts,
    footprint: [{ col: 33, row: 18 }],
    zAnchor: 19 * ts,
  });
  furniture.push({
    id: 'rec_clock',
    sprite: 'CLOCK',
    x: 33 * ts,
    y: 13 * ts,
    footprint: [],
    zAnchor: 13 * ts,
  });

  return furniture;
}

/** Create cubicle furniture for each agent */
export function createCubicleFurniture(agentCount: number): FurnitureDef[] {
  const furniture: FurnitureDef[] = [];
  const ts = TILE_SIZE;

  const cubiclePositions = [
    // Row A (rows 3-6): desk at row 3-4, seat at row 5
    { col: 14, row: 3 },
    { col: 18, row: 3 },
    { col: 22, row: 3 },
    { col: 26, row: 3 },
    { col: 30, row: 3 },
    { col: 34, row: 3 },
    // Row B (rows 7-10): desk at row 7-8, seat at row 9
    { col: 14, row: 7 },
    { col: 18, row: 7 },
    { col: 22, row: 7 },
    { col: 26, row: 7 },
    { col: 30, row: 7 },
    { col: 34, row: 7 },
  ];

  for (let i = 0; i < Math.min(agentCount, cubiclePositions.length); i++) {
    const pos = cubiclePositions[i]!;
    // Desk (2 tiles wide)
    furniture.push({
      id: `cubicle_${i}_desk`,
      sprite: 'DESK_FRONT',
      x: pos.col * ts,
      y: pos.row * ts,
      footprint: [
        { col: pos.col, row: pos.row },
        { col: pos.col + 1, row: pos.row },
        { col: pos.col, row: pos.row + 1 },
        { col: pos.col + 1, row: pos.row + 1 },
      ],
      zAnchor: (pos.row + 2) * ts,
    });
    // PC
    furniture.push({
      id: `cubicle_${i}_pc`,
      sprite: 'PC_FRONT_OFF',
      x: pos.col * ts,
      y: pos.row * ts,
      footprint: [],
      zAnchor: (pos.row + 1) * ts + 1,
    });
  }

  return furniture;
}

/** Elevator position */
export const ELEVATOR_EXIT = { col: 35, row: 15 };

/** Activity spots */
export const ART_SPOTS: Array<{ col: number; row: number; facingDir: Direction }> = [
  { col: 7, row: 4, facingDir: Direction.UP },
  { col: 22, row: 14, facingDir: Direction.UP },
];

export const READ_SPOTS: Array<{ col: number; row: number; facingDir: Direction }> = [
  { col: 8, row: 17, facingDir: Direction.UP },
  { col: 9, row: 17, facingDir: Direction.UP },
];

export const COFFEE_SPOT = { col: 11, row: 14, facingDir: Direction.UP };

export function getRoomFloorPattern(room: RoomId | null): number {
  switch (room) {
    case 'hawks_office':
      return 3;
    case 'open_office':
      return 1;
    case 'kitchen':
      return 4;
    case 'bathroom':
      return 6;
    case 'lounge':
      return 5;
    case 'hallway':
      return 0;
    case 'reception':
      return 2;
    default:
      return 0;
  }
}
