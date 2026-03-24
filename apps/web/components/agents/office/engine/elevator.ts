import { findPath } from '../world/pathfinding';
import {
  type Character,
  CharacterState,
  ELEVATOR_CLOSING_DURATION,
  ELEVATOR_COL,
  ELEVATOR_EXIT_COL,
  ELEVATOR_EXIT_ROW,
  ELEVATOR_OPENING_DURATION,
  ELEVATOR_OPEN_HOLD_MIN,
  ELEVATOR_ROW,
  ELEVATOR_SPAWN_GAP,
  type ElevatorEntity,
  ElevatorState,
  TILE_SIZE,
} from './types';
import type { SeatDef, TileType } from './types';

const ARRIVAL_PHRASES = [
  'Bom dia!',
  'Chegando!',
  'Pronto pra trabalhar!',
  'Opa!',
  'Fala galera!',
  'Reporting in!',
  'Lets go!',
  'Presente!',
];

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

export function createElevator(): ElevatorEntity {
  return {
    x: ELEVATOR_COL * TILE_SIZE,
    y: ELEVATOR_ROW * TILE_SIZE,
    tileCol: ELEVATOR_COL,
    tileRow: ELEVATOR_ROW,
    state: ElevatorState.CLOSED,
    animTimer: 0,
    doorOffset: 0,
    holdTimer: 0,
    queuedAgents: [],
    spawnCooldown: 0,
  };
}

export function updateElevator(
  elev: ElevatorEntity,
  dt: number,
  characters: Character[],
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  seats: Map<string, SeatDef>,
): void {
  switch (elev.state) {
    case ElevatorState.CLOSED: {
      // Check if any characters need to emerge
      if (elev.queuedAgents.length > 0) {
        elev.state = ElevatorState.OPENING;
        elev.animTimer = 0;
      }
      break;
    }

    case ElevatorState.OPENING: {
      elev.animTimer += dt;
      elev.doorOffset = Math.min(elev.animTimer / ELEVATOR_OPENING_DURATION, 1);

      if (elev.animTimer >= ELEVATOR_OPENING_DURATION) {
        elev.state = ElevatorState.OPEN;
        elev.doorOffset = 1;
        elev.holdTimer = ELEVATOR_OPEN_HOLD_MIN;
        elev.spawnCooldown = 0.3; // Small delay before first agent
      }
      break;
    }

    case ElevatorState.OPEN: {
      // Spawn agents from queue
      if (elev.queuedAgents.length > 0) {
        elev.spawnCooldown -= dt;
        if (elev.spawnCooldown <= 0) {
          const agentId = elev.queuedAgents.shift()!;
          const ch = characters.find((c) => c.id === agentId);
          if (ch) {
            // Make visible and start walking
            ch.visible = true;
            const exitPos = tileCenter(ELEVATOR_EXIT_COL, ELEVATOR_EXIT_ROW);
            ch.x = exitPos.x;
            ch.y = exitPos.y;
            ch.tileCol = ELEVATOR_EXIT_COL;
            ch.tileRow = ELEVATOR_EXIT_ROW;

            // Find path to assigned seat or break room
            if (ch.seatId) {
              const seat = seats.get(ch.seatId);
              if (seat) {
                const path = findPath(
                  ch.tileCol,
                  ch.tileRow,
                  seat.col,
                  seat.row,
                  tileMap,
                  blockedTiles,
                );
                if (path.length > 0) {
                  ch.path = path;
                  ch.moveProgress = 0;
                  ch.state = CharacterState.ARRIVE;
                  ch.frame = 0;
                  ch.frameTimer = 0;
                }
              }
            } else {
              // Walk to a random spot in break room or hallway
              const targetCol = 8 + Math.floor(Math.random() * 6);
              const targetRow = 18 + Math.floor(Math.random() * 6);
              const path = findPath(
                ch.tileCol,
                ch.tileRow,
                targetCol,
                targetRow,
                tileMap,
                blockedTiles,
              );
              if (path.length > 0) {
                ch.path = path;
                ch.moveProgress = 0;
                ch.state = CharacterState.ARRIVE;
                ch.frame = 0;
                ch.frameTimer = 0;
              }
            }

            // Arrival bubble
            ch.bubbleText =
              ARRIVAL_PHRASES[Math.floor(Math.random() * ARRIVAL_PHRASES.length)] ?? 'Opa!';
            ch.bubbleTimer = 3.0;
          }
          elev.spawnCooldown = ELEVATOR_SPAWN_GAP;
          elev.holdTimer = ELEVATOR_OPEN_HOLD_MIN; // Reset hold timer
        }
      } else {
        // No more agents — count down hold timer
        elev.holdTimer -= dt;
        if (elev.holdTimer <= 0) {
          elev.state = ElevatorState.CLOSING;
          elev.animTimer = 0;
        }
      }
      break;
    }

    case ElevatorState.CLOSING: {
      elev.animTimer += dt;
      elev.doorOffset = Math.max(1 - elev.animTimer / ELEVATOR_CLOSING_DURATION, 0);

      if (elev.animTimer >= ELEVATOR_CLOSING_DURATION) {
        elev.state = ElevatorState.CLOSED;
        elev.doorOffset = 0;
        elev.animTimer = 0;
      }
      break;
    }
  }
}
