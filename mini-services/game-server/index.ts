// ============================================================================
// Venom Arena — Socket.IO Game Server
// ============================================================================
// Standalone Bun mini-service (port 3001) for multiplayer snake game.
// Reuses shared types, config, collision, and bot-ai from parent project.
// Engine functions (moveSnake, killSnake, checkFoodEating, food management)
// are reimplemented here because engine.ts imports client-side SLITHER_PRESETS.
// ============================================================================

import { Server } from 'socket.io';
import { createServer } from 'http';

// ─── Shared imports from parent project (pure modules, no browser deps) ──────
import type {
  GameState, Snake, FoodOrb, StarOrb, ArenaConfig, SkinRarity, FoodSize, InputState,
} from '../../src/lib/snake/types';
import { PathBuffer } from '../../src/lib/snake/pool';
import { SpatialHash, type SpatialEntity } from '../../src/lib/snake/spatial-hash';
import {
  checkCollisions, type KillEvent,
} from '../../src/lib/snake/collision';
import {
  updateAllBotAI, getBotBoost, spawnBots, respawnDeadBots, removeBot,
  BOT_TYPE_COLORS, type BotType, type BotSpawnConfig, DEFAULT_BOT_MIX,
} from '../../src/lib/snake/bot-ai';
import {
  // MOVEMENT
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE, SEGMENT_SPACING,
  STEERING_LERP, SHARP_TURN_BRAKE,
  computeBodyLength, computeBodyRadius,
  // FOOD
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS,
  // COLLISION
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPAWN_RADIUS, SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // FOOD MAGNET
  FOOD_MAGNET_PULL_RADIUS, FOOD_MAGNET_DEATH_RADIUS,
  FOOD_MAGNET_MIN_SPEED, FOOD_MAGNET_MAX_SPEED,
  // BOOST
  BOOST_DROP_INTERVAL, BOOST_MIN_SCORE, BOOST_DROP_COUNT,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  // SPIRAL
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  // ARENA
  getArenaConfig, ARENA_CONFIGS,
  // ARENA GRID
  ARENA_GRID_SIZE,
  // BOT SKINS
  BOT_SKIN_PALETTES, getRandomBotPalette,
  getRandomBotSkinOverride,
} from '../../src/lib/snake/config';

// game-config.ts has NO imports — pure data file
import { getArenaById, ARENA_TIERS } from '../../src/lib/game-config';

// ============================================================================
// Constants
// ============================================================================

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret';
const dbg = process.env.DEBUG ? console.log : () => {};
const MAIN_SERVER = 'http://localhost:3000';
const PORT = parseInt(process.env.PORT || '3001', 10);
const SERVER_REGION = process.env.REGION || 'DEFAULT';
console.log(`[GameServer] Starting region=${SERVER_REGION} on port=${PORT}`);
const TICK_RATE = 60; // ticks per second
const TICK_MS = 1000 / TICK_RATE;
const SNAPSHOT_INTERVAL = 3; // broadcast every N ticks (20Hz)
const FOOD_HASH_REBUILD_INTERVAL = 3; // rebuild food spatial hash every N ticks (not every tick)
const DEATH_SCREEN_DELAY = 6000; // ms before disconnecting dead player (5s elimination + 1s overlay)

// ─── Scalability & Validation Constants ─────────────────────────────────
const MAX_PLAYERS_PER_ARENA = 1000;      // Hard cap per arena instance
const INPUT_MIN_INTERVAL_MS = 8;         // ~125Hz max input rate (server processes at 60Hz)
const MAX_ANGLE_DELTA = Math.PI * 1.2;   // Max angle change per input (anti-teleport)
const SNAKE_VIS_RANGE = 15000;            // Snake visibility radius
const SNAKE_VIS_RANGE_SQ = SNAKE_VIS_RANGE * SNAKE_VIS_RANGE;
const FOOD_VIS_RANGE = 4000;
const FOOD_VIS_RANGE_SQ = FOOD_VIS_RANGE * FOOD_VIS_RANGE;
const ARENA_EMPTY_TIMEOUT_MS = 60_000;    // Cleanup arena 60s after last player leaves

// ─── O(1) Socket → Arena lookup ────────────────────────────────────────
const socketToArena: Map<string, string> = new Map(); // socketId → arenaId

// Path buffer stores one head position per tick at BASE_SPEED spacing.
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

// Snake palettes (from engine.ts)
const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<FoodSize> = ['small', 'medium', 'large'];

// Precomputed magnet distances
const MAGNET_PULL_DIST = SNAKE_RADIUS + FOOD_MAGNET_PULL_RADIUS;
const MAGNET_DEATH_DIST = SNAKE_RADIUS + FOOD_MAGNET_DEATH_RADIUS;
const MAGNET_PULL_DIST_SQ = MAGNET_PULL_DIST * MAGNET_PULL_DIST;
const MAGNET_DEATH_DIST_SQ = MAGNET_DEATH_DIST * MAGNET_DEATH_DIST;

// ─── Star Chip Constants ───────────────────────────────────────────────
const STAR_COLLECT_RADIUS = 40;  // px — player must be within this to collect
const STAR_COLLECT_RADIUS_SQ = STAR_COLLECT_RADIUS * STAR_COLLECT_RADIUS;
const STAR_VIS_RANGE = 6000;  // px — stars visible to players within this range
const STAR_VIS_RANGE_SQ = STAR_VIS_RANGE * STAR_VIS_RANGE;
const STARS_PER_DEATH = 10;  // always 10 stars when a real player dies

// ─── Online Arena Config — matches offline practice-easy exactly ─────────────
// Online tiers use the SAME 29000px-radius map, 999 bots, and food density
// as the offline practice-easy arena for full feature parity.
const ONLINE_ARENA_CONFIG: ArenaConfig = ARENA_CONFIGS['practice-easy'];

// Module-level scratch objects (avoid per-tick allocation)
const _foodHashScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
const _cachedFoodById = new Map<number, FoodOrb>();
const _magnetizedIds: number[] = [];
const _eatenIdsSet = new Set<number>();
const _snapshotDedupSet = new Set<number>();
const _gridCounts = new Int32Array(144); // For largest possible grid

// ============================================================================
// Server-side reimplemented engine functions
// ============================================================================

// ─── Move Context ───────────────────────────────────────────────────────────

interface MoveContext {
  foods: FoodOrb[];
  nextFoodId: { value: number };
  mapHalf: number;
  boundaryRadius: number;
}

// ─── Snake Creation ──────────────────────────────────────────────────────────

function createSnake(
  id: string, name: string, startScore: number,
  posX: number, posY: number, now: number,
  color?: string, headColor?: string,
  skinId?: string, rarity?: SkinRarity,
  botType?: BotType,
): Snake {
  const targetLength = computeBodyLength(startScore);
  const angle = 0;

  const pathTarget = Math.max(Math.ceil(targetLength * SPACING_RATIO), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));
  path.resetTo(posX, posY);
  for (let i = 1; i < pathTarget; i++) {
    const x = posX - Math.cos(angle) * i * BASE_SPEED;
    const y = posY - Math.sin(angle) * i * BASE_SPEED;
    path.appendTail(x, y);
  }

  // Use provided colors or type-specific or random
  let snakeColor: string;
  let snakeHeadColor: string;
  if (color && headColor) {
    snakeColor = color;
    snakeHeadColor = headColor;
  } else if (botType && BOT_TYPE_COLORS[botType]) {
    [snakeColor, snakeHeadColor] = BOT_TYPE_COLORS[botType];
  } else {
    const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
    snakeColor = palette[0];
    snakeHeadColor = palette[1];
  }

  return {
    id, name, path, angle, prevAngle: angle,
    speed: BASE_SPEED, score: startScore,
    boosting: false, alive: true, isBot: !!botType, isPlayer: !botType,
    spawnTime: now, color: snakeColor, headColor: snakeHeadColor,
    lastBoostDrop: 0, targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: computeBodyRadius(startScore),
    cachedBodyLength: computeBodyLength(startScore),
    cachedBodyScore: startScore,
    cachedVisualTailIdx: 0,
    skinId: skinId || 'skin-default',
    rarity: rarity || 'common',
    prevHeadX: posX, prevHeadY: posY, smoothBrakeFactor: 1.0,
    carriedChips: 0,
  };
}

// ─── Safe Spawn ──────────────────────────────────────────────────────────────

function findSafeSpawn(
  snakes: Map<string, Snake>,
  nearX: number, nearY: number,
  spawnRadius: number = SPAWN_RADIUS,
  safeDist: number = SAFE_SPAWN_DIST,
  attempts: number = SAFE_SPAWN_ATTEMPTS,
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

// ─── Food Creation ────────────────────────────────────────────────────────────

function makeFood(nextId: { value: number }, x: number, y: number, forceSize?: number): FoodOrb {
  let sizeIndex = 0;
  if (forceSize !== undefined) {
    sizeIndex = forceSize;
  } else {
    const roll = Math.random();
    let cumulative = 0;
    for (let i = 0; i < 3; i++) {
      cumulative += FOOD_SPAWN_WEIGHTS[i];
      if (roll <= cumulative) { sizeIndex = i; break; }
    }
  }
  return {
    id: nextId.value++, x, y,
    size: FOOD_SIZES[sizeIndex], value: FOOD_VALUES[sizeIndex],
    radius: FOOD_RADII[sizeIndex], color: FOOD_COLORS[sizeIndex],
    glowColor: FOOD_GLOW_COLORS[sizeIndex], magnetized: false,
  };
}

function spawnFoodBatch(nextId: { value: number }, foods: FoodOrb[], count: number, cx: number, cy: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * radius; // area-uniform distribution
    foods.push(makeFood(nextId, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ─── Snake Movement ──────────────────────────────────────────────────────────

function moveSnake(snake: Snake, targetAngle: number, wantBoost: boolean, now: number, ctx: MoveContext): boolean {
  snake.targetAngle = targetAngle;
  snake.prevAngle = snake.angle;

  let diff = targetAngle - snake.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  const canBoost = wantBoost && snake.score >= BOOST_MIN_SCORE;
  const currentSpeed = canBoost ? BOOST_SPEED : BASE_SPEED;
  const speedT = Math.min(1, Math.max(0, (currentSpeed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)));
  let maxTurn = BASE_TURN_RATE + (MIN_TURN_RATE - BASE_TURN_RATE) * speedT;

  // Spiral assist
  const absDiff = Math.abs(diff);
  const turnDir: 1 | -1 = diff >= 0 ? 1 : -1;
  const sp = snake.spiral;
  if (!sp.active) {
    if (absDiff >= SPIRAL_TURN_THRESHOLD && turnDir === sp.direction) {
      sp.consecutiveTurns++;
    } else {
      sp.direction = turnDir;
      sp.consecutiveTurns = absDiff >= SPIRAL_TURN_THRESHOLD ? 1 : 0;
    }
    if (sp.consecutiveTurns >= SPIRAL_ENTER_TICKS) {
      sp.active = true;
      sp.ticksElapsed = 0;
    }
  } else {
    if (absDiff < SPIRAL_EXIT_THRESHOLD || turnDir !== sp.direction) {
      sp.active = false;
      sp.consecutiveTurns = 0;
    } else {
      sp.ticksElapsed++;
      const t = Math.min(1, sp.ticksElapsed / SPIRAL_RAMP_TICKS);
      const multiplier = 1 + (SPIRAL_MAX_MULTIPLIER - 1) * t;
      maxTurn *= multiplier;
    }
  }

  // Steering Inertia + Dynamic Speed Braking
  const turnAmount = diff * STEERING_LERP;
  const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, turnAmount));
  snake.angle += clampedTurn;
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  // Sharp turn braking (applied to turn rate, not speed)
  const absClampedTurn = Math.abs(clampedTurn);
  const sharpness = maxTurn > 0 ? Math.min(absClampedTurn / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
  maxTurn *= (1 - SHARP_TURN_BRAKE * smoothT);

  // Detect boost transition
  const boostJustStarted = canBoost && !snake.boosting;
  snake.boosting = canBoost;
  snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

  // Path buffer movement
  let newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  let newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;

  // Arena boundary — DEATH on touch
  const distFromCenter = Math.sqrt(newHeadX * newHeadX + newHeadY * newHeadY);
  const bRadius = ctx.boundaryRadius;
  if (distFromCenter >= bRadius) {
    return true; // caller must kill this snake
  }

  snake.path.prepend(newHeadX, newHeadY);

  // Growth / Shrink — cached body length
  const prevBodyScore = snake.cachedBodyScore;
  const scoreChanged = snake.score !== prevBodyScore;
  if (scoreChanged) {
    snake.cachedBodyLength = computeBodyLength(snake.score);
    snake.bodyRadius = computeBodyRadius(snake.score);
    snake.cachedBodyScore = snake.score;
    snake.cachedVisualTailIdx = -1;
  }
  const logicalLen = snake.cachedBodyLength;
  const targetLength = Math.ceil(logicalLen * SPACING_RATIO);

  // Boost food drop
  const shouldDrop = canBoost && (boostJustStarted || now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL);
  if (shouldDrop) {
    snake.lastBoostDrop = now;
    const pathLen = snake.path.length;
    const dropCount = Math.min(BOOST_DROP_COUNT, pathLen - 1);
    if (dropCount > 0) {
      const startFrac = 0.8;
      for (let d = 0; d < dropCount; d++) {
        const frac = startFrac + (1 - startFrac) * (d / (dropCount - 1 || 1));
        const idx = Math.min(Math.floor(frac * pathLen), pathLen - 1);
        ctx.foods.push({
          id: ctx.nextFoodId.value++, x: snake.path.getX(idx), y: snake.path.getY(idx),
          size: 'small', value: 1, radius: FOOD_RADII[0],
          color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0], magnetized: false,
        });
      }
    }
  }
  if (!canBoost) {
    snake.lastBoostDrop = 0;
  }

  // Boost score cost
  if (canBoost) {
    snake.boostCostAccum = (snake.boostCostAccum ?? 0) + 1;
    if (snake.boostCostAccum >= BOOST_SCORE_COST_INTERVAL) {
      snake.boostCostAccum = 0;
      snake.score = Math.max(0, snake.score - BOOST_SCORE_COST_AMOUNT);
    }
  } else {
    snake.boostCostAccum = 0;
  }

  // Length management
  const excess = snake.path.length - targetLength;
  if (excess > 0) {
    const pops = Math.min(excess, 2);
    for (let i = 0; i < pops; i++) snake.path.pop();
  }

  // Path buffer trimming
  const pathCeil = Math.ceil(targetLength * 1.1) + 20;
  snake.path.trimTo(pathCeil);
  return false; // survived
}

// ─── Death & Food Distribution ──────────────────────────────────────────────

function killSnake(snake: Snake, nextFoodId: { value: number }, foods: FoodOrb[]): void {
  snake.alive = false;
  const dropValue = Math.max(1, snake.score);
  const segLen = snake.path.length;
  const maxFood = segLen;

  const largeCount = Math.min(maxFood, Math.max(1, Math.floor(dropValue * 0.4 / FOOD_VALUES[2])));
  const medCount = Math.min(maxFood - largeCount, Math.max(1, Math.floor(dropValue * 0.3 / FOOD_VALUES[1])));
  let remaining = dropValue - largeCount * FOOD_VALUES[2] - medCount * FOOD_VALUES[1];
  const smallCount = Math.min(maxFood - largeCount - medCount, Math.max(1, remaining));
  remaining -= smallCount;
  const totalFood = largeCount + medCount + smallCount;

  const sizes: Array<0 | 1 | 2> = [];
  for (let i = 0; i < largeCount; i++) sizes.push(2);
  for (let i = 0; i < medCount; i++) sizes.push(1);
  for (let i = 0; i < smallCount; i++) sizes.push(0);
  for (let i = sizes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = sizes[i]; sizes[i] = sizes[j]; sizes[j] = tmp;
  }

  const step = Math.max(1, Math.floor(segLen / totalFood));
  for (let i = 0; i < sizes.length; i++) {
    const si = Math.min(i * step, segLen - 1);
    const sizeIdx = sizes[i];
    foods.push({
      id: nextFoodId.value++, x: snake.path.getX(si), y: snake.path.getY(si),
      size: FOOD_SIZES[sizeIdx], value: FOOD_VALUES[sizeIdx], radius: FOOD_RADII[sizeIdx],
      color: FOOD_COLORS[sizeIdx], glowColor: FOOD_GLOW_COLORS[sizeIdx], magnetized: false,
    });
  }
}

// ─── Food Eating (Magnet + Vacuum) ──────────────────────────────────────────

function checkFoodEating(
  snakes: Iterable<Snake>, foods: FoodOrb[],
  fh: SpatialHash, fvc: Map<number, number>, now: number,
  foodHashRebuild: boolean,
): Set<number> {
  // Reset only magnetized food flags
  for (let i = 0; i < _magnetizedIds.length; i++) {
    const f = _cachedFoodById.get(_magnetizedIds[i]);
    if (f) f.magnetized = false;
  }
  _magnetizedIds.length = 0;

  // Rebuild food hash every FOOD_HASH_REBUILD_INTERVAL ticks (not every tick).
  // Every-tick rebuild was 20K inserts × 60Hz = 1.2M inserts/sec — the #1 server bottleneck.
  // Magnet pulls move food ~1-10px/tick, so 2-tick-old positions are close enough
  // for the spatial hash query radius (MAGNET_PULL_DIST=38px) to still find them.
  // New food spawns and eaten food removal are handled by the interval.
  // NOTE: The snapshot broadcast (every SNAPSHOT_INTERVAL ticks) still rebuilds
  // the hash for accurate food visibility — this only affects collision/magnet checks.
  if (foodHashRebuild) {
    fh.clear();
    fvc.clear();
    _cachedFoodById.clear();
    const scratch = _foodHashScratch;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      scratch.x = f.x; scratch.y = f.y; scratch.radius = f.radius; scratch.id = f.id;
      fh.insert(scratch);
      fvc.set(f.id, f.value);
      _cachedFoodById.set(f.id, f);
    }
  }

  const foodById = _cachedFoodById;
  const eatenIds = _eatenIdsSet;
  eatenIds.clear();
  const speedRange = FOOD_MAGNET_MAX_SPEED - FOOD_MAGNET_MIN_SPEED;
  const zoneWidth = MAGNET_PULL_DIST - MAGNET_DEATH_DIST;

  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = fh.query(hx, hy, MAGNET_PULL_DIST);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const fid = entity.id as number;
      if (eatenIds.has(fid)) continue;
      const food = foodById.get(fid);
      if (!food) continue;

      // CRITICAL FIX: Use entity hash position for distance/eating checks.
      // The hash is rebuilt once at the top of this function, but earlier snakes
      // (bots) modify food.x/food.y via magnet pull. If we used food.x/food.y
      // here, food that was within range at hash-build time could now be outside
      // range after bot pulls — causing ~20% of food to escape collection.
      // Using entity pos (from hash) keeps the check consistent with the query.
      const ex = entity.x;
      const ey = entity.y;
      const edx = hx - ex;
      const edy = hy - ey;
      const eDistSq = edx * edx + edy * edy;

      if (eDistSq <= MAGNET_DEATH_DIST_SQ) {
        eatenIds.add(fid);
        snake.score += fvc.get(fid) ?? 1;
        continue;
      }

      if (eDistSq <= MAGNET_PULL_DIST_SQ) {
        food.magnetized = true;
        _magnetizedIds.push(fid);
        const eDist = Math.sqrt(eDistSq);
        const closeness = Math.min(1, Math.max(0, 1 - (eDist - MAGNET_DEATH_DIST) / zoneWidth));
        const pullSpeed = FOOD_MAGNET_MIN_SPEED + speedRange * closeness * closeness;
        // Use ACTUAL food position for pull direction (accurate physics),
        // but hash position for the speed calculation (consistent with range).
        const adx = hx - food.x;
        const ady = hy - food.y;
        const aDist = Math.sqrt(adx * adx + ady * ady);
        if (aDist > 0.01) {
          food.x += (adx / aDist) * pullSpeed;
          food.y += (ady / aDist) * pullSpeed;
        }
      }
    }
  }
  return eatenIds;
}

// ─── Food Management ─────────────────────────────────────────────────────────

function maintainFoodAroundPlayer(
  snakes: Map<string, Snake>, foods: FoodOrb[],
  arenaConfig: ArenaConfig,
  nextIdRef: { value: number }, fh: SpatialHash,
): void {
  // Find a reference snake (first alive one)
  let refSnake: Snake | undefined;
  for (const [, s] of snakes) {
    if (s.alive && s.path.length > 0) { refSnake = s; break; }
  }
  if (!refSnake) return;

  const ac = arenaConfig;
  const hx = refSnake.path.headX;
  const hy = refSnake.path.headY;
  const angle = refSnake.angle;
  const visibleR = ac.foodVisibleRadius;
  const visibleRSq = ac.visibleRadiusSq;

  // Count nearby food via spatial hash
  let nearbyCount = 0;
  const nearby = fh.query(hx, hy, visibleR);
  for (let i = 0; i < nearby.length; i++) {
    const dx = nearby[i].x - hx;
    const dy = nearby[i].y - hy;
    if (dx * dx + dy * dy < visibleRSq) nearbyCount++;
  }

  const deficit = ac.foodDensityTarget - nearbyCount;
  if (deficit <= 0 || foods.length >= ac.foodMaxCount) return;
  const batch = Math.min(deficit, ac.foodRespawnBatch);

  const uniformCount = Math.ceil(batch * 0.5);
  const aheadCount = Math.ceil(batch * 0.3);
  const aroundCount = batch - uniformCount - aheadCount;

  for (let i = 0; i < uniformCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * (visibleR - 200);
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aheadCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.8;
    const dist = 200 + Math.random() * (visibleR - 200);
    const a = angle + spread;
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aroundCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * (visibleR - 800);
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
}

function maintainMapFood(
  foods: FoodOrb[], arenaConfig: ArenaConfig, nextIdRef: { value: number },
): void {
  const ac = arenaConfig;
  const cellSize = ac.mapFoodGridSize;
  const halfMap = ac.mapHalf;
  const cols = ac.mapGridCols;
  const rows = ac.mapGridRows;
  const radiusSq = ac.mapRadiusSq;
  const despawnRSq = ac.despawnRadiusSq;
  const targetPerCell = ac.mapFoodTargetPerCell;
  const spawnPerCell = ac.mapFoodSpawnPerCell;
  const maxFood = ac.foodMaxCount;

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

  if (foods.length >= maxFood) return;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const count = counts[row * cols + col];
      if (count >= targetPerCell) continue;

      const cx = col * cellSize + cellSize / 2 - halfMap;
      const cy = row * cellSize + cellSize / 2 - halfMap;
      if (cx * cx + cy * cy > radiusSq) continue;

      const deficit = targetPerCell - count;
      const toSpawn = Math.min(deficit, spawnPerCell);
      for (let i = 0; i < toSpawn; i++) {
        if (foods.length >= maxFood) return;
        const x = cx + (Math.random() - 0.5) * cellSize;
        const y = cy + (Math.random() - 0.5) * cellSize;
        if (x * x + y * y < radiusSq) {
          foods.push(makeFood(nextIdRef, x, y));
        }
      }
    }
  }
}

// ─── Seed Initial Food (incremental, call until returns false) ──────────────

function seedInitialFood(
  foods: FoodOrb[], nextFoodId: { value: number },
  arenaConfig: ArenaConfig, target: number,
): boolean {
  if (foods.length >= target) return false;
  const BATCH = 2000;
  spawnFoodBatch(nextFoodId, foods, BATCH, 0, 0, arenaConfig.initialSpawnRadius);
  return foods.length < target;
}

// ─── Bot Snake Factory ──────────────────────────────────────────────────────

function createBotSnakeFactory(
  id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType,
): Snake {
  // Use real preset skin overrides (matches offline engine's BOT_SKIN_POOL)
  const skin = getRandomBotSkinOverride();
  return createSnake(id, name, score, x, y, now, skin.bodyColor, skin.headColor, skin.skinId, 'common', botType);
}

// ─── Map tier ID → ArenaConfig ───────────────────────────────────────────────

function resolveArenaConfig(arenaId: string): ArenaConfig {
  // Online competitive tiers use the SAME config as offline practice-easy
  // (29000px radius, 999 bots) for feature parity.
  if (arenaId.startsWith('tier-')) {
    return ONLINE_ARENA_CONFIG;
  }

  // Practice arenas use full-size configs (1000 bots)
  const direct = ARENA_CONFIGS[arenaId];
  if (direct) return direct;

  // Fallback
  return getArenaConfig();
}

// ─── Map tier ID → bot mix (using tier's botsCount) ─────────────────────────

function resolveBotMix(arenaId: string): BotSpawnConfig {
  // Prefer the arena config's built-in botMix for practice arenas (exact counts)
  const direct = ARENA_CONFIGS[arenaId];
  if (direct?.botMix) {
    const bm = direct.botMix;
    return {
      predator: bm.predator,
      coiler: bm.coiler,
      baiter: bm.baiter,
      interceptor: bm.interceptor,
      grazer: bm.grazer,
      trapper: bm.trapper,
      ranked: bm.ranked,
    };
  }

  // For competitive tiers, compute from botsCount
  const tier = getArenaById(arenaId);
  const botsCount = tier?.botsCount ?? 999;

  // Distribute bots proportionally across types (similar ratios to practice arenas)
  const ranked = Math.max(1, Math.round(botsCount * 0.03));
  const remaining = botsCount - ranked;
  const predator = Math.round(remaining * 0.16);
  const coiler = Math.round(remaining * 0.08);
  const baiter = Math.round(remaining * 0.12);
  const interceptor = Math.round(remaining * 0.12);
  const grazer = Math.round(remaining * 0.28);
  const trapper = remaining - predator - coiler - baiter - interceptor - grazer;

  return { predator, coiler, baiter, interceptor, grazer, trapper, ranked };
}

// ============================================================================
// ArenaInstance — per-arena game state + loop
// ============================================================================

interface ConnectedPlayer {
  socket: any; // Socket.IO socket
  snakeId: string;
  userTag: string;
  name: string;
  input: { angle: number; boost: boolean };
  joinTime: number;
  kills: number;
  color: string;
  secondaryColor: string;
  skinId: string;
  rarity: string;
  pattern?: string;
  country?: string;
  level: number;
  clanTag?: string;
  // ── Input validation state ──
  lastInputTime: number;
  lastAngle: number;
  lastInputSeq: number;   // monotonically increasing, detects replay attacks
  // ── Anti-cheat tracking ──
  scoreAtJoin: number;
  foodEatenCount: number;
  killCount: number;
  joinTimestamp: number;
  violations: number;
  lastPosCheckTime: number;
  lastPosCheckX: number;
  lastPosCheckY: number;
  // ── Spectator mode (after death) ──
  deadAt: number;           // 0 = alive, >0 = Date.now() of death
  spectatorHx: number;      // last head X before death (for snapshot camera)
  spectatorHy: number;      // last head Y before death (for snapshot camera)
  carriedChips: number;     // player's carried star chips
}

class ArenaInstance {
  arenaId: string;
  arenaConfig: ArenaConfig;
  botMix: BotSpawnConfig;
  state: GameState;
  players: Map<string, ConnectedPlayer>; // socketId → player
  snakeToSocket: Map<string, string>;   // snakeId → socketId
  foodHash: SpatialHash;
  bodyHash: SpatialHash;
  headHash: SpatialHash;
  foodValueCache: Map<number, number>;
  tickInterval: ReturnType<typeof setInterval> | null = null;
  playerCount = 0;
  lastSeed = false;
  lastPlayerLeaveTime = 0;  // For arena cleanup timeout
  emptyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(arenaId: string) {
    this.arenaId = arenaId;
    this.arenaConfig = resolveArenaConfig(arenaId);
    this.botMix = resolveBotMix(arenaId);

    // Create initial game state (no player yet — player added on join)
    const ac = this.arenaConfig;
    this.state = {
      snakes: new Map(),
      foods: [],
      player: null,
      nextFoodId: 0,
      showControls: false,
      tickCount: 0,
      botsEnabled: true, // Server always has bots enabled
      arenaConfig: ac,
      boundaryRadius: ac.mapHalf,
      stars: [],
      nextStarId: 0,
    };

    this.players = new Map();
    this.snakeToSocket = new Map();
    this.foodHash = new SpatialHash();
    this.bodyHash = new SpatialHash();
    this.headHash = new SpatialHash();
    this.foodValueCache = new Map<number, number>();

    // Seed initial food
    this.seedFood();
  }

  seedFood(): void {
    // Seed a small ring around origin
    const nextIdRef = { value: 0 };
    spawnFoodBatch(nextIdRef, this.state.foods, 200, 0, 0, 2000);
    this.state.nextFoodId = nextIdRef.value;

    // Seed larger area incrementally
    const ac = this.arenaConfig;
    while (seedInitialFood(this.state.foods, { value: this.state.nextFoodId }, ac, ac.initialFoodTarget)) {
      // Keep seeding until target reached
    }
  }

  start(): void {
    if (this.tickInterval) return;
    console.log(`[Arena ${this.arenaId}] Starting game loop (${TICK_RATE} ticks/sec, snapshots at ${Math.floor(TICK_RATE / SNAPSHOT_INTERVAL)}Hz)`);
    this.tickInterval = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error(`[Arena ${this.arenaId}] Tick error:`, err);
        dbg(`[Arena ${this.arenaId}] Tick error: ${err}`);
      }
    }, TICK_MS);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log(`[Arena ${this.arenaId}] Game loop stopped`);
  }

  spawnPlayer(playerInfo: ConnectedPlayer): Snake {
    const now = performance.now();
    const ac = this.arenaConfig;
    const pos = findSafeSpawn(this.state.snakes, 0, 0, ac.spawnRadius * 0.85, 600, ac.safeSpawnAttempts);

    const snake = createSnake(
      `player-${playerInfo.userTag}`,
      playerInfo.name,
      0, // start with 0 score
      pos.x, pos.y,
      now,
      playerInfo.color,
      playerInfo.secondaryColor,
      playerInfo.skinId,
      playerInfo.rarity as SkinRarity,
    );

    snake.isPlayer = true;
    snake.isBot = false;
    this.state.snakes.set(snake.id, snake);
    this.state.player = snake; // Set as reference for food management

    return snake;
  }

  addPlayer(socketId: string, playerInfo: ConnectedPlayer, snake: Snake): void {
    this.players.set(socketId, playerInfo);
    this.snakeToSocket.set(snake.id, socketId);
    this.playerCount = this.players.size;
    playerInfo.snakeId = snake.id;
  }

  removePlayer(socketId: string): ConnectedPlayer | undefined {
    const player = this.players.get(socketId);
    if (!player) return undefined;

    // Remove snake from state
    const snake = this.state.snakes.get(player.snakeId);
    if (snake) {
      snake.alive = false;
      this.state.snakes.delete(snake.id);
    }
    this.snakeToSocket.delete(player.snakeId);
    this.players.delete(socketId);
    this.playerCount = this.players.size;

    // If this was the reference player, pick another
    if (this.state.player === snake) {
      this.state.player = [...this.state.snakes.values()].find(s => s.isPlayer && s.alive) || null;
    }

    return player;
  }

  // ─── Anti-Cheat: Statistical anomaly detection ───────────────────────
  // Runs every 5 seconds (300 ticks at 60Hz) per player.
  // Detects: impossible score acceleration, teleport, speed hacks.
  private runAntiCheat(): void {
    const now = Date.now();
    const CHECK_INTERVAL_MS = 5000;
    const MAX_SCORE_ACCEL_PER_SEC = 500; // reasonable max score gain rate
    const MAX_MOVE_SPEED = BOOST_SPEED * 1.5; // 50% tolerance above max speed

    for (const [socketId, player] of this.players) {
      if (now - player.lastPosCheckTime < CHECK_INTERVAL_MS) continue;

      const snake = this.state.snakes.get(player.snakeId);
      if (!snake || !snake.alive) continue;

      const dt = (now - player.lastPosCheckTime) / 1000;
      player.lastPosCheckTime = now;

      // Check 1: Score acceleration
      // Max possible food value per second ≈ 15 (eating large food constantly)
      // With kills, could be higher, so 500/s is generous
      const scoreGained = snake.score - player.scoreAtJoin;
      const scoreRate = scoreGained / Math.max(dt, 1);
      if (scoreRate > MAX_SCORE_ACCEL_PER_SEC && scoreGained > 100) {
        player.violations++;
        console.warn(`[AntiCheat] ${player.name}: Suspicious score rate ${scoreRate.toFixed(0)}/s (${player.violations} violations)`);
      }
      player.scoreAtJoin = snake.score; // Reset baseline

      // Check 2: Position/teleport detection
      const dx = snake.path.headX - player.lastPosCheckX;
      const dy = snake.path.headY - player.lastPosCheckY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // FIX: MAX_MOVE_SPEED is px/tick, multiply by TICK_RATE to get px/sec
      const maxDist = MAX_MOVE_SPEED * TICK_RATE * dt;
      if (dist > maxDist * 1.2 && dist > 100) {
        // 20% tolerance for accumulated error
        player.violations++;
        console.warn(`[AntiCheat] ${player.name}: Moved ${dist.toFixed(0)}px in ${dt.toFixed(1)}s (max: ${(maxDist * 1.2).toFixed(0)}px) (${player.violations} violations)`);
      }
      player.lastPosCheckX = snake.path.headX;
      player.lastPosCheckY = snake.path.headY;

      // Check 3: Auto-kick on 10+ violations
      if (player.violations >= 10) {
        console.warn(`[AntiCheat] KICKING ${player.name} — ${player.violations} violations`);
        try { player.socket.emit('error', { message: 'Kicked: suspicious activity detected' }); } catch {}
        try { player.socket.disconnect(true); } catch {}
        this.removePlayer(socketId);
      }
    }
  }

  private tick(): void {
    const state = this.state;
    const ac = this.arenaConfig;
    state.tickCount++;
    const now = performance.now();
    const foodIdRef = { value: state.nextFoodId };

    // ── Pulsing boundary: 30s shrink, 30s grow ──
    const PULSE_CYCLE_TICKS = 60 * 60;
    const PULSE_AMPLITUDE = 0.08;
    const phase = (state.tickCount % PULSE_CYCLE_TICKS) / PULSE_CYCLE_TICKS;
    const pulseOffset = PULSE_AMPLITUDE * 0.5 * (1 - Math.cos(phase * 2 * Math.PI));
    const boundaryRadius = ac.mapHalf * (1 - pulseOffset);
    state.boundaryRadius = boundaryRadius;

    const moveCtx: MoveContext = {
      foods: state.foods,
      nextFoodId: foodIdRef,
      mapHalf: ac.mapHalf,
      boundaryRadius,
    };

    // 1. Update bot AI (throttled)
    if (state.tickCount % ac.aiTickThrottle === 0) {
      updateAllBotAI(state, this.foodHash);
    }

    // 2. Spawn bots on first tick
    if (state.tickCount === 1) {
      const botTotal = this.botMix.predator + this.botMix.coiler + this.botMix.baiter + this.botMix.interceptor + this.botMix.grazer + this.botMix.trapper + this.botMix.ranked;
      console.log(`[Arena ${this.arenaId}] Bot mix: ${JSON.stringify(this.botMix)} (total: ${botTotal}), mapHalf: ${ac.mapHalf}`);
      spawnBots(state, this.botMix as any, createBotSnakeFactory);
      console.log(`[Arena ${this.arenaId}] Spawned ${state.snakes.size - this.playerCount} bots`);
    }

    // 3. Move all snakes
    const boundaryDead: string[] = [];

    // Move connected players (skip spectators)
    for (const [socketId, player] of this.players) {
      if (player.deadAt > 0) continue; // spectator — no movement
      const snake = state.snakes.get(player.snakeId);
      if (!snake || !snake.alive) continue;
      const hitWall = moveSnake(snake, player.input.angle, player.input.boost, now, moveCtx);
      // Save head position for potential spectator mode
      player.spectatorHx = snake.path.headX;
      player.spectatorHy = snake.path.headY;
      if (hitWall) boundaryDead.push(snake.id);
    }

    // Move bots
    for (const [id, snake] of state.snakes) {
      if (!snake.isBot || !snake.alive) continue;
      const botBoost = getBotBoost(id);
      const hitWall = moveSnake(snake, snake.targetAngle, botBoost, now, moveCtx);
      if (hitWall) boundaryDead.push(id);
    }

    // 4. Kill boundary-hit snakes (no food drop for boundary deaths)
    const playersToKill: { snakeId: string; socketId: string; reason: string; killerTag?: string; killerIsBot?: boolean }[] = [];
    for (const deadId of boundaryDead) {
      const deadSnake = state.snakes.get(deadId);
      if (deadSnake && deadSnake.alive) {
        deadSnake.alive = false;
        if (deadSnake.isBot) {
          removeBot(deadId);
          state.snakes.delete(deadId);
        } else {
          const socketId = this.snakeToSocket.get(deadId);
          if (socketId) {
            playersToKill.push({ snakeId: deadId, socketId, reason: 'boundary' });
          }
        }
      }
    }

    // 5. Check food eating — hash rebuilt every FOOD_HASH_REBUILD_INTERVAL ticks
    const rebuildFoodHash = state.tickCount % FOOD_HASH_REBUILD_INTERVAL === 0;
    const eatenIds = checkFoodEating(
      state.snakes.values(), state.foods,
      this.foodHash, this.foodValueCache, now, rebuildFoodHash,
    );
    if (eatenIds.size > 0) {
      let writeIdx = 0;
      for (let i = 0; i < state.foods.length; i++) {
        if (!eatenIds.has(state.foods[i].id)) { state.foods[writeIdx++] = state.foods[i]; }
      }
      state.foods.length = writeIdx;
    }

    // 5b. Star collection (players only — bots cannot collect stars)
    // Use Set-based dedup: collect all IDs first, then filter once.
    // This guarantees no star is shared between two players.
    const _collectedStarIds = new Set<number>();
    for (const [, player] of this.players) {
      if (player.deadAt > 0) continue; // spectator
      const snake = state.snakes.get(player.snakeId);
      if (!snake || !snake.alive) continue;

      const hx = snake.path.headX;
      const hy = snake.path.headY;
      for (let i = 0; i < state.stars.length; i++) {
        const star = state.stars[i];
        if (_collectedStarIds.has(star.id)) continue;
        const dx = star.x - hx;
        const dy = star.y - hy;
        if (dx * dx + dy * dy < STAR_COLLECT_RADIUS_SQ) {
          // Collect!
          snake.carriedChips += star.value;
          player.carriedChips = snake.carriedChips;
          _collectedStarIds.add(star.id);
        }
      }
    }
    // Remove collected stars in one pass
    if (_collectedStarIds.size > 0) {
      let writeIdx = 0;
      for (let i = 0; i < state.stars.length; i++) {
        if (!_collectedStarIds.has(state.stars[i].id)) {
          state.stars[writeIdx++] = state.stars[i];
        }
      }
      state.stars.length = writeIdx;
    }

    // 6. Food management
    if (state.tickCount % ac.playerFoodInterval === 0) {
      maintainFoodAroundPlayer(state.snakes, state.foods, ac, foodIdRef, this.foodHash);
    }
    if (state.tickCount % ac.mapFoodInterval === 0) {
      maintainMapFood(state.foods, ac, foodIdRef);
    }

    // 7. Check collisions — pass player position for viewport culling (same as offline)
    // Without this, ALL 999 bots' body segments go into the hash (~100K inserts)
    // and ALL bot-vs-bot pairs are checked, starving the game loop.
    let playerHx: number | undefined;
    let playerHy: number | undefined;
    for (const [, player] of this.players) {
      const ps = state.snakes.get(player.snakeId);
      if (ps && ps.alive) { playerHx = ps.path.headX; playerHy = ps.path.headY; break; }
    }
    const collisionResult = checkCollisions(
      state.snakes, this.bodyHash, this.headHash, now,
      playerHx, playerHy,
    );

    // 8. Process collision deaths — drop food for collision kills
    let deathCount = 0;
    for (const deadId of collisionResult.deadIds) {
      const deadSnake = state.snakes.get(deadId);
      if (!deadSnake) continue;

      killSnake(deadSnake, foodIdRef, state.foods);
      deathCount++;

      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
        // Credit kill to the killer player (if any)
        const killEvt = collisionResult.killEvents.find(e => e.victimId === deadId);
        if (killEvt) {
          const killerSocketId = this.snakeToSocket.get(killEvt.killerId);
          if (killerSocketId) {
            const killerPlayer = this.players.get(killerSocketId);
            if (killerPlayer) killerPlayer.kills++;
          }
        }
      } else {
        // Check if already marked for boundary death
        if (!playersToKill.find(p => p.snakeId === deadId)) {
          const socketId = this.snakeToSocket.get(deadId);
          if (socketId) {
            // Find killer info from kill events
            const killEvent = collisionResult.killEvents.find(e => e.victimId === deadId);
            // Look up killer's userTag and isBot status
            let killerTag: string | undefined;
            let killerIsBot: boolean | undefined;
            if (killEvent) {
              const killerSnake = state.snakes.get(killEvent.killerId);
              if (killerSnake) {
                killerIsBot = killerSnake.isBot;
                if (!killerSnake.isBot) {
                  const killerSocketId = this.snakeToSocket.get(killEvent.killerId);
                  if (killerSocketId) {
                    const killerPlayer = this.players.get(killerSocketId);
                    if (killerPlayer) killerTag = killerPlayer.userTag;
                  }
                }
              }
            }
            playersToKill.push({
              snakeId: deadId,
              socketId,
              reason: killEvent ? `killed by ${killEvent.killerName}` : 'collision',
              killerTag,
              killerIsBot,
            });
          }
        }
      }
    }

    // 8b. (Removed) Food hash is now rebuilt every tick (step 5), so death food
    //     is automatically visible on the very next tick. No force-rebuild needed.

    // 9. Respawn dead bots
    for (let r = 0; r < ac.respawnPerTick; r++) {
      respawnDeadBots(state, this.botMix as any, createBotSnakeFactory);
    }

    state.nextFoodId = foodIdRef.value;

    // 10. Handle player deaths — emit events, call API, enter spectator mode
    for (const toKill of playersToKill) {
      this.handlePlayerDeath(toKill.snakeId, toKill.socketId, toKill.reason, toKill.killerTag, toKill.killerIsBot);
    }

    // 11. Broadcast snapshots every N ticks
    if (state.tickCount % SNAPSHOT_INTERVAL === 0) {
      this.broadcastSnapshots();
    }

    // 12. Anti-cheat check every 5 seconds (300 ticks)
    if (state.tickCount % 300 === 0) {
      this.runAntiCheat();
    }
  }

  private handlePlayerDeath(snakeId: string, socketId: string, reason: string, killerTag?: string, killerIsBot?: boolean): void {
    const player = this.players.get(socketId);
    const snake = this.state.snakes.get(snakeId);
    if (!player || !snake) {
      console.log(`[Arena ${this.arenaId}] handlePlayerDeath: missing player=${!player} snake=${!snake} snakeId=${snakeId} socketId=${socketId}`);
      return;
    }

    const durationSeconds = Math.floor((Date.now() - player.joinTime) / 1000);
    const score = snake.score;
    const kills = player.kills;

    console.log(`[Arena ${this.arenaId}] DEATH ${player.name} score=${score} kills=${kills} player.cc=${player.carriedChips} snake.cc=${snake.carriedChips} reason=${reason}`);

    // Save spectator camera position (before snake is deleted)
    player.spectatorHx = snake.path.headX;
    player.spectatorHy = snake.path.headY;

    // Spawn star chips along dead snake's body trail (before snake is deleted)
    const chips = snake.carriedChips;
    if (chips > 0) {
      const segLen = snake.path.length;
      const starRadius = snake.bodyRadius;
      const baseValue = Math.floor(chips / STARS_PER_DEATH);
      const remainder = chips - baseValue * (STARS_PER_DEATH - 1);
      // Stars 1-9: baseValue each. Star 10: remainder (guarantees integer total)
      const now = Date.now();
      const step = segLen > 1 ? Math.max(1, Math.floor((segLen - 1) / (STARS_PER_DEATH - 1))) : 0;
      for (let i = 0; i < STARS_PER_DEATH; i++) {
        // Sample position along body trail (head=0, tail=segLen-1)
        const si = Math.min(i * step, segLen - 1);
        const star: StarOrb = {
          id: this.state.nextStarId++,
          x: snake.path.getX(si),
          y: snake.path.getY(si),
          value: i < STARS_PER_DEATH - 1 ? baseValue : remainder,
          radius: starRadius,
          spawnTime: now,
        };
        // Only push stars with value > 0 (e.g., 7 chips: 9 stars of 0 + 1 star of 7)
        if (star.value > 0) {
          this.state.stars.push(star);
        }
      }
    }

    // Enter spectator mode — keep in this.players so snapshots continue
    player.deadAt = Date.now();

    // Delete the dead snake from game state (but keep player connected)
    this.state.snakes.delete(snakeId);
    this.snakeToSocket.delete(snakeId);

    // If this was the reference player, pick another
    if (this.state.player === snake) {
      this.state.player = [...this.state.snakes.values()].find(s => s.isPlayer && s.alive) || null;
    }

    // Emit killed event (for killer name highlight) and matchEnd to client
    try {
      const killerMatch = reason.match(/^killed by (.+)$/);
      if (killerMatch) {
        player.socket.emit('killed', {
          killerName: killerMatch[1],
          killerTag: killerTag || null,
          killerIsBot: killerIsBot ?? true,
        });
      }
      // Use buyIn as minimum chipsLost (carriedChips may be 0 in edge cases)
      const arenaBuyIn = getArenaById(this.arenaId)?.buyIn ?? 0;
      const chipsLost = Math.max(snake.carriedChips, player.carriedChips, arenaBuyIn);
      console.log(`[Arena ${this.arenaId}] EMIT matchEnd to ${player.name} chipsLost=${chipsLost} (snake.cc=${snake.carriedChips} player.cc=${player.carriedChips} buyIn=${arenaBuyIn})`);
      player.socket.emit('matchEnd', {
        outcome: 'death',
        score,
        kills,
        durationSeconds,
        reason,
        killerTag: killerTag || null,
        killerIsBot: killerIsBot ?? true,
        chipsLost: chipsLost,
      });
    } catch {}

    // Report result to main server (fire and forget)
    this.reportMatchResult(player, 'death', chipsLost, kills, durationSeconds, score)
      .catch(err => console.error(`[Arena ${this.arenaId}] Failed to report match result:`, err));

    // Schedule disconnect AFTER death screen period
    // During this time, the player stays in this.players as a spectator,
    // receiving snapshots so they can see death food + elimination effects.
    try {
      setTimeout(() => {
        // Remove player and disconnect
        this.removePlayer(socketId);
        try { player.socket.disconnect(true); } catch {}
      }, DEATH_SCREEN_DELAY);
    } catch {}
  }

  // ── Extraction Handler ─────────────────────────────────────────────────
  // Called when a client completes the 3-second extraction ring.
  // Validates, calculates commission, credits chips, and emits matchEnd.
  handlePlayerExtraction(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;
    if (player.deadAt > 0) return; // already dead/spectating

    const snake = this.state.snakes.get(player.snakeId);
    if (!snake || !snake.alive) return;

    const collectedChips = Math.max(player.carriedChips, snake.carriedChips);

    // Player always extracts at least their buy-in (arena entry fee)
    const arenaBuyIn = getArenaById(this.arenaId)?.buyIn ?? 0;
    const effectiveChips = Math.max(collectedChips, arenaBuyIn);

    const durationSeconds = Math.floor((Date.now() - player.joinTime) / 1000);
    const score = snake.score;
    const kills = player.kills;

    // Commission: 0% if ≤3 real players, 35% if ≥4
    const realPlayerCount = this.playerCount;
    const commissionRate = realPlayerCount >= 4 ? 0.35 : 0;
    const commission = Math.floor(effectiveChips * commissionRate);
    const bankedAmount = effectiveChips - commission;

    console.log(`[Arena ${this.arenaId}] EXTRACT ${player.name} collected=${collectedChips} buyIn=${arenaBuyIn} effective=${effectiveChips} commission=${commission} (${commissionRate * 100}%) banked=${bankedAmount} players=${realPlayerCount} score=${score} kills=${kills}`);

    // Remove snake from arena (peaceful — no star chip drop)
    this.state.snakes.delete(player.snakeId);
    this.snakeToSocket.delete(player.snakeId);
    if (this.state.player === snake) {
      this.state.player = [...this.state.snakes.values()].find(s => s.isPlayer && s.alive) || null;
    }

    // Emit extraction success to client
    try {
      player.socket.emit('matchEnd', {
        outcome: 'extract',
        score,
        kills,
        durationSeconds,
        carriedChips: effectiveChips,
        commission,
        bankedAmount,
        chipsEarned: bankedAmount,
      });
    } catch {}

    // Report result to main server
    this.reportMatchResult(player, 'extract', effectiveChips, kills, durationSeconds, score, bankedAmount)
      .catch(err => console.error(`[Arena ${this.arenaId}] Failed to report extract result:`, err));

    // Mark as dead (spectator) and schedule disconnect
    player.deadAt = Date.now();
    player.spectatorHx = snake.path.headX;
    player.spectatorHy = snake.path.headY;

    try {
      setTimeout(() => {
        this.removePlayer(socketId);
        try { player.socket.disconnect(true); } catch {}
      }, DEATH_SCREEN_DELAY);
    } catch {}
  }

  private async reportMatchResult(
    player: ConnectedPlayer,
    outcome: 'death' | 'extract',
    carriedChips: number,
    kills: number,
    durationSeconds: number,
    score: number,
    bankedAmount?: number,
  ): Promise<void> {
    try {
      const res = await fetch(`${MAIN_SERVER}/api/match/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({
          userTag: player.userTag,
          arenaId: this.arenaId,
          outcome,
          carriedChips,
          kills,
          durationSeconds,
          score,
          timestamp: Date.now(),
          ...(outcome === 'extract' && bankedAmount !== undefined ? { bankedAmount } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Arena ${this.arenaId}] Match result API error: ${res.status} ${text}`);
      }
    } catch (err) {
      console.error(`[Arena ${this.arenaId}] Match result API fetch error:`, err);
    }
  }

  // ─── Snapshot Broadcasting (spatial-hash-accelerated) ──────────────────

  // Pre-allocated scratch for head hash inserts (avoids per-tick allocation)
  private _headScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: '' };

  // Reusable snapshot buffer (avoids per-player allocation)
  private _snapBuf: {
    tick: number;
    boundaryRadius: number;
    snakes: any[];
    foods: any[];
    ps: number;  // playerScore
    pk: number;  // playerKills
    st: number[]; // nearby stars: flat [x, y, value, id, radius, ...]
    pc: number;  // playerCarriedChips
    m: number[]; // minimap dots: flat [x, y, score, isBot, ...] for ALL bots
  } = { tick: 0, boundaryRadius: 0, snakes: [], foods: [], ps: 0, pk: 0, st: [], pc: 0, m: [] };

  // Pre-allocated snapshot data structures (avoid GC from Map/Set creation every 3 ticks)
  private _snakeLookup = new Map<string, any>();
  private _foodColorMap = new Map<number, string>();
  private _foodMagSet = new Set<number>();

  private broadcastSnapshots(): void {
    const state = this.state;
    const tick = state.tickCount;
    const boundaryRadius = state.boundaryRadius;

    // ── Step 1: REBUILD food hash from CURRENT state.foods[] ──
    const fh = this.foodHash;
    fh.clear();
    const foodScratch = this._headScratch; // reuse scratch object
    const stateFoods = state.foods;
    // Reuse pre-allocated maps (avoid GC from new Map/Set every 3 ticks)
    const foodColorMap = this._foodColorMap;
    const foodMagMap = this._foodMagSet;
    foodColorMap.clear();
    foodMagMap.clear();
    for (let fi = 0; fi < stateFoods.length; fi++) {
      const f = stateFoods[fi];
      foodScratch.x = f.x;
      foodScratch.y = f.y;
      foodScratch.radius = f.radius;
      foodScratch.id = f.id;
      fh.insert(foodScratch);
      foodColorMap.set(f.id, f.color);
      if (f.magnetized) foodMagMap.add(f.id);
    }

    // ── Step 2: Build head spatial hash for O(K) visibility queries ──
    const hh = this.headHash;
    hh.clear();
    const headScratch = this._headScratch; // reuse (food hash is done)
    for (const [, snake] of state.snakes) {
      if (!snake.alive) continue;
      headScratch.x = snake.path.headX;
      headScratch.y = snake.path.headY;
      headScratch.radius = 0;
      headScratch.id = snake.id;
      hh.insert(headScratch);
    }

    // ── Step 3: Pre-build snake snapshot lookup map (reuse pre-allocated Map) ──
    const snakeLookup = this._snakeLookup;
    snakeLookup.clear();
    for (const [, snake] of state.snakes) {
      if (!snake.alive) continue;
      // Reuse the last inserted object if possible (avoids object allocation)
      let entry = snakeLookup.get(snake.id);
      if (!entry) {
        entry = { id: snake.id };
        snakeLookup.set(snake.id, entry);
      }
      entry.name = snake.name;
      entry.hx = snake.path.headX;
      entry.hy = snake.path.headY;
      entry.angle = snake.angle;
      entry.score = snake.score;
      entry.color = snake.color;
      entry.sc = snake.headColor;
      entry.ip = snake.isPlayer;
      entry.ib = snake.isBot;
      entry.bl = snake.cachedBodyLength;
      entry.br = snake.bodyRadius;
      entry.bo = snake.boosting;
      entry.cc = snake.carriedChips || 0;
      entry.si = snake.skinId;
      entry.ra = snake.rarity;
    }

    // ── Step 3.5: Build minimap dots (ALL bots, full map — for minimap rendering) ──
    // Flat array: [x, y, score, isBot(0|1), x, y, score, isBot(0|1), ...]
    // Excludes the current player's own snake for each snapshot.
    // ~16 bytes/snake × 999 = ~16KB per snapshot at 20Hz = 320KB/s — acceptable.
    const minimapDots = this._snapBuf.m;
    minimapDots.length = 0;
    for (const [, snake] of state.snakes) {
      if (!snake.alive) continue;
      minimapDots.push(snake.path.headX, snake.path.headY, snake.score, snake.isBot ? 1 : 0);
    }

    // ── Step 4: Send personalized snapshot to each player (including spectators) ──
    this._snapBuf.tick = tick;
    this._snapBuf.boundaryRadius = boundaryRadius;

    for (const [socketId, player] of this.players) {
      const isSpectator = player.deadAt > 0;
      const playerSnake = isSpectator ? null : state.snakes.get(player.snakeId);

      let phx: number, phy: number;
      let playerScore: number, playerKills: number;

      if (isSpectator) {
        phx = player.spectatorHx;
        phy = player.spectatorHy;
        playerScore = 0;
        playerKills = player.kills;
      } else {
        if (!playerSnake || !playerSnake.alive) continue;
        phx = playerSnake.path.headX;
        phy = playerSnake.path.headY;
        playerScore = playerSnake.score;
        playerKills = player.kills;
      }

      // O(K) spatial hash query for visible snakes
      const nearbyHeads = hh.query(phx, phy, SNAKE_VIS_RANGE);
      const visibleSnakes: any[] = [];
      for (let i = 0; i < nearbyHeads.length; i++) {
        const sid = nearbyHeads[i].id as string;
        const snap = snakeLookup.get(sid);
        if (!snap) continue;
        const dx = snap.hx - phx;
        const dy = snap.hy - phy;
        if (dx * dx + dy * dy < SNAKE_VIS_RANGE_SQ) {
          visibleSnakes.push(snap);
        }
      }

      // O(K) spatial hash query for nearby food + DEDUPLICATION
      // The hash was JUST rebuilt with current positions, so hash positions
      // match state.foods[] exactly. No need for foodPosMap/foodColorMap lookups.
      const nearbyFood = fh.query(phx, phy, FOOD_VIS_RANGE);
      const foodSnaps: any[] = [];
      const seenFoodIds = _snapshotDedupSet;
      seenFoodIds.clear();
      for (let i = 0; i < nearbyFood.length; i++) {
        const f = nearbyFood[i];
        const fid = f.id as number;
        if (seenFoodIds.has(fid)) continue; // dedup: food spanning multiple cells
        seenFoodIds.add(fid);
        const dx = f.x - phx;
        const dy = f.y - phy;
        if (dx * dx + dy * dy < FOOD_VIS_RANGE_SQ) {
          // Look up color and magnetized flag from current food map
          const fcolor = foodColorMap.get(fid) || '#ffffff';
          const mag = foodMagMap.has(fid) ? 1 : 0;
          foodSnaps.push(f.x, f.y, f.radius, fcolor, mag);
        }
      }

      // Build nearby star snaps (flat: x, y, value, id, radius, ...)
      const starSnaps: number[] = [];
      for (let i = 0; i < state.stars.length; i++) {
        const star = state.stars[i];
        const dx = star.x - phx;
        const dy = star.y - phy;
        if (dx * dx + dy * dy < STAR_VIS_RANGE_SQ) {
          starSnaps.push(star.x, star.y, star.value, star.id, star.radius);
        }
      }

      const playerCarriedChips = isSpectator ? 0 : player.carriedChips;

      // Emit snapshot (compact format)
      try {
        player.socket.emit('snapshot', {
          t: tick,
          br: boundaryRadius,
          s: visibleSnakes,
          f: foodSnaps,
          ps: playerScore,
          pk: playerKills,
          st: starSnaps,
          pc: playerCarriedChips,
          m: minimapDots, // minimap dots (all snakes, full map)
        });
      } catch {}
    }
  }
}

// ============================================================================
// Arena Manager — creates/reuses ArenaInstances
// ============================================================================

const arenas: Map<string, ArenaInstance> = new Map();

function getOrCreateArena(arenaId: string): ArenaInstance | null {
  let arena = arenas.get(arenaId);
  if (!arena) {
    arena = new ArenaInstance(arenaId);
    arena.start();
    arenas.set(arenaId, arena);
    console.log(`[GameManager] Created new arena: ${arenaId}`);
  }
  // Enforce player cap
  if (arena.playerCount >= MAX_PLAYERS_PER_ARENA) {
    return null; // caller must emit 'arena-full' error
  }
  return arena;
}

// ============================================================================
// Stats
// ============================================================================

function getStats(): Record<string, { players: number; maxPlayers: number }> {
  const stats: Record<string, { players: number; maxPlayers: number }> = {};
  for (const [arenaId, arena] of arenas) {
    const tier = getArenaById(arenaId);
    const maxPlayers = tier?.botsCount ?? 100; // rough estimate
    stats[arenaId] = {
      players: arena.playerCount,
      maxPlayers,
    };
  }
  return stats;
}

// ============================================================================
// Socket.IO Server
// ============================================================================

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Default path '/socket.io/' — proxied by Caddy XTransformPort or ws-proxy
});

// ─── Auth middleware ────────────────────────────────────────────────────────

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('No auth token provided'));
    }

    // Verify token with main server
    const res = await fetch(`${MAIN_SERVER}/api/match/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return next(new Error(data.reason || 'Verification failed'));
    }

    const data = await res.json();
    if (!data.ok || !data.player) {
      return next(new Error(data.reason || 'Invalid token'));
    }

    // Store player info on socket
    (socket as any).playerData = data.player;
  dbg(`[Auth] Player verified: ${data.player.name} (${data.player.userTag})`);
    next();
  } catch (err) {
    console.error('[Auth] Error verifying token:', err);
    next(new Error('Authentication error'));
  }
});

// ─── Connection handler ────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const playerData = (socket as any).playerData;
  dbg(`[Socket] Connected: ${playerData.name} (${playerData.userTag}) [${socket.id}]`);

  // ─── Join Arena ─────────────────────────────────────────────────────────

  socket.on('join', async (data: { arenaId: string }) => {
    try {
      const arenaId = data?.arenaId;
      if (!arenaId) {
        socket.emit('error', { message: 'No arenaId provided' });
        return;
      }

      // Verify arena exists
      const tier = getArenaById(arenaId);
      if (!tier) {
        socket.emit('error', { message: 'Invalid arena ID' });
        return;
      }

      // Call join API (deduct buyIn)
      const joinRes = await fetch(`${MAIN_SERVER}/api/match/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({
          userTag: playerData.userTag,
          arenaId,
        }),
      });

      if (!joinRes.ok) {
        const joinData = await joinRes.json().catch(() => ({}));
        socket.emit('error', { message: joinData.reason || 'Failed to join arena' });
        return;
      }

      const joinData = await joinRes.json();
      if (!joinData.ok) {
        socket.emit('error', { message: joinData.reason || 'Failed to join arena' });
        return;
      }

      // Get or create arena (with player cap check)
      const arena = getOrCreateArena(arenaId);
      if (!arena) {
        socket.emit('error', { message: 'Arena is full' });
        return;
      }

      // Create player info
      const playerInfo: ConnectedPlayer = {
        socket,
        snakeId: '',
        userTag: playerData.userTag,
        name: playerData.name,
        input: { angle: 0, boost: false },
        joinTime: Date.now(),
        kills: 0,
        color: playerData.color || '#22c55e',
        secondaryColor: playerData.secondaryColor || '#4ade80',
        skinId: playerData.skinId || 'skin-default',
        rarity: playerData.rarity || 'common',
        pattern: playerData.pattern,
        country: playerData.country,
        level: playerData.level || 1,
        clanTag: playerData.clanTag,
        // Validation state
        lastInputTime: 0,
        lastAngle: 0,
        lastInputSeq: 0,
        // Anti-cheat state
        scoreAtJoin: 0,
        foodEatenCount: 0,
        killCount: 0,
        joinTimestamp: Date.now(),
        violations: 0,
        lastPosCheckTime: Date.now(),
        lastPosCheckX: NaN,  // Set to actual spawn position after snake creation
        lastPosCheckY: NaN,
        // Spectator mode
        deadAt: 0,
        spectatorHx: 0,
        spectatorHy: 0,
        carriedChips: 0,
      };

      // Set buy-in as carried chips
      const buyIn = getArenaById(arenaId)?.buyIn ?? 0;
      playerInfo.carriedChips = buyIn;
      console.log(`[Arena ${arenaId}] JOIN ${playerData.name} buyIn=${buyIn} arenaId=${arenaId}`);

      // Spawn player in arena
      const snake = arena.spawnPlayer(playerInfo);
      snake.carriedChips = playerInfo.carriedChips;
      // FIX: Initialize anti-cheat position to actual spawn position
      // (was 0,0 causing instant false-positive on first check)
      playerInfo.lastPosCheckX = snake.path.headX;
      playerInfo.lastPosCheckY = snake.path.headY;
      arena.addPlayer(socket.id, playerInfo, snake);

      dbg(`[Arena ${arenaId}] Player joined: ${playerData.name} — snake: ${snake.id}, total players: ${arena.playerCount}`);

      // Emit joined confirmation
      socket.emit('joined', {
        snakeId: snake.id,
        arenaId,
        config: {
          mapHalf: arena.arenaConfig.mapHalf,
        },
      });

      // Register O(1) socket→arena lookup
      socketToArena.set(socket.id, arenaId);
      // Cancel any pending empty timeout (player rejoining)
      if (arena.emptyTimeout) {
        clearTimeout(arena.emptyTimeout);
        arena.emptyTimeout = null;
      }

      // Clean up on disconnect
      socket.on('disconnect', () => {
        dbg(`[Socket] Disconnected: ${playerData.name} (${playerData.userTag}) [${socket.id}]`);
        socketToArena.delete(socket.id);
        arena.removePlayer(socket.id);
        // Schedule arena cleanup when no players remain
        if (arena.playerCount === 0) {
          arena.lastPlayerLeaveTime = Date.now();
          arena.emptyTimeout = setTimeout(() => {
            if (arena.playerCount === 0) {
              arena.stop();
              arenas.delete(arenaId);
              console.log(`[GameManager] Cleaned up empty arena: ${arenaId}`);
            }
          }, ARENA_EMPTY_TIMEOUT_MS);
        }
      });
    } catch (err) {
      console.error(`[Socket] Join error:`, err);
      socket.emit('error', { message: 'Server error joining arena' });
    }
  });

  // ─── Input Handling (with validation + O(1) arena lookup) ────────────────

  socket.on('input', (data: { angle: number; boost: boolean; seq?: number }) => {
    // O(1) arena lookup instead of scanning all arenas
    const arenaId = socketToArena.get(socket.id);
    if (!arenaId) return;
    const arena = arenas.get(arenaId);
    if (!arena) return;
    const player = arena.players.get(socket.id);
    if (!player) return;
    if (player.deadAt > 0) return; // spectator — ignore input

    const now = performance.now();

    // ── Rate limiting: reject inputs faster than INPUT_MIN_INTERVAL_MS ──
    if (now - player.lastInputTime < INPUT_MIN_INTERVAL_MS) return;
    player.lastInputTime = now;

    // ── Sequence number validation (anti-replay) ──
    if (typeof data.seq === 'number') {
      if (data.seq <= player.lastInputSeq) return; // stale or replayed
      player.lastInputSeq = data.seq;
    }

    // ── Angle validation ──
    if (typeof data.angle !== 'number' || !isFinite(data.angle)) return;

    // Angle rate-of-change check (anti-teleport / impossible turns)
    let angleDelta = Math.abs(data.angle - player.lastAngle);
    if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta; // wrap-around
    if (angleDelta > MAX_ANGLE_DELTA && player.lastInputSeq > 5) {
      // Skip first 5 inputs (player may join facing any direction)
      return;
    }
    player.lastAngle = data.angle;

    // ── Boost validation ──
    player.input.angle = data.angle;
    player.input.boost = typeof data.boost === 'boolean' ? data.boost : false;
  });

  // ─── Extraction (client completes 3s hold) ─────────────────────────────

  socket.on('extract', () => {
    const arenaId = socketToArena.get(socket.id);
    if (!arenaId) return;
    const arena = arenas.get(arenaId);
    if (!arena) return;
    arena.handlePlayerExtraction(socket.id);
  });

  // ─── Stats ───────────────────────────────────────────────────────────

  socket.on('stats', (callback: (data: any) => void) => {
    if (typeof callback === 'function') {
      callback(getStats());
    }
  });
});

// ─── HTTP Stats endpoint ───────────────────────────────────────────────────
// NOTE: We do NOT use httpServer.on('request') because in Bun it replaces
// Socket.IO's request listener. Stats are available via the 'stats' socket event.
// If an HTTP endpoint is needed, use a separate HTTP server.

// ─── Start Server ──────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Venom Game Server] Running on port ${PORT}`);
  console.log(`[Venom Game Server] Stats endpoint: http://localhost:${PORT}/stats`);
});

// Graceful shutdown
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n[Venom Game Server] Shutting down...');
  for (const [, arena] of arenas) {
    arena.stop();
  }
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Venom Game Server] Shutting down...');
  for (const [, arena] of arenas) {
    arena.stop();
  }
  httpServer.close();
  process.exit(0);
});
