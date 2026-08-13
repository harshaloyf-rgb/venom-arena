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
  GameState, Snake, FoodOrb, ArenaConfig, SkinRarity, FoodSize, InputState,
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
} from '../../src/lib/snake/config';

// game-config.ts has NO imports — pure data file
import { getArenaById, ARENA_TIERS } from '../../src/lib/game-config';

// ============================================================================
// Constants
// ============================================================================

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-secret';
const MAIN_SERVER = 'http://localhost:3000';
const PORT = 3001;
const TICK_RATE = 60; // ticks per second
const TICK_MS = 1000 / TICK_RATE;
const SNAPSHOT_INTERVAL = 3; // broadcast every N ticks (20Hz)
const DEATH_SCREEN_DELAY = 2000; // ms before disconnecting dead player

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

// Module-level scratch objects (avoid per-tick allocation)
const _foodHashScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
const _cachedFoodById = new Map<number, FoodOrb>();
const _magnetizedIds: number[] = [];
const _eatenIdsSet = new Set<number>();
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
    const d = Math.random() * radius;
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

  const largeCount = Math.min(maxFood, Math.max(1, Math.floor(dropValue * 0.4 / 5)));
  const medCount = Math.min(maxFood - largeCount, Math.max(1, Math.floor(dropValue * 0.3 / 2)));
  let remaining = dropValue - largeCount * 5 - medCount * 2;
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
  useCachedHash: boolean,
): Set<number> {
  // Reset only magnetized food flags
  for (let i = 0; i < _magnetizedIds.length; i++) {
    const f = _cachedFoodById.get(_magnetizedIds[i]);
    if (f) f.magnetized = false;
  }
  _magnetizedIds.length = 0;

  // Rebuild hash from scratch when requested
  if (!useCachedHash) {
    fh.clear();
    fvc.clear();
    _cachedFoodById.clear();
    _magnetizedIds.length = 0;
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

      const dx = hx - food.x;
      const dy = hy - food.y;
      const dSq = dx * dx + dy * dy;

      if (dSq <= MAGNET_DEATH_DIST_SQ) {
        eatenIds.add(fid);
        snake.score += fvc.get(fid) ?? 1;
        continue;
      }

      if (dSq <= MAGNET_PULL_DIST_SQ) {
        food.magnetized = true;
        _magnetizedIds.push(fid);
        const dist = Math.sqrt(dSq);
        const closeness = Math.min(1, Math.max(0, 1 - (dist - MAGNET_DEATH_DIST) / zoneWidth));
        const pullSpeed = FOOD_MAGNET_MIN_SPEED + speedRange * closeness * closeness;
        const invDist = 1 / dist;
        food.x += dx * invDist * pullSpeed;
        food.y += dy * invDist * pullSpeed;
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
  return createSnake(id, name, score, x, y, now, undefined, undefined, undefined, undefined, botType);
}

// ─── Map tier ID → ArenaConfig ───────────────────────────────────────────────

function resolveArenaConfig(arenaId: string): ArenaConfig {
  // Try direct lookup first (practice-easy, practice-medium, practice-hard)
  const direct = ARENA_CONFIGS[arenaId];
  if (direct) return direct;

  // Map tier IDs to difficulty level
  const tier = getArenaById(arenaId);
  if (tier) {
    switch (tier.difficulty) {
      case 'Beginner': return ARENA_CONFIGS['practice-easy'];
      case 'Medium': return ARENA_CONFIGS['practice-medium'];
      case 'High Stakes':
      case 'Extreme':
      case 'Legendary':
        return ARENA_CONFIGS['practice-hard'];
    }
  }

  // Fallback
  return getArenaConfig();
}

// ─── Map tier ID → bot mix (using tier's botsCount) ─────────────────────────

function resolveBotMix(arenaId: string): BotSpawnConfig {
  const tier = getArenaById(arenaId);
  const botsCount = tier?.botsCount ?? 30;

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
      extractionZone: { x: 0, y: 0, radius: 0, active: false },
      botsEnabled: true, // Server always has bots enabled
      arenaConfig: ac,
      boundaryRadius: ac.mapHalf,
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
    const pos = findSafeSpawn(this.state.snakes, 0, 0, ac.spawnRadius * 0.5, ac.safeSpawnDist, ac.safeSpawnAttempts);

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
      spawnBots(state, this.botMix as any, createBotSnakeFactory);
      console.log(`[Arena ${this.arenaId}] Spawned ${state.snakes.size - this.playerCount} bots`);
    }

    // 3. Move all snakes
    const boundaryDead: string[] = [];

    // Move connected players
    for (const [socketId, player] of this.players) {
      const snake = state.snakes.get(player.snakeId);
      if (!snake || !snake.alive) continue;
      const hitWall = moveSnake(snake, player.input.angle, player.input.boost, now, moveCtx);
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
    const playersToKill: { snakeId: string; socketId: string; reason: string }[] = [];
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

    // 5. Check food eating
    const rebuildHash = state.tickCount % ac.foodHashRebuildInterval === 0;
    const eatenIds = checkFoodEating(
      state.snakes.values(), state.foods,
      this.foodHash, this.foodValueCache, now, rebuildHash,
    );
    if (eatenIds.size > 0) {
      let writeIdx = 0;
      for (let i = 0; i < state.foods.length; i++) {
        if (!eatenIds.has(state.foods[i].id)) { state.foods[writeIdx++] = state.foods[i]; }
      }
      state.foods.length = writeIdx;
    }

    // 6. Food management
    if (state.tickCount % ac.playerFoodInterval === 0) {
      maintainFoodAroundPlayer(state.snakes, state.foods, ac, foodIdRef, this.foodHash);
    }
    if (state.tickCount % ac.mapFoodInterval === 0) {
      maintainMapFood(state.foods, ac, foodIdRef);
    }

    // 7. Check collisions
    const collisionResult = checkCollisions(
      state.snakes, this.bodyHash, this.headHash, now,
      undefined, undefined, // No player viewport culling on server (bots fight everywhere)
    );

    // 8. Process collision deaths — drop food for collision kills
    for (const deadId of collisionResult.deadIds) {
      const deadSnake = state.snakes.get(deadId);
      if (!deadSnake) continue;

      killSnake(deadSnake, foodIdRef, state.foods);

      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
      } else {
        // Check if already marked for boundary death
        if (!playersToKill.find(p => p.snakeId === deadId)) {
          const socketId = this.snakeToSocket.get(deadId);
          if (socketId) {
            // Find killer info from kill events
            const killEvent = collisionResult.killEvents.find(e => e.victimId === deadId);
            playersToKill.push({
              snakeId: deadId,
              socketId,
              reason: killEvent ? `killed by ${killEvent.killerName}` : 'collision',
            });
          }
        }
      }
    }

    // 9. Respawn dead bots
    for (let r = 0; r < ac.respawnPerTick; r++) {
      respawnDeadBots(state, this.botMix as any, createBotSnakeFactory);
    }

    state.nextFoodId = foodIdRef.value;

    // 10. Handle player deaths — emit events, call API, schedule disconnect
    for (const toKill of playersToKill) {
      this.handlePlayerDeath(toKill.snakeId, toKill.socketId, toKill.reason);
    }

    // 11. Broadcast snapshots every N ticks
    if (state.tickCount % SNAPSHOT_INTERVAL === 0) {
      this.broadcastSnapshots();
    }
  }

  private handlePlayerDeath(snakeId: string, socketId: string, reason: string): void {
    const player = this.players.get(socketId);
    const snake = this.state.snakes.get(snakeId);
    if (!player || !snake) return;

    const durationSeconds = Math.floor((Date.now() - player.joinTime) / 1000);
    const score = snake.score;
    const kills = player.kills;

    console.log(`[Arena ${this.arenaId}] Player ${player.name} died (${reason}) — score: ${score}, kills: ${kills}, duration: ${durationSeconds}s`);

    // Emit matchEnd to client
    try {
      player.socket.emit('matchEnd', {
        outcome: 'death',
        score,
        kills,
        durationSeconds,
        reason,
      });
    } catch {}

    // Report result to main server (fire and forget)
    this.reportMatchResult(player, 'death', 0, kills, durationSeconds, score)
      .catch(err => console.error(`[Arena ${this.arenaId}] Failed to report match result:`, err));

    // Remove from arena
    this.removePlayer(socketId);

    // Disconnect after delay (client shows death screen)
    try {
      setTimeout(() => {
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

  // ─── Snapshot Broadcasting ───────────────────────────────────────────────

  private broadcastSnapshots(): void {
    const state = this.state;
    const boundaryRadius = state.boundaryRadius;
    const tick = state.tickCount;
    const SNAKE_VIS_RANGE_SQ = 8000 * 8000;
    const FOOD_VIS_RANGE_SQ = 4000 * 4000;

    // Pre-collect all alive snakes as snapshot data
    const snakeSnaps: Array<{
      id: string; name: string; hx: number; hy: number;
      angle: number; score: number; alive: boolean;
      color: string; secondaryColor: string;
      isPlayer: boolean; isBot: boolean;
      bodyLen: number; bodyRadius: number;
      boosting: boolean;
      skinId?: string; rarity?: string;
    }> = [];
    for (const [, snake] of state.snakes) {
      if (!snake.alive) continue;
      snakeSnaps.push({
        id: snake.id,
        name: snake.name,
        hx: snake.path.headX,
        hy: snake.path.headY,
        angle: snake.angle,
        score: snake.score,
        alive: true,
        color: snake.color,
        secondaryColor: snake.headColor,
        isPlayer: snake.isPlayer,
        isBot: snake.isBot,
        bodyLen: snake.cachedBodyLength,
        bodyRadius: snake.bodyRadius,
        boosting: snake.boosting,
        skinId: snake.isPlayer ? snake.skinId : undefined,
        rarity: snake.isPlayer ? snake.rarity : undefined,
      });
    }

    // Build food spatial hash for efficient queries (reuse the existing one)
    const fh = this.foodHash;

    // Send personalized snapshot to each player
    for (const [socketId, player] of this.players) {
      const playerSnake = state.snakes.get(player.snakeId);
      if (!playerSnake || !playerSnake.alive) continue;

      const phx = playerSnake.path.headX;
      const phy = playerSnake.path.headY;

      // Filter visible snakes
      const visibleSnakes: typeof snakeSnaps = [];
      for (let i = 0; i < snakeSnaps.length; i++) {
        const s = snakeSnaps[i];
        const dx = s.hx - phx;
        const dy = s.hy - phy;
        if (dx * dx + dy * dy < SNAKE_VIS_RANGE_SQ) {
          visibleSnakes.push(s);
        }
      }

      // Query nearby food
      const nearbyFood = fh.query(phx, phy, 4000);
      const foodSnaps: Array<{ x: number; y: number; r: number; color: string }> = [];
      for (let i = 0; i < nearbyFood.length; i++) {
        const f = nearbyFood[i];
        const dx = f.x - phx;
        const dy = f.y - phy;
        if (dx * dx + dy * dy < FOOD_VIS_RANGE_SQ) {
          foodSnaps.push({ x: f.x, y: f.y, r: f.radius, color: f.color });
        }
      }

      // Emit snapshot
      try {
        player.socket.emit('snapshot', {
          tick,
          boundaryRadius,
          snakes: visibleSnakes,
          foods: foodSnaps,
          playerScore: playerSnake.score,
          playerKills: player.kills,
          playerX: phx,
          playerY: phy,
          playerAngle: playerSnake.angle,
          playerBoosting: playerSnake.boosting,
          playerAlive: playerSnake.alive,
        });
      } catch {}
    }
  }
}

// ============================================================================
// Arena Manager — creates/reuses ArenaInstances
// ============================================================================

const arenas: Map<string, ArenaInstance> = new Map();

function getOrCreateArena(arenaId: string): ArenaInstance {
  let arena = arenas.get(arenaId);
  if (!arena) {
    arena = new ArenaInstance(arenaId);
    arena.start();
    arenas.set(arenaId, arena);
    console.log(`[GameManager] Created new arena: ${arenaId}`);
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
  // No path — default is '/socket.io/'
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
    console.log(`[Auth] Player verified: ${data.player.name} (${data.player.userTag})`);
    next();
  } catch (err) {
    console.error('[Auth] Error verifying token:', err);
    next(new Error('Authentication error'));
  }
});

// ─── Connection handler ────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const playerData = (socket as any).playerData;
  console.log(`[Socket] Connected: ${playerData.name} (${playerData.userTag}) [${socket.id}]`);

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

      // Get or create arena
      const arena = getOrCreateArena(arenaId);

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
      };

      // Spawn player in arena
      const snake = arena.spawnPlayer(playerInfo);
      arena.addPlayer(socket.id, playerInfo, snake);

      console.log(`[Arena ${arenaId}] Player joined: ${playerData.name} — snake: ${snake.id}, total players: ${arena.playerCount}`);

      // Emit joined confirmation
      socket.emit('joined', {
        snakeId: snake.id,
        arenaId,
        config: {
          mapHalf: arena.arenaConfig.mapHalf,
        },
      });

      // Clean up on disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${playerData.name} (${playerData.userTag}) [${socket.id}]`);
        arena.removePlayer(socket.id);
        // Clean up empty arena
        if (arena.playerCount === 0 && arena.state.snakes.size === 0) {
          arena.stop();
          arenas.delete(arenaId);
          console.log(`[GameManager] Cleaned up empty arena: ${arenaId}`);
        }
      });
    } catch (err) {
      console.error(`[Socket] Join error:`, err);
      socket.emit('error', { message: 'Server error joining arena' });
    }
  });

  // ─── Input Handling ────────────────────────────────────────────────────

  socket.on('input', (data: { angle: number; boost: boolean }) => {
    // Find which arena this player is in
    for (const [, arena] of arenas) {
      const player = arena.players.get(socket.id);
      if (player) {
        if (typeof data.angle === 'number') {
          player.input.angle = data.angle;
        }
        if (typeof data.boost === 'boolean') {
          player.input.boost = data.boost;
        }
        break;
      }
    }
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
