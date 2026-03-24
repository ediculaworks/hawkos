import {
  type AgentData,
  BUBBLE_COOLDOWN_MAX_SEC,
  BUBBLE_COOLDOWN_MIN_SEC,
  BUBBLE_SHOW_DURATION_SEC,
  CHAT_DURATION_MAX,
  CHAT_DURATION_MIN,
  COFFEE_BREW_DURATION,
  COFFEE_WALK_DURATION,
  type Character,
  CharacterState,
  Direction,
  type FurnitureDef,
  IDLE_ACTIVITY_CHANCE,
  IdleActivity,
  LOOK_ART_DURATION,
  NAP_DURATION_MAX,
  NAP_DURATION_MIN,
  READ_DURATION_MAX,
  READ_DURATION_MIN,
  SIT_SOFA_DURATION_MAX,
  SIT_SOFA_DURATION_MIN,
  type SeatDef,
  TILE_SIZE,
  TYPE_FRAME_DURATION_SEC,
  type TileCoord,
  type TileType,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
  WANDER_MOVES_BEFORE_REST_MAX,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
} from '../engine/types';
import { ART_SPOTS, COFFEE_SPOT, READ_SPOTS } from '../world/layout';
import { findPath } from '../world/pathfinding';

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
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

/** Create a character from agent data */
export function createCharacter(
  agent: AgentData,
  seat: SeatDef | null,
  palette: number,
  isActive: boolean,
): Character {
  const col = seat ? seat.col : 20;
  const row = seat ? seat.row : 14;
  const center = tileCenter(col, row);

  return {
    id: `char_${agent.id}`,
    agentId: agent.id,
    name: agent.name,
    tier: agent.agent_tier ?? 'specialist',
    state: isActive && seat ? CharacterState.WORK : CharacterState.IDLE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    palette,
    hueShift: hashToHueShift(agent.name),
    frame: 0,
    frameTimer: 0,
    wanderTimer: randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC),
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    seatId: seat?.id ?? null,
    seatTimer: 0,
    isActive,
    bubbleText: null,
    bubbleTimer: 0,
    bubbleCooldown: randomRange(5, 15),
    phrases: agent.traits ?? [],
    // Idle activity
    idleActivity: IdleActivity.NONE,
    idleActivityTimer: 0,
    chatPartnerId: null,
    // Elevator
    arrivalDelay: 0,
    visible: true,
  };
}

function hashToHueShift(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

// ── Phrases ──
const WORK_PHRASES = [
  'Analisando...',
  'Processando...',
  'Digitando...',
  'Trabalhando...',
  'Verificando dados...',
  'Compilando...',
  'Otimizando...',
  'Pensando...',
];
const IDLE_PHRASES = [
  'Descansando...',
  'Que dia...',
  'Hmm...',
  'Bom trabalho!',
  'Intervalo!',
  '*bocejo*',
];
const HAWK_PHRASES = [
  'Tudo sob controle.',
  'Supervisionando...',
  'Sistemas nominais.',
  'Bom trabalho, equipe.',
  'Monitorando...',
  'Status: OK.',
];
const COFFEE_PHRASES = ['Fazendo cafe...', 'Esperando...', 'Quase pronto!'];
const COFFEE_WALK_PHRASES = ['*toma cafe*', 'Bom cafe...', 'Ahhh...', 'Cafe!'];
const CHAT_PHRASES = [
  'Ja viu o relatorio?',
  'Concordo!',
  'Boa ideia!',
  'E ai?',
  'Que legal!',
  'Serio?!',
  'Haha',
  'Pois e...',
  'Vamos almocar?',
  'Ta ocupado?',
  'Me conta mais',
  'Hmm...',
  'Entendi!',
  'Opa!',
  'Demais!',
];
const READ_PHRASES = ['Interessante...', 'Hmm...', 'Aprendendo...', 'Legal!'];
const ART_PHRASES = ['Bonito...', 'Arte...', 'Hmm, interessante', 'Legal!'];
const NAP_PHRASES = ['*bocejo*', 'Que sonho...', 'Hm? Ah...'];

// ── Activity Selection ──

function pickIdleActivity(
  ch: Character,
  allCharacters: Character[],
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  seats: Map<string, SeatDef>,
): { activity: IdleActivity; targetCol: number; targetRow: number; facingDir?: Direction } | null {
  if (Math.random() > IDLE_ACTIVITY_CHANCE) return null;

  const roll = Math.random();
  const weights = [
    { activity: IdleActivity.SIT_SOFA, threshold: 0.25 },
    { activity: IdleActivity.DRINK_COFFEE, threshold: 0.45 },
    { activity: IdleActivity.CHAT, threshold: 0.65 },
    { activity: IdleActivity.READ, threshold: 0.8 },
    { activity: IdleActivity.NAP, threshold: 0.9 },
    { activity: IdleActivity.LOOK_ART, threshold: 1.0 },
  ];

  for (const w of weights) {
    if (roll >= w.threshold) continue;

    switch (w.activity) {
      case IdleActivity.SIT_SOFA: {
        // Find a free sofa seat
        const sofaSeats = ['sofa_1', 'sofa_2', 'sofa_3'];
        const occupied = new Set(
          allCharacters
            .filter(
              (c) =>
                c.id !== ch.id &&
                c.idleActivity === IdleActivity.SIT_SOFA &&
                c.state === CharacterState.REST,
            )
            .map((c) => c.seatId),
        );
        const free = sofaSeats.find((s) => !occupied.has(s));
        if (!free) return null;
        const seat = seats.get(free);
        if (!seat) return null;
        return {
          activity: IdleActivity.SIT_SOFA,
          targetCol: seat.col,
          targetRow: seat.row,
          facingDir: seat.facingDir,
        };
      }

      case IdleActivity.DRINK_COFFEE: {
        return {
          activity: IdleActivity.DRINK_COFFEE,
          targetCol: COFFEE_SPOT.col,
          targetRow: COFFEE_SPOT.row,
          facingDir: COFFEE_SPOT.facingDir,
        };
      }

      case IdleActivity.CHAT: {
        // Find another idle character nearby (not already chatting)
        const candidates = allCharacters.filter(
          (c) =>
            c.id !== ch.id &&
            c.state === CharacterState.IDLE &&
            c.idleActivity === IdleActivity.NONE &&
            c.visible,
        );
        if (candidates.length === 0) return null;
        const partner = candidates[Math.floor(Math.random() * candidates.length)]!;
        // Go to a tile adjacent to the partner
        const adjTiles = [
          { col: partner.tileCol + 1, row: partner.tileRow },
          { col: partner.tileCol - 1, row: partner.tileRow },
          { col: partner.tileCol, row: partner.tileRow + 1 },
          { col: partner.tileCol, row: partner.tileRow - 1 },
        ];
        for (const adj of adjTiles) {
          const path = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, tileMap, blockedTiles);
          if (path.length > 0) {
            // Set up both characters for chat
            ch.chatPartnerId = partner.id;
            partner.chatPartnerId = ch.id;
            partner.idleActivity = IdleActivity.CHAT;
            partner.idleActivityTimer = randomRange(CHAT_DURATION_MIN, CHAT_DURATION_MAX);
            return { activity: IdleActivity.CHAT, targetCol: adj.col, targetRow: adj.row };
          }
        }
        return null;
      }

      case IdleActivity.READ: {
        const spot = READ_SPOTS[Math.floor(Math.random() * READ_SPOTS.length)]!;
        return {
          activity: IdleActivity.READ,
          targetCol: spot.col,
          targetRow: spot.row,
          facingDir: spot.facingDir,
        };
      }

      case IdleActivity.NAP: {
        // Check no one is already napping
        const napping = allCharacters.some(
          (c) =>
            c.id !== ch.id &&
            c.idleActivity === IdleActivity.NAP &&
            c.state === CharacterState.REST,
        );
        if (napping) return null;
        const sofaSeats = ['sofa_1', 'sofa_2', 'sofa_3'];
        const occupied = new Set(
          allCharacters
            .filter((c) => c.id !== ch.id && c.state === CharacterState.REST)
            .map((c) => c.seatId),
        );
        const free = sofaSeats.find((s) => !occupied.has(s));
        if (!free) return null;
        const seat = seats.get(free);
        if (!seat) return null;
        return {
          activity: IdleActivity.NAP,
          targetCol: seat.col,
          targetRow: seat.row,
          facingDir: seat.facingDir,
        };
      }

      case IdleActivity.LOOK_ART: {
        const spot = ART_SPOTS[Math.floor(Math.random() * ART_SPOTS.length)]!;
        return {
          activity: IdleActivity.LOOK_ART,
          targetCol: spot.col,
          targetRow: spot.row,
          facingDir: spot.facingDir,
        };
      }
    }
    break;
  }

  return null;
}

// ── Update ──

export function updateCharacter(
  ch: Character,
  dt: number,
  walkableTiles: TileCoord[],
  breakRoomTiles: TileCoord[],
  seats: Map<string, SeatDef>,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  allCharacters: Character[],
  _furniture: FurnitureDef[],
  roomMap: (string | null)[][],
  occupiedTiles: Set<string>,
): void {
  // Filter out hawk's office for non-Hawk characters
  const isHawk = ch.name === 'Hawk';
  const safeWalkable = isHawk
    ? walkableTiles
    : walkableTiles.filter((t) => roomMap[t.row]?.[t.col] !== 'hawks_office');
  const safeBreakRoom = breakRoomTiles.filter(
    (t) =>
      !occupiedTiles.has(`${t.col},${t.row}`) ||
      `${t.col},${t.row}` === `${ch.tileCol},${ch.tileRow}`,
  );
  ch.frameTimer += dt;

  // Update speech bubble
  if (ch.bubbleTimer > 0) {
    ch.bubbleTimer -= dt;
    if (ch.bubbleTimer <= 0) {
      ch.bubbleText = null;
      ch.bubbleCooldown = randomRange(BUBBLE_COOLDOWN_MIN_SEC, BUBBLE_COOLDOWN_MAX_SEC);
    }
  } else if (ch.bubbleCooldown > 0 && ch.idleActivity !== IdleActivity.NAP) {
    ch.bubbleCooldown -= dt;
    if (ch.bubbleCooldown <= 0) {
      ch.bubbleText = getPhrase(ch);
      ch.bubbleTimer = BUBBLE_SHOW_DURATION_SEC;
    }
  }

  switch (ch.state) {
    case CharacterState.WORK: {
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 2;
      }
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt;
          break;
        }
        ch.state = CharacterState.IDLE;
        ch.frame = 0;
        ch.frameTimer = 0;
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        ch.wanderCount = 0;
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
      }
      break;
    }

    case CharacterState.IDLE: {
      ch.frame = 0;

      // If became active, go to desk
      if (ch.isActive && ch.seatId) {
        const seat = seats.get(ch.seatId);
        if (seat) {
          ch.idleActivity = IdleActivity.NONE;
          ch.chatPartnerId = null;
          const path = findPath(ch.tileCol, ch.tileRow, seat.col, seat.row, tileMap, blockedTiles);
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
          } else {
            ch.state = CharacterState.WORK;
            ch.dir = seat.facingDir;
          }
        }
        break;
      }

      // Chat partner waiting — just stay and face partner
      if (ch.idleActivity === IdleActivity.CHAT && ch.chatPartnerId) {
        const partner = allCharacters.find((c) => c.id === ch.chatPartnerId);
        if (
          partner &&
          partner.state === CharacterState.REST &&
          partner.idleActivity === IdleActivity.CHAT
        ) {
          // Partner arrived, we should transition too
          ch.dir = directionBetween(ch.tileCol, ch.tileRow, partner.tileCol, partner.tileRow);
          ch.state = CharacterState.REST;
          ch.idleActivityTimer = partner.idleActivityTimer;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
      }

      // Wander timer
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        // Try to pick an idle activity
        const activity = pickIdleActivity(ch, allCharacters, tileMap, blockedTiles, seats);
        if (activity) {
          ch.idleActivity = activity.activity;
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            activity.targetCol,
            activity.targetRow,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            if (activity.facingDir !== undefined) {
              ch.dir = activity.facingDir;
            }
          } else {
            ch.idleActivity = IdleActivity.NONE;
          }
        } else {
          // Default wander (filtered to exclude hawk's office + occupied)
          const targetTiles = safeBreakRoom.length > 0 ? safeBreakRoom : safeWalkable;
          if (targetTiles.length > 0) {
            const target = targetTiles[Math.floor(Math.random() * targetTiles.length)]!;
            const path = findPath(
              ch.tileCol,
              ch.tileRow,
              target.col,
              target.row,
              tileMap,
              blockedTiles,
            );
            if (path.length > 0) {
              ch.path = path;
              ch.moveProgress = 0;
              ch.state = CharacterState.WALK;
              ch.frame = 0;
              ch.frameTimer = 0;
              ch.wanderCount++;
            }
          }
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case CharacterState.WALK: {
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        const center = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = center.x;
        ch.y = center.y;

        if (ch.isActive && ch.seatId) {
          const seat = seats.get(ch.seatId);
          if (seat && ch.tileCol === seat.col && ch.tileRow === seat.row) {
            ch.state = CharacterState.WORK;
            ch.dir = seat.facingDir;
          } else {
            ch.state = CharacterState.IDLE;
          }
        } else {
          // Transition based on idle activity
          handleActivityArrival(ch, seats);
        }
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }

      // Move toward next tile
      const nextTile = ch.path[0]!;
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row);
      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

      const from = tileCenter(ch.tileCol, ch.tileRow);
      const to = tileCenter(nextTile.col, nextTile.row);
      const t = Math.min(ch.moveProgress, 1);
      ch.x = from.x + (to.x - from.x) * t;
      ch.y = from.y + (to.y - from.y) * t;

      if (ch.moveProgress >= 1) {
        ch.tileCol = nextTile.col;
        ch.tileRow = nextTile.row;
        ch.x = to.x;
        ch.y = to.y;
        ch.path.shift();
        ch.moveProgress = 0;
      }

      // If became active while wandering, repath to seat
      if (ch.isActive && ch.seatId) {
        ch.idleActivity = IdleActivity.NONE;
        const seat = seats.get(ch.seatId);
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1];
          if (!lastStep || lastStep.col !== seat.col || lastStep.row !== seat.row) {
            const newPath = findPath(
              ch.tileCol,
              ch.tileRow,
              seat.col,
              seat.row,
              tileMap,
              blockedTiles,
            );
            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }
          }
        }
      }
      break;
    }

    case CharacterState.REST: {
      // Animation based on activity
      if (
        ch.idleActivity === IdleActivity.DRINK_COFFEE ||
        ch.idleActivity === IdleActivity.SIT_SOFA ||
        ch.idleActivity === IdleActivity.READ
      ) {
        if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
          ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
          ch.frame = (ch.frame + 1) % 2;
        }
      }

      // Chat: alternate speech bubbles
      if (ch.idleActivity === IdleActivity.CHAT) {
        if (ch.bubbleTimer <= 0 && ch.bubbleCooldown <= 0) {
          ch.bubbleText = CHAT_PHRASES[Math.floor(Math.random() * CHAT_PHRASES.length)] ?? 'Hmm...';
          ch.bubbleTimer = 2.0;
          ch.bubbleCooldown = randomRange(2.0, 4.0);
        }
      }

      // Coffee: special bubble while brewing
      if (
        ch.idleActivity === IdleActivity.DRINK_COFFEE &&
        ch.idleActivityTimer > COFFEE_WALK_DURATION &&
        ch.bubbleTimer <= 0
      ) {
        ch.bubbleText =
          COFFEE_PHRASES[Math.floor(Math.random() * COFFEE_PHRASES.length)] ?? 'Cafe...';
        ch.bubbleTimer = 2.0;
      }

      ch.idleActivityTimer -= dt;
      if (ch.idleActivityTimer <= 0) {
        finishActivity(ch, allCharacters);
      }
      break;
    }

    case CharacterState.ARRIVE: {
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        ch.state = ch.isActive ? CharacterState.WORK : CharacterState.IDLE;
        ch.frame = 0;
        ch.frameTimer = 0;
        if (ch.seatId) {
          const seat = seats.get(ch.seatId);
          if (seat) ch.dir = seat.facingDir;
        }
        break;
      }

      const nextTile = ch.path[0]!;
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row);
      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

      const from = tileCenter(ch.tileCol, ch.tileRow);
      const to = tileCenter(nextTile.col, nextTile.row);
      const t = Math.min(ch.moveProgress, 1);
      ch.x = from.x + (to.x - from.x) * t;
      ch.y = from.y + (to.y - from.y) * t;

      if (ch.moveProgress >= 1) {
        ch.tileCol = nextTile.col;
        ch.tileRow = nextTile.row;
        ch.x = to.x;
        ch.y = to.y;
        ch.path.shift();
        ch.moveProgress = 0;
      }
      break;
    }
  }
}

// ── Activity arrival ──

function handleActivityArrival(ch: Character, seats: Map<string, SeatDef>): void {
  switch (ch.idleActivity) {
    case IdleActivity.SIT_SOFA: {
      ch.state = CharacterState.REST;
      ch.idleActivityTimer = randomRange(SIT_SOFA_DURATION_MIN, SIT_SOFA_DURATION_MAX);
      const sofaDir = getActivityFacingDir(ch, seats);
      if (sofaDir !== null) ch.dir = sofaDir;
      break;
    }
    case IdleActivity.DRINK_COFFEE: {
      ch.state = CharacterState.REST;
      ch.dir = COFFEE_SPOT.facingDir;
      ch.idleActivityTimer = COFFEE_BREW_DURATION + COFFEE_WALK_DURATION;
      break;
    }
    case IdleActivity.NAP: {
      ch.state = CharacterState.REST;
      ch.idleActivityTimer = randomRange(NAP_DURATION_MIN, NAP_DURATION_MAX);
      const napDir = getActivityFacingDir(ch, seats);
      if (napDir !== null) ch.dir = napDir;
      break;
    }
    case IdleActivity.CHAT: {
      ch.state = CharacterState.REST;
      ch.idleActivityTimer = randomRange(CHAT_DURATION_MIN, CHAT_DURATION_MAX);
      // Face toward chat partner
      if (ch.chatPartnerId) {
        // Will be handled when partner also arrives
      }
      break;
    }
    case IdleActivity.READ: {
      ch.state = CharacterState.REST;
      ch.dir = Direction.UP;
      ch.idleActivityTimer = randomRange(READ_DURATION_MIN, READ_DURATION_MAX);
      break;
    }
    case IdleActivity.LOOK_ART: {
      ch.state = CharacterState.REST;
      ch.dir = Direction.UP;
      ch.idleActivityTimer = LOOK_ART_DURATION;
      ch.bubbleText = ART_PHRASES[Math.floor(Math.random() * ART_PHRASES.length)] ?? 'Hmm...';
      ch.bubbleTimer = 3.0;
      break;
    }
    default: {
      ch.state = CharacterState.IDLE;
      ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    }
  }
}

function getActivityFacingDir(ch: Character, seats: Map<string, SeatDef>): Direction | null {
  // Check if we're at a sofa seat
  for (const [id, seat] of seats) {
    if (id.startsWith('sofa') && seat.col === ch.tileCol && seat.row === ch.tileRow) {
      return seat.facingDir;
    }
  }
  return null;
}

// ── Activity completion ──

function finishActivity(ch: Character, allCharacters: Character[]): void {
  // Clean up chat partner
  if (ch.idleActivity === IdleActivity.CHAT && ch.chatPartnerId) {
    const partner = allCharacters.find((c) => c.id === ch.chatPartnerId);
    if (partner) {
      partner.idleActivity = IdleActivity.NONE;
      partner.chatPartnerId = null;
      partner.state = CharacterState.IDLE;
      partner.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    }
  }

  // Nap wake-up phrase
  if (ch.idleActivity === IdleActivity.NAP) {
    ch.bubbleText = NAP_PHRASES[Math.floor(Math.random() * NAP_PHRASES.length)] ?? '*bocejo*';
    ch.bubbleTimer = 2.5;
  }

  ch.idleActivity = IdleActivity.NONE;
  ch.chatPartnerId = null;
  ch.state = CharacterState.IDLE;
  ch.frame = 0;
  ch.frameTimer = 0;
  ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
}

// ── Phrase selection ──

function getPhrase(ch: Character): string {
  if (ch.name === 'Hawk') {
    return HAWK_PHRASES[Math.floor(Math.random() * HAWK_PHRASES.length)] ?? 'Supervisionando...';
  }
  if (ch.state === CharacterState.WORK) {
    return WORK_PHRASES[Math.floor(Math.random() * WORK_PHRASES.length)] ?? 'Trabalhando...';
  }
  if (ch.idleActivity === IdleActivity.DRINK_COFFEE) {
    return COFFEE_WALK_PHRASES[Math.floor(Math.random() * COFFEE_WALK_PHRASES.length)] ?? 'Cafe!';
  }
  if (ch.idleActivity === IdleActivity.READ) {
    return READ_PHRASES[Math.floor(Math.random() * READ_PHRASES.length)] ?? 'Hmm...';
  }
  if (ch.phrases.length > 0 && Math.random() > 0.5) {
    return ch.phrases[Math.floor(Math.random() * ch.phrases.length)] ?? 'Hmm...';
  }
  return IDLE_PHRASES[Math.floor(Math.random() * IDLE_PHRASES.length)] ?? 'Descansando...';
}
