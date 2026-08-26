'use strict';

// ============================================================================
// Slither-accurate Game Engine — TEST MODE
// ============================================================================
// Implements slither.io-accurate movement, food, and camera formulas.
// Outputs to the same Snake/FoodOrb/GameState types so existing renderers work.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, SkinRarity, FoodSize,
} from './types';
import { PathBuffer } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { checkCollisions, type KillEvent } from './collision';
import {
  updateAllBotAI, getBotBoost, spawnBots, respawnDeadBots, removeBot,
  BOT_TYPE_COLORS, type BotType, type BotSpawnConfig,
} from './bot-ai';
import {
  getArenaConfig,
  SPAWN_PROTECTION_MS,
  SPATIAL_CELL_SIZE,
} from './config';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  pattern?: any;
  animation?: any;
  rarity: SkinRarity;
}

// ─── Slither.io Movement Constants ──────────────────────────────────────────

const NSP1 = 8.5;       // base speed
const NSP2 = 1.0;       // speed per scale unit
const NSP3 = 24;        // initial boost speed
const BOOST_MAX = 44;   // max boost speed
const BOOST_ACCEL = 0.08; // boost ramp rate per second
const MAMU = 0.066;     // turn rate multiplier
const SPANGDV = 9.6;    // speed divisor for turn angle penalty
const MSL = 42;         // max movement per tick (dist cap)
const FOOD_SECTOR_SIZE = 480;
const FOOD_PER_SECTOR = 3;
const FOOD_MAX_COUNT = 4500;
const BOOST_MIN_SCORE = 10;
const EAT_RADIUS = 63.0; // base eat radius (multiplied by sc)
const VFR = 1.0;         // virtual frame rate divisor (1 for 60fps ticks)

// ─── Score-to-SCT Lookup Tables (slither.io) ────────────────────────────────
// MSCPS = 411 (max score cap for sct calculation)

const MSCPS = 411;

// fmlts[i] = score at SCT index i
const fmlts: number[] = new Array(MSCPS);
// fpsls[i] = length at SCT index i
const fpsls: number[] = new Array(MSCPS);

(function buildLookups() {
  fmlts[0] = 0;
  for (let i = 1; i < MSCPS; i++) {
    fmlts[i] = Math.floor(fmlts[i - 1] + Math.pow(i, 2.25) * 0.445);
  }
  fpsls[0] = 4;
  for (let i = 1; i < MSCPS; i++) {
    fpsls[i] = fpsls[i - 1] + 1;
  }
})();

function scoreToSctFam(score: number): number {
  if (score <= 2) return 1;
  for (let i = MSCPS - 1; i >= 0; i--) {
    if (fmlts[i] <= score) return i + 1;
  }
  return 1;
}

function sctToScale(sct: number): number {
  return Math.min(6.0, 1.0 + (sct - 2) / 106);
}

function scoreToScale(score: number): number {
  return sctToScale(scoreToSctFam(score));
}

function scoreToBodyLength(score: number): number {
  const sct = scoreToSctFam(score);
  return sct < fpsls.length ? fpsls[sct] : fpsls[fpsls.length - 1] + (sct - fpsls.length + 1);
}

function scoreToBodyRadius(score: number): number {
  const sc = scoreToScale(score);
  return sc * 6 + 3;
}

// ─── Food Colors (slither.io palette) ────────────────────────────────────────

export const SLITHER_FOOD_COLORS = [
  '#ff3b3b', '#ff6b3b', '#ffcf3b', '#3bff6b', '#3bffff',
  '#3b6bff', '#a03bff', '#ff3ba0', '#ff3b6b', '#6bff3b',
  '#ffff3b', '#3b3bff', '#ff3bff', '#ffffff', '#c0c0c0',
];

export const SLITHER_FOOD_GLOW_COLORS = [
  '#ff1a1a', '#ff4f1a', '#ffb81a', '#1aff4f', '#1affff',
  '#1a4fff', '#8b1aff', '#ff1a8b', '#ff1a4f', '#4fff1a',
  '#ffff1a', '#1a1aff', '#ff1aff', '#e0e0e0', '#a0a0a0',
];

// ─── Snake Palettes ──────────────────────────────────────────────────────────

const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<FoodSize> = ['small', 'medium', 'large'];

// ─── Module-level singletons ─────────────────────────────────────────────────

const foodHash = new SpatialHash(SPATIAL_CELL_SIZE);
const bodyHash = new SpatialHash(SPATIAL_CELL_SIZE);
const headHash = new SpatialHash(SPATIAL_CELL_SIZE);

// ─── Food Roaming State (side Map) ───────────────────────────────────────────

interface FoodRoamState {
  ang: number;      // current roaming angle
  gfr: number;      // glow frame counter
  rx: number;       // rendered x (roaming offset from base)
  ry: number;       // rendered y
  baseX: number;    // base food position (for collision)
  baseY: number;
}

export const foodRoamMap = new Map<number, FoodRoamState>();

// ─── Sector-based Food Spatial Hash ─────────────────────────────────────────

function sectorKey(sx: number, sy: number): number {
  return ((sy + 32768) << 16) | ((sx + 32768) & 0xFFFF);
}

const sectorFoodHash = new Map<number, FoodOrb[]>();

// ─── Move Context ────────────────────────────────────────────────────────────

interface SlitherMoveContext {
  foods: FoodOrb[];
  nextFoodId: { value: number };
  mapHalf: number;
  boundaryRadius: number;
  vfr: number;
}

// ─── Pre-allocated scratch ───────────────────────────────────────────────────

const _foodHashScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
const _cachedFoodById = new Map<number, FoodOrb>();
const _eatenIdsSet = new Set<number>();
const _gridCounts = new Int32Array(144);

// ==========================================================================
// Snake Creation
// ==========================================================================

function createSnake(
  id: string, name: string, startScore: number,
  posX: number, posY: number, now: number,
  skinOverride?: PlayerSkinOverride | null,
  botType?: BotType,
): Snake {
  const targetLength = scoreToBodyLength(startScore);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  const angle = 0;

  const pathTarget = Math.max(Math.ceil(targetLength * 2), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));
  path.resetTo(posX, posY);
  // Slither.io initial speed-based spacing for path
  const sct = scoreToSctFam(startScore);
  const sc = sctToScale(sct);
  const ssp = NSP1 + NSP2 * sc;
  const spacing = Math.max(ssp / 4, 1);
  for (let i = 1; i < pathTarget; i++) {
    const x = posX - Math.cos(angle) * i * spacing;
    const y = posY - Math.sin(angle) * i * spacing;
    path.appendTail(x, y);
  }

  let color: string;
  let headColor: string;
  if (skinOverride) {
    color = skinOverride.bodyColor;
    headColor = skinOverride.headColor;
  } else if (botType && BOT_TYPE_COLORS[botType]) {
    [color, headColor] = BOT_TYPE_COLORS[botType];
  } else {
    color = palette[0];
    headColor = palette[1];
  }
  const skinId = skinOverride ? skinOverride.skinId : 'skin-default';
  const rarity = skinOverride ? skinOverride.rarity : 'common' as SkinRarity;
  const bodyRadius = scoreToBodyRadius(startScore);

  return {
    id, name, path, angle, prevAngle: angle,
    speed: NSP1, score: startScore,
    boosting: false, alive: true, isBot: false, isPlayer: true,
    spawnTime: now, color, headColor,
    lastBoostDrop: 0, targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius,
    cachedBodyLength: targetLength,
    cachedBodyScore: startScore,
    cachedVisualTailIdx: 0,
    skinId, rarity,
    prevHeadX: posX, prevHeadY: posY, smoothBrakeFactor: 1.0,
    carriedChips: 0,
  };
}

// ==========================================================================
// Safe Spawn
// ==========================================================================

function findSafeSpawn(
  snakes: Map<string, Snake>,
  nearX: number, nearY: number,
  spawnRadius: number = 29000,
  safeDist: number = 300,
  attempts: number = 50,
): { x: number; y: number } {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 200 + Math.random() * (spawnRadius - 200);
    const x = nearX + Math.cos(a) * d;
    const y = nearY + Math.sin(a) * d;
    let safe = true;
    const safeDistSq = safeDist * safeDist;
    for (const [, snake] of snakes) {
      if (!snake.alive) continue;
      const dx = snake.path.headX - x;
      const dy = snake.path.headY - y;
      if (dx * dx + dy * dy < safeDistSq) { safe = false; break; }
    }
    if (safe) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  return { x: nearX + Math.cos(a) * spawnRadius, y: nearY + Math.sin(a) * spawnRadius };
}

// ==========================================================================
// Snake Movement (slither.io formulas)
// ==========================================================================

function moveSnake(
  snake: Snake, targetAngle: number, wantBoost: boolean,
  now: number, ctx: SlitherMoveContext, boostTimeRef: Map<string, number>,
): boolean {
  snake.targetAngle = targetAngle;
  snake.prevAngle = snake.angle;

  // ── Speed calculation ──
  const sct = scoreToSctFam(snake.score);
  const sc = sctToScale(sct);
  const ssp = NSP1 + NSP2 * sc; // normal speed

  const canBoost = wantBoost && snake.score >= BOOST_MIN_SCORE;

  let sp: number;
  if (canBoost) {
    // Boost: ramp from NSP3 to BOOST_MAX based on boost duration
    let bt = boostTimeRef.get(snake.id) ?? 0;
    bt += 1 / 60; // ~16.67ms per tick at 60fps
    boostTimeRef.set(snake.id, bt);
    sp = Math.min(BOOST_MAX, NSP3 + bt * BOOST_ACCEL * 60);
    snake.boosting = true;
  } else {
    sp = ssp;
    snake.boosting = false;
    boostTimeRef.set(snake.id, 0);
  }

  // Speed interpolation
  let tsp = snake.speed;
  if (tsp < sp) {
    tsp += (sp - tsp) * 0.1 + 0.0001;
  } else {
    tsp += (sp - tsp) * 0.3 - 0.0001;
  }
  snake.speed = tsp;

  // ── Turning ──
  let diff = targetAngle - snake.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  const scang = 0.13 + 0.87 * Math.pow((7 - sc) / 6, 2);
  const spang = Math.min(1, tsp / SPANGDV);
  const mang = MAMU * VFR * scang * spang;

  // Clamp turn amount
  const clampedTurn = Math.max(-mang, Math.min(mang, diff));
  snake.angle += clampedTurn;
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  // ── Movement ──
  const dist = Math.min(MSL, sp * VFR / 4);
  const newHeadX = snake.path.headX + Math.cos(snake.angle) * dist;
  const newHeadY = snake.path.headY + Math.sin(snake.angle) * dist;

  // ── Boundary check ──
  const distFromCenter = Math.sqrt(newHeadX * newHeadX + newHeadY * newHeadY);
  if (distFromCenter >= ctx.boundaryRadius) {
    return true; // hit wall → die
  }

  snake.path.prepend(newHeadX, newHeadY);

  // ── Body length management ──
  const prevBodyScore = snake.cachedBodyScore;
  if (snake.score !== prevBodyScore) {
    snake.cachedBodyLength = scoreToBodyLength(snake.score);
    snake.bodyRadius = scoreToBodyRadius(snake.score);
    snake.cachedBodyScore = snake.score;
    snake.cachedVisualTailIdx = -1;
  }
  const targetLength = Math.ceil(snake.cachedBodyLength * 2);

  // ── Boost cost ──
  if (canBoost) {
    snake.score -= 0.12 * VFR * (sp / NSP3);
    if (snake.score < 0) snake.score = 0;
  }

  // ── Boost pellet shedding ──
  // Shed pellets every 84*sc distance traveled, at tail position
  if (canBoost && snake.path.length > 1) {
    const shedInterval = 84 * sc;
    const dropTimer = snake.lastBoostDrop + dist;
    if (dropTimer >= shedInterval) {
      snake.lastBoostDrop = dropTimer % shedInterval;
      const tailIdx = snake.path.length - 1;
      const tx = snake.path.getX(tailIdx);
      const ty = snake.path.getY(tailIdx);
      const val = Math.random() < 0.5 ? 1 : 2;
      ctx.foods.push(makeSlitherFood(ctx.nextFoodId, tx, ty, val));
    }
  } else {
    snake.lastBoostDrop = 0;
  }

  // ── Length trim ──
  const excess = snake.path.length - targetLength;
  if (excess > 0) {
    const pops = Math.min(excess, 2);
    for (let i = 0; i < pops; i++) snake.path.pop();
  }
  const pathCeil = Math.ceil(targetLength * 1.1) + 20;
  snake.path.trimTo(pathCeil);

  return false; // survived
}

// ==========================================================================
// Food Creation (slither.io style)
// ==========================================================================

function makeSlitherFood(
  nextId: { value: number }, x: number, y: number, forceValue?: number,
): FoodOrb {
  const value = forceValue ?? Math.floor(Math.pow(Math.random(), 2) * 5) + 1;
  const colorIdx = Math.floor(Math.random() * SLITHER_FOOD_COLORS.length);
  const size: FoodSize = value <= 2 ? 'small' : value <= 4 ? 'medium' : 'large';
  const radius = value <= 2 ? 2.5 : value <= 4 ? 4 : 6;
  const id = nextId.value++;

  // Initialize roaming state
  const roam: FoodRoamState = {
    ang: Math.random() * Math.PI * 2,
    gfr: Math.floor(Math.random() * 200),
    rx: x,
    ry: y,
    baseX: x,
    baseY: y,
  };
  foodRoamMap.set(id, roam);

  return {
    id, x, y,
    size, value, radius,
    color: SLITHER_FOOD_COLORS[colorIdx],
    glowColor: SLITHER_FOOD_GLOW_COLORS[colorIdx],
    magnetized: false,
  };
}

function spawnFoodBatch(
  nextId: { value: number }, foods: FoodOrb[],
  count: number, cx: number, cy: number, radius: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * radius;
    foods.push(makeSlitherFood(nextId, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ==========================================================================
// Food Roaming + Glow (called each tick)
// ==========================================================================

function updateFoodAnimation(foods: FoodOrb[], mapHalf: number): void {
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const roam = foodRoamMap.get(f.id);
    if (!roam) {
      // Initialize roaming state for any food that doesn't have it yet
      foodRoamMap.set(f.id, {
        ang: Math.random() * Math.PI * 2,
        gfr: Math.floor(Math.random() * 200),
        rx: f.x, ry: f.y, baseX: f.x, baseY: f.y,
      });
      continue;
    }

    // Update glow frame counter
    roam.gfr = (roam.gfr + 1) % 600;

    // Slow drift roaming
    // Occasionally change direction
    if (Math.random() < 0.02) {
      roam.ang += (Math.random() - 0.5) * 1.0;
    }
    const driftSpeed = 0.15;
    let nx = roam.baseX + Math.cos(roam.ang) * driftSpeed;
    let ny = roam.baseY + Math.sin(roam.ang) * driftSpeed;

    // Bounce off boundary
    const bDist = Math.sqrt(nx * nx + ny * ny);
    if (bDist > mapHalf - 50) {
      // Reflect angle toward center
      roam.ang = Math.atan2(-ny, -nx) + (Math.random() - 0.5) * 0.5;
      nx = roam.baseX;
      ny = roam.baseY;
    }

    roam.baseX = nx;
    roam.baseY = ny;
    f.x = nx; // update collision position too
    f.y = ny;

    // Visual bobbing using gfr for pulsing
    const pulse = 0.3 * Math.sin(roam.gfr * 0.05);
    roam.rx = nx + pulse;
    roam.ry = ny + pulse * 0.7;
  }
}

// ==========================================================================
// Food Eating (instant, no magnet)
// ==========================================================================

function checkFoodEating(
  snakes: Iterable<Snake>, foods: FoodOrb[],
  now: number,
): Set<number> {
  const eatenIds = _eatenIdsSet;
  eatenIds.clear();

  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const sc = scoreToScale(snake.score);
    const eatRadius = EAT_RADIUS * sc;
    const eatRadiusSq = eatRadius * eatRadius;

    // Query nearby food from sector hash
    const sx = Math.floor(hx / FOOD_SECTOR_SIZE);
    const sy = Math.floor(hy / FOOD_SECTOR_SIZE);

    for (let dsx = -1; dsx <= 1; dsx++) {
      for (let dsy = -1; dsy <= 1; dsy++) {
        const key = sectorKey(sx + dsx, sy + dsy);
        const sector = sectorFoodHash.get(key);
        if (!sector) continue;

        for (let i = 0; i < sector.length; i++) {
          const f = sector[i];
          if (eatenIds.has(f.id)) continue;

          const dx = hx - f.x;
          const dy = hy - f.y;
          if (dx * dx + dy * dy <= eatRadiusSq) {
            eatenIds.add(f.id);
            snake.score += f.value;
          }
        }
      }
    }
  }
  return eatenIds;
}

// ==========================================================================
// Death Food Drops (slither.io style: 80% of score along body)
// ==========================================================================

function killSnake(
  snake: Snake, nextFoodId: { value: number }, foods: FoodOrb[],
): void {
  snake.alive = false;
  const dropValue = snake.score * 0.8;
  const segLen = snake.path.length;
  if (segLen === 0) return;

  // Determine number of food drops
  const totalFood = Math.min(segLen, Math.max(5, Math.floor(dropValue / 2)));
  const step = Math.max(1, Math.floor(segLen / totalFood));

  for (let i = 0; i < totalFood; i++) {
    const si = Math.min(i * step, segLen - 1);
    const fx = snake.path.getX(si) + (Math.random() - 0.5) * 8;
    const fy = snake.path.getY(si) + (Math.random() - 0.5) * 8;
    const val = Math.floor(Math.random() * 4) + 1; // 1-4
    foods.push(makeSlitherFood(nextFoodId, fx, fy, val));
  }
}

// ==========================================================================
// Sector Hash Management
// ==========================================================================

function rebuildSectorHash(foods: FoodOrb[]): void {
  sectorFoodHash.clear();
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const sx = Math.floor(f.x / FOOD_SECTOR_SIZE);
    const sy = Math.floor(f.y / FOOD_SECTOR_SIZE);
    const key = sectorKey(sx, sy);
    let arr = sectorFoodHash.get(key);
    if (!arr) {
      arr = [];
      sectorFoodHash.set(key, arr);
    }
    arr.push(f);
  }
}

function removeEatenFromSectorHash(eatenIds: Set<number>): void {
  for (const [key, arr] of sectorFoodHash) {
    if (eatenIds.size === 0) break;
    let writeIdx = 0;
    for (let i = 0; i < arr.length; i++) {
      if (!eatenIds.has(arr[i].id)) {
        arr[writeIdx++] = arr[i];
      }
    }
    arr.length = writeIdx;
  }
}

// ==========================================================================
// Food Maintenance (sector-based)
// ==========================================================================

function maintainFoodAroundPlayer(
  state: GameState, nextIdRef: { value: number },
): void {
  const player = state.player;
  if (!player || !player.alive) return;

  const hx = player.path.headX;
  const hy = player.path.headY;
  const foods = state.foods;
  const visibleR = 4000;
  const ac = state.arenaConfig;

  // Count food near player
  const psx = Math.floor(hx / FOOD_SECTOR_SIZE);
  const psy = Math.floor(hy / FOOD_SECTOR_SIZE);
  let nearbyCount = 0;
  const checkRadius = Math.ceil(visibleR / FOOD_SECTOR_SIZE);

  for (let dsx = -checkRadius; dsx <= checkRadius; dsx++) {
    for (let dsy = -checkRadius; dsy <= checkRadius; dsy++) {
      const key = sectorKey(psx + dsx, psy + dsy);
      const sector = sectorFoodHash.get(key);
      if (sector) nearbyCount += sector.length;
    }
  }

  const densityTarget = 400;
  if (nearbyCount >= densityTarget || foods.length >= FOOD_MAX_COUNT) return;

  const deficit = Math.min(densityTarget - nearbyCount, 20);
  for (let i = 0; i < deficit; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 200 + Math.random() * (visibleR - 200);
    const fx = hx + Math.cos(a) * d;
    const fy = hy + Math.sin(a) * d;
    if (fx * fx + fy * fy < ac.mapRadiusSq) {
      foods.push(makeSlitherFood(nextIdRef, fx, fy));
    }
  }
}

function maintainMapFood(state: GameState, nextIdRef: { value: number }): void {
  const ac = state.arenaConfig;
  const foods = state.foods;
  const cellSize = ac.mapFoodGridSize;
  const halfMap = ac.mapHalf;
  const cols = ac.mapGridCols;
  const rows = ac.mapGridRows;
  const radiusSq = ac.mapRadiusSq;
  const despawnRSq = ac.despawnRadiusSq;
  const targetPerCell = 3;

  // Despawn out-of-bounds food + count per cell
  const counts = _gridCounts;
  counts.fill(0);
  let writeIdx = 0;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.x * f.x + f.y * f.y > despawnRSq) continue;
    if (writeIdx !== i) foods[writeIdx] = f;
    writeIdx++;
    const col = Math.floor((f.x + halfMap) / cellSize);
    const row = Math.floor((f.y + halfMap) / cellSize);
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      counts[row * cols + col]++;
    }
  }
  foods.length = writeIdx;

  if (foods.length >= FOOD_MAX_COUNT) return;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const count = counts[row * cols + col];
      if (count >= targetPerCell) continue;

      const cx = col * cellSize + cellSize / 2 - halfMap;
      const cy = row * cellSize + cellSize / 2 - halfMap;
      if (cx * cx + cy * cy > radiusSq) continue;

      const deficit = targetPerCell - count;
      for (let i = 0; i < deficit; i++) {
        if (foods.length >= FOOD_MAX_COUNT) return;
        const x = cx + (Math.random() - 0.5) * cellSize;
        const y = cy + (Math.random() - 0.5) * cellSize;
        if (x * x + y * y < radiusSq) {
          foods.push(makeSlitherFood(nextIdRef, x, y));
        }
      }
    }
  }
}

// ==========================================================================
// Initialization
// ==========================================================================

export function createInitialState(
  playerSkin?: PlayerSkinOverride | null,
  initialScore?: number,
  playerName?: string,
  arenaId?: string,
): GameState {
  const arenaConfig = getArenaConfig(arenaId);
  const state: GameState = {
    snakes: new Map(), foods: [], player: null,
    nextFoodId: 0, showControls: true, tickCount: 0,
    extractionZone: { x: 0, y: 0, radius: 0, active: false },
    botsEnabled: false,
    arenaConfig,
    boundaryRadius: arenaConfig.mapHalf,
    stars: [],
    nextStarId: 0,
  };

  const now = performance.now();
  const player = createSnake(
    'player', playerName || 'Player', initialScore ?? 0, 0, 0, now, playerSkin,
  );
  state.player = player;
  state.snakes.set(player.id, player);

  // Seed initial food around player
  const nextIdRef = { value: 0 };
  spawnFoodBatch(nextIdRef, state.foods, 200, 0, 0, 2000);
  state.nextFoodId = nextIdRef.value;

  // Clear roaming state for fresh start
  foodRoamMap.clear();

  return state;
}

export function seedInitialFood(state: GameState): boolean {
  const ac = state.arenaConfig;
  if (state.foods.length >= ac.initialFoodTarget) return false;

  const BATCH = 2000;
  const nextIdRef = { value: state.nextFoodId };
  spawnFoodBatch(nextIdRef, state.foods, BATCH, 0, 0, ac.initialSpawnRadius);
  state.nextFoodId = nextIdRef.value;
  return state.foods.length < ac.initialFoodTarget;
}

// ==========================================================================
// Main Game Tick
// ==========================================================================

// Module-level boost time tracker (persists across ticks)
const boostTimeMap = new Map<string, number>();

export function gameTick(
  state: GameState, input: InputState, _dt: number,
): KillEvent[] {
  state.tickCount++;
  const now = performance.now();
  const ac = state.arenaConfig;
  const foodIdRef = { value: state.nextFoodId };

  // Boundary: static (no pulse in slither.io)
  state.boundaryRadius = ac.mapHalf;

  const moveCtx: SlitherMoveContext = {
    foods: state.foods,
    nextFoodId: foodIdRef,
    mapHalf: ac.mapHalf,
    boundaryRadius: ac.mapHalf,
    vfr: VFR,
  };

  // 1. Update food animation (roaming + glow)
  updateFoodAnimation(state.foods, ac.mapHalf);

  // 2. Update bot AI
  if (state.botsEnabled && state.tickCount % ac.aiTickThrottle === 0) {
    // Build food spatial hash for bot AI queries
    foodHash.clear();
    const scratch = _foodHashScratch;
    for (let i = 0; i < state.foods.length; i++) {
      const f = state.foods[i];
      scratch.x = f.x; scratch.y = f.y;
      scratch.radius = f.radius; scratch.id = f.id;
      foodHash.insert(scratch);
    }
    updateAllBotAI(state, foodHash);
  }

  // 3. Rebuild sector hash (every tick since food roams)
  rebuildSectorHash(state.foods);

  // Collect boundary-killed snakes
  const boundaryDead: string[] = [];

  // 4. Move player
  const player = state.player;
  if (player && player.alive) {
    const hitWall = moveSnake(player, input.targetAngle, input.boosting, now, moveCtx, boostTimeMap);
    if (hitWall) boundaryDead.push(player.id);
  }

  // 5. Move all bots
  if (state.botsEnabled) {
    for (const [id, snake] of state.snakes) {
      if (!snake.isBot || !snake.alive) continue;
      const botBoost = getBotBoost(id);
      const hitWall = moveSnake(snake, snake.targetAngle, botBoost, now, moveCtx, boostTimeMap);
      if (hitWall) boundaryDead.push(id);
    }
  }

  // 6. Kill boundary-hit snakes
  for (const deadId of boundaryDead) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake && deadSnake.alive) {
      deadSnake.alive = false;
      boostTimeMap.delete(deadId);
      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
      }
    }
  }

  // 7. Check food eating
  const eatenIds = checkFoodEating(state.snakes.values(), state.foods, now);
  if (eatenIds.size > 0) {
    // Remove from foods array
    let writeIdx = 0;
    for (let i = 0; i < state.foods.length; i++) {
      if (!eatenIds.has(state.foods[i].id)) {
        state.foods[writeIdx++] = state.foods[i];
      }
    }
    state.foods.length = writeIdx;
    // Clean roaming state
    for (const eid of eatenIds) {
      foodRoamMap.delete(eid);
    }
    // Remove from sector hash
    removeEatenFromSectorHash(eatenIds);
  }

  // 8. Food management
  if (state.tickCount % 10 === 0) {
    maintainFoodAroundPlayer(state, foodIdRef);
  }
  if (state.tickCount % 30 === 0) {
    maintainMapFood(state, foodIdRef);
  }

  // 9. Check collisions
  // Build body/head hashes for collision
  bodyHash.clear();
  headHash.clear();
  const collisionResult = checkCollisions(
    state.snakes, bodyHash, headHash, now,
    state.player?.path.headX, state.player?.path.headY,
  );
  for (const deadId of collisionResult.deadIds) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake) {
      killSnake(deadSnake, foodIdRef, state.foods);
      boostTimeMap.delete(deadId);
      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
      }
    }
  }

  // 10. Respawn dead bots
  if (state.botsEnabled) {
    for (let r = 0; r < ac.respawnPerTick; r++) {
      respawnDeadBots(state, ac.botMix as any, createBotSnakeFactory);
    }
  }

  state.nextFoodId = foodIdRef.value;

  return collisionResult.killEvents;
}

// ==========================================================================
// Bot Snake Factory
// ==========================================================================

function createBotSnakeFactory(
  id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType,
): Snake {
  return createSnake(id, name, score, x, y, now, null, botType);
}

// ==========================================================================
// Player Respawn
// ==========================================================================

export function respawnPlayer(state: GameState): void {
  const ac = state.arenaConfig;
  const old = state.player;
  if (old) old.alive = false;
  const pos = findSafeSpawn(state.snakes, 0, 0, 2000, ac.safeSpawnDist, ac.safeSpawnAttempts);
  const skinOverride = old ? {
    skinId: old.skinId, bodyColor: old.color, headColor: old.headColor,
    accentColor: '', rarity: old.rarity,
  } : null;
  boostTimeMap.delete('player');
  const newPlayer = createSnake(
    'player', old?.name || 'Player', 0, pos.x, pos.y, performance.now(), skinOverride,
  );
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}

// ==========================================================================
// Slither Camera
// ==========================================================================

export function createSlitherCamera(x: number, y: number): import('./types').Camera {
  return { x, y, zoom: 1.0 };
}

export function updateSlitherCamera(
  camera: import('./types').Camera,
  snake: Snake,
  boostTime: number,
  _w: number,
  _h: number,
  alpha: number,
): void {
  if (snake.path.length === 0) return;

  // Interpolated position (same as existing camera)
  const curX = snake.path.headX;
  const curY = snake.path.headY;
  camera.x = snake.prevHeadX + (curX - snake.prevHeadX) * alpha;
  camera.y = snake.prevHeadY + (curY - snake.prevHeadY) * alpha;

  // Zoom: slither.io formula
  const sct = scoreToSctFam(snake.score);
  const base = (0.64285 + 0.514285714 / Math.max(1, (sct + 16) / 36)) / 1.5;

  // Boost zoom-out after 1s
  let boostZoomFactor = 1.0;
  if (boostTime > 1.0) {
    const easeT = Math.min(1, (boostTime - 1.0) / 2.0); // ease over 2s
    const ease = Math.sin(easeT * Math.PI * 0.5); // sine ease-out
    boostZoomFactor = 1 + ease * 1.0;
  }

  const targetZoom = base / boostZoomFactor;

  // Smooth zoom interpolation
  const diff = targetZoom - camera.zoom;
  const step = 2e-4 + Math.abs(diff) * 0.05 * VFR;
  if (Math.abs(diff) < step) {
    camera.zoom = targetZoom;
  } else {
    camera.zoom += diff > 0 ? step : -step;
  }
}

// ==========================================================================
// Reset boost times (for cleanup)
// ==========================================================================

export function resetBoostTimes(): void {
  boostTimeMap.clear();
}

// ==========================================================================
// Get food roaming position for rendering
// ==========================================================================

export function getFoodRenderPos(foodId: number): { x: number; y: number } | null {
  const roam = foodRoamMap.get(foodId);
  if (!roam) return null;
  return { x: roam.rx, y: roam.ry };
}
