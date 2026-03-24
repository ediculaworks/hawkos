'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createCharacter, updateCharacter } from './characters/character';
import { createPoring, updatePoring } from './characters/poring';
import { type DayNightOverlay, getDayNightOverlay } from './effects/day-night';
import { buildOfficeManifest, preloadAssets } from './engine/asset-loader';
import { createElevator, updateElevator } from './engine/elevator';
import { startGameLoop } from './engine/game-loop';
import { prerenderBackground, render } from './engine/renderer';
import {
  type AgentData,
  type Character,
  CharacterState,
  DAY_NIGHT_UPDATE_INTERVAL_MS,
  ELEVATOR_EXIT_COL,
  ELEVATOR_EXIT_ROW,
  type ElevatorEntity,
  ElevatorState,
  type FurnitureDef,
  GRID_COLS,
  GRID_ROWS,
  PORING_COUNT,
  type PoringEntity,
  type RoomId,
  type SeatDef,
  TILE_SIZE,
  type TileType,
  ZOOM,
} from './engine/types';
import { unlockAudio } from './sound/sound-manager';
import { useOfficeStore } from './store/office-store';
import {
  createCubicleFurniture,
  createCubicleSeats,
  createFurniture,
  createRoomMap,
  createSeats,
  createTileMap,
  getBlockedTiles,
} from './world/layout';
import { findPath, getWalkableTiles, getWalkableTilesInRoom } from './world/pathfinding';

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);

  // Game state refs
  const charactersRef = useRef<Character[]>([]);
  const poringsRef = useRef<PoringEntity[]>([]);
  const tileMapRef = useRef<TileType[][]>([]);
  const roomMapRef = useRef<(RoomId | null)[][]>([]);
  const furnitureRef = useRef<FurnitureDef[]>([]);
  const seatsRef = useRef<SeatDef[]>([]);
  const seatMapRef = useRef<Map<string, SeatDef>>(new Map());
  const blockedTilesRef = useRef<Set<string>>(new Set());
  const walkableTilesRef = useRef<{ col: number; row: number }[]>([]);
  const breakRoomTilesRef = useRef<{ col: number; row: number }[]>([]);
  const dayNightRef = useRef<DayNightOverlay | null>(null);
  const activeSessionsRef = useRef<Set<string>>(new Set());
  const elevatorRef = useRef<ElevatorEntity>(createElevator());

  const store = useOfficeStore;

  const agentCountRef = useRef(0);

  // ── Initialize world ──
  const initWorld = useCallback(
    (agentCount = 0) => {
      const tileMap = createTileMap();
      const roomMap = createRoomMap();
      const baseSeats = createSeats();
      const cubicleSeats = createCubicleSeats(agentCount);
      const seats = [...baseSeats, ...cubicleSeats];
      const baseFurniture = createFurniture();
      const cubicleFurniture = createCubicleFurniture(agentCount);
      const furniture = [...baseFurniture, ...cubicleFurniture];
      const blocked = getBlockedTiles(furniture);

      tileMapRef.current = tileMap;
      roomMapRef.current = roomMap;
      furnitureRef.current = furniture;
      seatsRef.current = seats;
      blockedTilesRef.current = blocked;
      agentCountRef.current = agentCount;

      const seatMap = new Map<string, SeatDef>();
      for (const s of seats) seatMap.set(s.id, s);
      seatMapRef.current = seatMap;

      walkableTilesRef.current = getWalkableTiles(tileMap, blocked);
      breakRoomTilesRef.current = [
        ...getWalkableTilesInRoom(tileMap, blocked, roomMap, 'lounge'),
        ...getWalkableTilesInRoom(tileMap, blocked, roomMap, 'kitchen'),
      ];

      const bgTheme = store.getState().backgroundTheme;
      prerenderBackground(tileMap, roomMap, bgTheme);
      dayNightRef.current = getDayNightOverlay() ?? null;
    },
    [store],
  );

  // ── Spawn characters from elevator ──
  const spawnCharacters = useCallback(
    (agents: AgentData[]) => {
      const seats = seatsRef.current;
      const characters: Character[] = [];
      let paletteIdx = 0;
      let delay = 1.0;

      const sorted = [...agents].sort((a, b) => {
        if (a.name === 'Hawk') return -1;
        if (b.name === 'Hawk') return 1;
        return a.name.localeCompare(b.name);
      });

      for (const agent of sorted) {
        const isHawk = agent.name === 'Hawk';
        const isActive = isHawk || activeSessionsRef.current.has(agent.id);

        let seat: SeatDef | null = null;
        if (isHawk) {
          seat = seats.find((s) => s.id === 'hawk_seat') ?? null;
        } else if (isActive) {
          const usedSeats = new Set(characters.map((c) => c.seatId));
          seat = seats.find((s) => s.room === 'open_office' && !usedSeats.has(s.id)) ?? null;
        }

        const ch = createCharacter(agent, seat, paletteIdx % 6, isActive || isHawk);

        // Start at elevator exit, invisible, with delay
        const exitPos = tileCenter(ELEVATOR_EXIT_COL, ELEVATOR_EXIT_ROW);
        ch.x = exitPos.x;
        ch.y = exitPos.y;
        ch.tileCol = ELEVATOR_EXIT_COL;
        ch.tileRow = ELEVATOR_EXIT_ROW;
        ch.visible = false;
        ch.arrivalDelay = delay;
        ch.state = CharacterState.ARRIVE;

        characters.push(ch);
        paletteIdx++;
        delay += 1.5;
      }

      charactersRef.current = characters;
      store.getState().setCharacters(characters);
    },
    [store],
  );

  // ── Spawn porings ──
  const spawnPorings = useCallback(() => {
    const walkable = walkableTilesRef.current;
    const porings: PoringEntity[] = [];
    for (let i = 0; i < PORING_COUNT; i++) {
      const tile = walkable[Math.floor(Math.random() * walkable.length)];
      if (tile) {
        porings.push(createPoring(i, tile.col, tile.row));
      }
    }
    poringsRef.current = porings;
    store.getState().setPorings(porings);
  }, [store]);

  // ── Hit testing ──
  const hitTest = useCallback(
    (canvasX: number, canvasY: number): { agentId: string | null; isElevator: boolean } => {
      const z = ZOOM;
      const worldX = canvasX / z;
      const worldY = canvasY / z;

      // Check characters
      for (let i = charactersRef.current.length - 1; i >= 0; i--) {
        const ch = charactersRef.current[i]!;
        if (!ch.visible) continue;
        const hitW = 8;
        const hitH = 24;
        if (
          worldX >= ch.x - hitW &&
          worldX <= ch.x + hitW &&
          worldY >= ch.y - hitH &&
          worldY <= ch.y + 4
        ) {
          return { agentId: ch.agentId, isElevator: false };
        }
      }

      // Check elevator (2x3 tiles at col 30, row 14)
      const elev = elevatorRef.current;
      if (
        worldX >= elev.x &&
        worldX <= elev.x + 2 * TILE_SIZE &&
        worldY >= elev.y &&
        worldY <= elev.y + 3 * TILE_SIZE
      ) {
        return { agentId: null, isElevator: true };
      }

      return { agentId: null, isElevator: false };
    },
    [],
  );

  // ── Canvas event handlers ──
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const { agentId } = hitTest(cx, cy);
      store.getState().hoverAgent(agentId, { x: e.clientX, y: e.clientY });
    },
    [hitTest, store],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      unlockAudio();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const { agentId, isElevator } = hitTest(cx, cy);

      if (agentId) {
        // Check if it's Hawk — open command panel instead of detail popup
        const agents = store.getState().agents;
        const agent = agents.find((a) => a.id === agentId);
        if (agent?.name === 'Hawk') {
          store.getState().openHawkCommand();
        } else {
          // Compute popup position from canvas coords
          const popupX = e.clientX;
          const popupY = e.clientY - 100; // Above the click point
          store.getState().selectAgent(agentId, { x: popupX, y: popupY });
        }
      } else if (isElevator) {
        store.getState().openHiringWizard();
      } else {
        store.getState().selectAgent(null);
        store.getState().closeHawkCommand();
      }
    },
    [hitTest, store],
  );

  // ── Main effect: init + game loop ──
  // biome-ignore lint/correctness/useExhaustiveDependencies: Init runs once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = GRID_COLS * TILE_SIZE * ZOOM;
    const h = GRID_ROWS * TILE_SIZE * ZOOM;
    canvas.width = w;
    canvas.height = h;

    initWorld(0);

    const manifest = buildOfficeManifest();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    preloadAssets(manifest).then(() => {
      store.getState().setAssetsLoaded(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      fetch('/api/agents', { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          clearTimeout(timeoutId);
          const agents: AgentData[] = (data.agents ?? []).filter(
            (a: AgentData) => a.is_user_facing !== false,
          );
          // Reinit world with correct agent count for cubicles
          initWorld(agents.length);
          const bgTheme = store.getState().backgroundTheme;
          prerenderBackground(tileMapRef.current, roomMapRef.current, bgTheme);

          store.getState().setAgents(agents);
          spawnCharacters(agents);
          spawnPorings();
          store.getState().setLoading(false);

          const storeState = store.getState;
          stopLoopRef.current = startGameLoop(canvas, {
            update(dt) {
              const tileMap = tileMapRef.current;
              const blocked = blockedTilesRef.current;
              const walkable = walkableTilesRef.current;
              const breakRoom = breakRoomTilesRef.current;
              const seatMap = seatMapRef.current;
              const elevator = elevatorRef.current;
              const chars = charactersRef.current;
              const furniture = furnitureRef.current;

              // Process arrival delays → queue into elevator
              for (const ch of chars) {
                if (!ch.visible && ch.arrivalDelay > 0) {
                  ch.arrivalDelay -= dt;
                  if (ch.arrivalDelay <= 0) {
                    elevator.queuedAgents.push(ch.id);
                    if (elevator.state === ElevatorState.CLOSED) {
                      elevator.state = ElevatorState.OPENING;
                      elevator.animTimer = 0;
                    }
                  }
                }
              }

              // Update elevator
              updateElevator(elevator, dt, chars, tileMap, blocked, seatMap);

              // Compute occupied tiles for collision avoidance
              const occupied = new Set(
                chars.filter((c) => c.visible).map((c) => `${c.tileCol},${c.tileRow}`),
              );
              const roomMap = roomMapRef.current;

              // Update visible characters
              for (const ch of chars) {
                if (!ch.visible) continue;
                updateCharacter(
                  ch,
                  dt,
                  walkable,
                  breakRoom,
                  seatMap,
                  tileMap,
                  blocked,
                  chars,
                  furniture,
                  roomMap,
                  occupied,
                );
              }

              // Update porings
              for (const p of poringsRef.current) {
                updatePoring(p, dt, walkable, tileMap, blocked);
              }
            },
            render(ctx) {
              render(
                ctx,
                tileMapRef.current,
                furnitureRef.current,
                charactersRef.current,
                poringsRef.current,
                elevatorRef.current,
                storeState().hoveredAgentId,
                storeState().selectedAgentId,
                dayNightRef.current,
                agentCountRef.current,
              );
            },
          });
        })
        .catch(() => {
          store.getState().setLoading(false);
        });
    });

    const dayNightInterval = setInterval(() => {
      dayNightRef.current = getDayNightOverlay() ?? null;
    }, DAY_NIGHT_UPDATE_INTERVAL_MS);

    return () => {
      stopLoopRef.current?.();
      clearInterval(dayNightInterval);
      clearTimeout(timeoutId);
    };
  }, [initWorld, spawnCharacters, spawnPorings, store, hitTest]);

  // ── Sync active sessions ──
  const activeSessions = useOfficeStore((s) => s.activeSessions);
  useEffect(() => {
    activeSessionsRef.current = activeSessions;
    for (const ch of charactersRef.current) {
      if (!ch.visible) continue;
      const wasActive = ch.isActive;
      const isHawk = ch.name === 'Hawk';
      ch.isActive = isHawk || activeSessions.has(ch.agentId);

      if (!wasActive && ch.isActive && !isHawk) {
        const usedSeats = new Set(
          charactersRef.current.filter((c) => c.isActive && c.seatId).map((c) => c.seatId),
        );
        const freeSeat = seatsRef.current.find(
          (s) => s.room === 'open_office' && !usedSeats.has(s.id),
        );
        if (freeSeat) {
          ch.seatId = freeSeat.id;
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            freeSeat.col,
            freeSeat.row,
            tileMapRef.current,
            blockedTilesRef.current,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
          }
        }
      }
    }
  }, [activeSessions]);

  // ── Sync activated agents from Hawk delegation ──
  const activatedAgentIds = useOfficeStore((s) => s.activatedAgentIds);
  useEffect(() => {
    for (const agentId of activatedAgentIds) {
      const ch = charactersRef.current.find((c) => c.agentId === agentId);
      if (!ch || ch.isActive) continue;

      ch.isActive = true;
      const usedSeats = new Set(
        charactersRef.current.filter((c) => c.isActive && c.seatId).map((c) => c.seatId),
      );
      const freeSeat = seatsRef.current.find(
        (s) => s.room === 'open_office' && !usedSeats.has(s.id),
      );
      if (freeSeat) {
        ch.seatId = freeSeat.id;
        const path = findPath(
          ch.tileCol,
          ch.tileRow,
          freeSeat.col,
          freeSeat.row,
          tileMapRef.current,
          blockedTilesRef.current,
        );
        if (path.length > 0) {
          ch.path = path;
          ch.moveProgress = 0;
          ch.state = CharacterState.WALK;
          ch.frame = 0;
          ch.frameTimer = 0;
        }
      }
      ch.bubbleText = 'Recebido!';
      ch.bubbleTimer = 3.0;
    }
  }, [activatedAgentIds]);

  const loading = useOfficeStore((s) => s.loading);
  const hoveredAgentId = useOfficeStore((s) => s.hoveredAgentId);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#111122] overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#111122]">
          <div className="text-[var(--color-text-primary)] text-lg font-mono mb-4">
            Carregando Hawk Office...
          </div>
          <div className="w-48 h-2 bg-[var(--color-surface-2)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] animate-pulse rounded"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Canvas game, no keyboard navigation */}
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full"
        style={{
          imageRendering: 'pixelated',
          cursor: hoveredAgentId ? 'pointer' : 'default',
        }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
    </div>
  );
}
