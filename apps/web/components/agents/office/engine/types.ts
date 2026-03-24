// ── Grid & Layout ────────────────────────────────────────────
export const TILE_SIZE = 16;
export const GRID_COLS = 40;
export const GRID_ROWS = 28;
export const ZOOM = 3; // render at 3x for crisp pixel art

// ── Character Animation ─────────────────────────────────────
export const WALK_SPEED_PX_PER_SEC = 48;
export const WALK_FRAME_DURATION_SEC = 0.15;
export const TYPE_FRAME_DURATION_SEC = 0.3;
export const WANDER_PAUSE_MIN_SEC = 3.0;
export const WANDER_PAUSE_MAX_SEC = 15.0;
export const WANDER_MOVES_BEFORE_REST_MIN = 2;
export const WANDER_MOVES_BEFORE_REST_MAX = 5;
export const SEAT_REST_MIN_SEC = 30.0;
export const SEAT_REST_MAX_SEC = 90.0;

// ── Rendering ────────────────────────────────────────────────
export const CHARACTER_SITTING_OFFSET_PX = 6;
export const CHARACTER_Z_SORT_OFFSET = 0.5;
export const MAX_DELTA_TIME_SEC = 0.1;
export const PALETTE_COUNT = 6;

// ── Speech Bubbles ────────────────────────────────────────────
export const BUBBLE_SHOW_DURATION_SEC = 4.0;
export const BUBBLE_COOLDOWN_MIN_SEC = 30.0;
export const BUBBLE_COOLDOWN_MAX_SEC = 60.0;

// ── Interactions ────────────────────────────────────────────
export const INTERACTION_MIN_INTERVAL_SEC = 30.0;
export const INTERACTION_MAX_INTERVAL_SEC = 60.0;

// ── Poring ────────────────────────────────────────────────
export const PORING_BOUNCE_SPEED = 2.5;
export const PORING_BOUNCE_HEIGHT = 3;
export const PORING_WALK_SPEED = 24;
export const PORING_COUNT = 3;

// ── Day/Night ────────────────────────────────────────────────
export const DAY_NIGHT_UPDATE_INTERVAL_MS = 60_000;

// ── Sound ────────────────────────────────────────────────────
export const MASTER_VOLUME = 0.15;

// ── Idle Activities ──────────────────────────────────────────
export const IDLE_ACTIVITY_CHANCE = 0.7;
export const SIT_SOFA_DURATION_MIN = 15.0;
export const SIT_SOFA_DURATION_MAX = 45.0;
export const COFFEE_BREW_DURATION = 3.0;
export const COFFEE_WALK_DURATION = 10.0;
export const NAP_DURATION_MIN = 20.0;
export const NAP_DURATION_MAX = 60.0;
export const CHAT_DURATION_MIN = 8.0;
export const CHAT_DURATION_MAX = 20.0;
export const READ_DURATION_MIN = 15.0;
export const READ_DURATION_MAX = 40.0;
export const LOOK_ART_DURATION = 5.0;

// ── Elevator ────────────────────────────────────────────────
export const ELEVATOR_OPENING_DURATION = 0.8;
export const ELEVATOR_OPEN_HOLD_MIN = 1.5;
export const ELEVATOR_CLOSING_DURATION = 0.6;
export const ELEVATOR_SPAWN_GAP = 0.5;
export const ELEVATOR_COL = 33;
export const ELEVATOR_ROW = 14;
export const ELEVATOR_EXIT_COL = 34;
export const ELEVATOR_EXIT_ROW = 17;

// ── Types ────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileCoord {
  col: number;
  row: number;
}

export type RoomId =
  | 'hawks_office'
  | 'open_office'
  | 'bathroom'
  | 'kitchen'
  | 'hallway'
  | 'lounge'
  | 'reception'
  | 'exterior';

export type BackgroundTheme = 'beach' | 'city' | 'mountain' | 'night';

export enum TileType {
  VOID = 0,
  WALL = 1,
  FLOOR = 2,
  DOOR = 3,
}

export enum CharacterState {
  IDLE = 0,
  WALK = 1,
  WORK = 2,
  REST = 3,
  ARRIVE = 4,
}

export enum Direction {
  DOWN = 0,
  UP = 1,
  RIGHT = 2,
  LEFT = 3,
}

export enum IdleActivity {
  NONE = 0,
  SIT_SOFA = 1,
  DRINK_COFFEE = 2,
  NAP = 3,
  CHAT = 4,
  READ = 5,
  LOOK_ART = 6,
}

export enum ElevatorState {
  CLOSED = 0,
  OPENING = 1,
  OPEN = 2,
  CLOSING = 3,
}

export interface SeatDef {
  id: string;
  col: number;
  row: number;
  facingDir: Direction;
  room: RoomId;
}

export interface FurnitureDef {
  id: string;
  sprite: string;
  x: number;
  y: number;
  footprint: TileCoord[];
  zAnchor: number;
  interactable?: boolean;
  interactAction?: 'open_hiring' | 'open_chat';
  seat?: SeatDef;
  animFrames?: string[];
  animSpeed?: number;
}

export interface Character {
  id: string;
  agentId: string;
  name: string;
  tier: string;
  state: CharacterState;
  dir: Direction;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: TileCoord[];
  moveProgress: number;
  palette: number;
  hueShift: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  wanderCount: number;
  wanderLimit: number;
  seatId: string | null;
  seatTimer: number;
  isActive: boolean;
  // Speech bubble
  bubbleText: string | null;
  bubbleTimer: number;
  bubbleCooldown: number;
  // Phrases from agent personality
  phrases: string[];
  // Idle activity system
  idleActivity: IdleActivity;
  idleActivityTimer: number;
  chatPartnerId: string | null;
  // Elevator spawn
  arrivalDelay: number;
  visible: boolean;
}

export interface ElevatorEntity {
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  state: ElevatorState;
  animTimer: number;
  doorOffset: number;
  holdTimer: number;
  queuedAgents: string[];
  spawnCooldown: number;
}

export interface PoringEntity {
  id: number;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: TileCoord[];
  moveProgress: number;
  dir: Direction;
  bouncePhase: number;
  wanderTimer: number;
  frame: number;
  frameTimer: number;
}

export interface AgentData {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  traits: string[];
  tone: string;
  phrases?: string[];
  enabled_tools: string[];
  is_system: boolean;
  created_at: string;
  agent_tier?: string;
  llm_model?: string;
  sprite_folder?: string;
  is_user_facing?: boolean;
}
