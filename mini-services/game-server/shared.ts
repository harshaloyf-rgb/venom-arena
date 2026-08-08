// ============================================================================
// ONLINE Server Shared — Self-contained game logic for online mode ONLY.
//
// This file has its OWN copies of all game logic functions.
// Changes here do NOT affect offline mode.
//
// Shared utilities (types, config, vec2, spatial-hash, pool, bot-ai) are fine
// to import — they are pure data types and utilities with no game logic.
// ============================================================================

// Import config constants for local use (re-export below for game-state.ts)
import {
  BASE_SPEED, BOOST_SPEED, SEGMENT_SPACING,
  START_LENGTH, computeBodyLength, computeBodyRadius,
  INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_DOWNSAMPLE_RADIUS, MAX_SNAKES_PER_SNAPSHOT,
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE,
  BOOST_DROP_COUNT, BOT_COUNT, BOT_MAX_TURN_RATE,
  BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD,
  EXTRACTION_SPEED_BONUS, STAR_CHIP_SPAWN_INTERVAL,
  FOOD_MAGNET_PULL_RADIUS, FOOD_MAGNET_DEATH_RADIUS,
  FOOD_MAGNET_MIN_SPEED, FOOD_MAGNET_MAX_SPEED,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  BASE_TURN_RATE, MIN_TURN_RATE,
  STEERING_LERP, SHARP_TURN_BRAKE,
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS,
  STAR_CHIP_VALUE, STAR_CHIP_RADIUS, STAR_CHIP_GLOW, STAR_CHIP_COLORS,
  BODY_DOWNSAMPLE_INTERVAL,
} from '../../src/lib/snake/config';

// Import utilities for local use
import { PathBuffer, type IPathBuffer } from '../../src/lib/snake/pool';
import { SpatialHash, type SpatialEntity } from '../../src/lib/snake/spatial-hash';

// Re-export types from types.ts (pure types, no logic)
export type {
  FoodOrb, StarChip, SkinRarity, FoodSize,
  SnakeSnapshot, ArenaSnapshot, TurnMetadata,
} from '../../src/lib/snake/types';

// Re-export config (pure constants, no logic)
export {
  BASE_SPEED, BOOST_SPEED, SEGMENT_SPACING,
  START_LENGTH, computeBodyLength, computeBodyRadius,
  INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_DOWNSAMPLE_RADIUS, MAX_SNAKES_PER_SNAPSHOT,
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE,
  BOOST_DROP_COUNT, BOT_COUNT, BOT_MAX_TURN_RATE,
  BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD,
  EXTRACTION_SPEED_BONUS, STAR_CHIP_SPAWN_INTERVAL,
  FOOD_MAGNET_PULL_RADIUS, FOOD_MAGNET_DEATH_RADIUS,
  FOOD_MAGNET_MIN_SPEED, FOOD_MAGNET_MAX_SPEED,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  BASE_TURN_RATE, MIN_TURN_RATE,
  STEERING_LERP, SHARP_TURN_BRAKE,
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS,
  STAR_CHIP_VALUE, STAR_CHIP_RADIUS, STAR_CHIP_GLOW, STAR_CHIP_COLORS,
  BODY_DOWNSAMPLE_INTERVAL,
} from '../../src/lib/snake/config';

// Server-specific config constants (not in shared config.ts — online-only concepts)

/** Arena radius in pixels — circular boundary for the server arena */
export const ARENA_RADIUS = 5000;

/** Target food count maintained by count-based spawning (offline uses density-based) */
export const FOOD_COUNT_TARGET = 500;

/** Radius around a position to spawn food into */
export const FOOD_SPAWN_AREA_RADIUS = 4000;

/** How long the extraction zone stays active (ms) */
export const EXTRACTION_ZONE_DURATION = 60000;

/** How often a new extraction zone spawns (ms) */
export const EXTRACTION_ZONE_SPAWN_INTERVAL = 120000;

/** Server bot count — reduced for sandbox environment stability */
export const SERVER_BOT_COUNT = 20;

// Re-export utilities (pure functions, no game logic)
export { distSq, angleDirect } from '../../src/lib/snake/vec2';
export { getBotTarget, type BotSnakeInput } from '../../src/lib/snake/bot-ai';
export { PathBuffer, type IPathBuffer } from '../../src/lib/snake/pool';
export { SpatialHash, type SpatialEntity } from '../../src/lib/snake/spatial-hash';

// ==========================================================================
// ONLINE-ONLY Types (own copies — not from core.ts)
// ==========================================================================

/** Minimal interface for snake operations in online server functions */
export interface SnakeLike {
  id: string;
  name: string;
  path: IPathBuffer;
  angle: number;
  prevAngle: number;
  speed: number;
  score: number;
  boosting: boolean;
  alive: boolean;
  isBot: boolean;
  isPlayer: boolean;
  spawnTime: number;
  color: string;
  headColor: string;
  lastBoostDrop: number;
  targetAngle: number;
  spiral: {
    active: boolean;
    consecutiveTurns: number;
    ticksElapsed: number;
    direction: 1 | -1;
  };
  bodyRadius: number;
  skinId: string;
  rarity: SkinRarity;
  boostCostAccum?: number;
}

export interface SkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  rarity: SkinRarity;
}

export interface MoveContext {
  foods: FoodOrb[];
  nextFoodId: { value: number };
  extractionZone?: { x: number; y: number; radius: number; active: boolean };
}

export interface CollisionResult {
  deadIds: Set<string>;
  killEvents: Array<{
    victimId: string;
    victimName: string;
    killerId: string;
    killerName: string;
    score: number;
    timestamp: number;
  }>;
}

// ==========================================================================
// ONLINE-ONLY Constants (own copies)
// ==========================================================================

/** Path buffer stores one head position per tick at BASE_SPEED spacing. */
export const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled boost min body */
export const BOOST_MIN_BODY_SCALED = Math.ceil(BOOST_MIN_BODY * SPACING_RATIO);

export const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Python', 'Anaconda', 'Rattler',
  'Sidewinder', 'Boa', 'Asp', 'Taipan', 'Krait', 'Copperhead',
  'KingSnake', 'Coral', 'Adder', 'Basilisk', 'Hydra', 'Ouroboros',
  'Naga', 'Serpent', 'Jormungandr', 'Apep', 'Quetzal', 'Coatl',
  'Wiggles', 'Slithers', 'Fang', 'Venom', 'Toxin', 'Striker',
];

export const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

export const FOOD_SIZES: Array<FoodSize> = ['small', 'medium', 'large'];

export const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
export const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

export const MAGNET_PULL_DIST = SNAKE_RADIUS + FOOD_MAGNET_PULL_RADIUS;
export const MAGNET_DEATH_DIST = SNAKE_RADIUS + FOOD_MAGNET_DEATH_RADIUS;
export const MAGNET_PULL_DIST_SQ = MAGNET_PULL_DIST * MAGNET_PULL_DIST;
export const MAGNET_DEATH_DIST_SQ = MAGNET_DEATH_DIST * MAGNET_DEATH_DIST;

// ==========================================================================
// ONLINE Snake Creation
// ==========================================================================

export function createSnake(
  id: string, name: string, startScore: number,
  posX: number, posY: number, isBot: boolean, now: number,
  skinOverride?: SkinOverride | null,
): SnakeLike {
  const targetLength = computeBodyLength(startScore);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  const angle = 0;

  const pathTarget = Math.max(Math.ceil(targetLength * SPACING_RATIO), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));
  path.resetTo(posX, posY);
  for (let i = 1; i < pathTarget; i++) {
    path.appendTail(
      posX - Math.cos(angle) * i * BASE_SPEED,
      posY - Math.sin(angle) * i * BASE_SPEED,
    );
  }

  const color = skinOverride ? skinOverride.bodyColor : palette[0];
  const headColor = skinOverride ? skinOverride.headColor : palette[1];
  const skinId = skinOverride ? skinOverride.skinId : 'skin-default';
  const rarity = skinOverride ? skinOverride.rarity : 'common' as SkinRarity;

  return {
    id, name, path, angle, prevAngle: angle,
    speed: BASE_SPEED, score: startScore,
    boosting: false, alive: true, isBot, isPlayer: !isBot,
    spawnTime: now, color, headColor,
    lastBoostDrop: 0, targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: computeBodyRadius(startScore), skinId, rarity,
  };
}

// ==========================================================================
// ONLINE Safe Spawn
// ==========================================================================

export function findSafeSpawn(
  snakes: Map<string, SnakeLike>, nearX: number, nearY: number,
  spawnRadius: number = INITIAL_SPAWN_RADIUS,
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

// ==========================================================================
// ONLINE Snake Movement
// ==========================================================================

export function moveSnake(
  snake: SnakeLike, targetAngle: number, wantBoost: boolean, now: number, ctx: MoveContext,
): void {
  snake.targetAngle = targetAngle;
  snake.prevAngle = snake.angle;

  let diff = targetAngle - snake.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  const canBoost = wantBoost && snake.score >= BOOST_MIN_SCORE && snake.path.length > BOOST_MIN_BODY_SCALED;
  const currentSpeed = canBoost ? BOOST_SPEED : BASE_SPEED;
  const speedT = Math.min(1, Math.max(0, (currentSpeed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)));
  let maxTurn = snake.isBot
    ? BOT_MAX_TURN_RATE
    : BASE_TURN_RATE + (MIN_TURN_RATE - BASE_TURN_RATE) * speedT;

  // Spiral assist (players only)
  if (!snake.isBot) {
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
  }

  // Steering Inertia + Dynamic Speed Braking
  const turnAmount = diff * STEERING_LERP;
  const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, turnAmount));
  snake.angle += clampedTurn;
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  const absClampedTurn = Math.abs(clampedTurn);
  const sharpness = maxTurn > 0 ? Math.min(absClampedTurn / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
  const brakeFactor = 1 - SHARP_TURN_BRAKE * smoothT;

  snake.boosting = canBoost;
  snake.speed = (canBoost ? BOOST_SPEED : BASE_SPEED) * brakeFactor;

  if (ctx.extractionZone?.active && snake.score >= EXTRACTION_SCORE_THRESHOLD) {
    const ez = ctx.extractionZone;
    const dx = snake.path.getX(0) - ez.x;
    const dy = snake.path.getY(0) - ez.y;
    if (dx * dx + dy * dy < ez.radius * ez.radius) {
      snake.speed *= EXTRACTION_SPEED_BONUS;
    }
  }

  const newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  const newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;
  snake.path.prepend(newHeadX, newHeadY);

  const logicalLen = computeBodyLength(snake.score);
  const targetLength = Math.ceil(logicalLen * SPACING_RATIO);

  // Boost food drop
  if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
    snake.lastBoostDrop = now;
    const pathLen = snake.path.length;
    const dropCount = Math.min(BOOST_DROP_COUNT, pathLen - 1);
    if (dropCount > 0) {
      const startFrac = 0.15;
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
  snake.bodyRadius = computeBodyRadius(snake.score);
}

// ==========================================================================
// ONLINE Food Creation
// ==========================================================================

export function makeFood(nextId: { value: number }, x: number, y: number, forceSize?: number): FoodOrb {
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

export function spawnFoodBatch(
  nextId: { value: number }, foods: FoodOrb[], count: number, cx: number, cy: number, radius: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * radius;
    foods.push(makeFood(nextId, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ==========================================================================
// ONLINE Food Eating (Magnet + Vacuum)
// ==========================================================================

export function checkFoodEating(
  snakes: Iterable<SnakeLike>, foods: FoodOrb[],
  foodHash: SpatialHash, foodValueCache: Map<number, number>, now: number,
): Set<number> {
  for (let i = 0; i < foods.length; i++) foods[i].magnetized = false;

  foodHash.clear();
  foodValueCache.clear();
  const foodById = new Map<number, FoodOrb>();
  const scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    scratch.x = f.x; scratch.y = f.y; scratch.radius = f.radius; scratch.id = f.id;
    foodHash.insert(scratch);
    foodValueCache.set(f.id, f.value);
    foodById.set(f.id, f);
  }

  const eatenIds = new Set<number>();
  const speedRange = FOOD_MAGNET_MAX_SPEED - FOOD_MAGNET_MIN_SPEED;
  const zoneWidth = MAGNET_PULL_DIST - MAGNET_DEATH_DIST;

  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX; const hy = snake.path.headY;
    if (snake.isPlayer && now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = foodHash.query(hx, hy, MAGNET_PULL_DIST);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const fid = entity.id as number;
      if (eatenIds.has(fid)) continue;
      const food = foodById.get(fid);
      if (!food) continue;

      const dx = hx - food.x; const dy = hy - food.y;
      const dSq = dx * dx + dy * dy;

      if (dSq <= MAGNET_DEATH_DIST_SQ) {
        eatenIds.add(fid);
        snake.score += foodValueCache.get(fid) ?? 1;
        continue;
      }

      if (dSq <= MAGNET_PULL_DIST_SQ) {
        food.magnetized = true;
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

// ==========================================================================
// ONLINE Star Chips
// ==========================================================================

export function spawnStarChip(
  nextId: { value: number }, ez: { x: number; y: number; radius: number; active: boolean }, now: number,
): StarChip | null {
  if (!ez.active) return null;
  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * ez.radius * 0.8;
  const colorIdx = Math.floor(Math.random() * STAR_CHIP_COLORS.length);
  return {
    id: nextId.value++, x: ez.x + Math.cos(a) * d, y: ez.y + Math.sin(a) * d,
    value: STAR_CHIP_VALUE, radius: STAR_CHIP_RADIUS,
    glowColor: STAR_CHIP_GLOW, color: STAR_CHIP_COLORS[colorIdx], spawnTime: now,
  };
}

export function checkStarChips(snakes: Iterable<SnakeLike>, starChips: StarChip[]): Set<number> {
  const collected = new Set<number>();
  if (starChips.length === 0) return collected;
  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX; const hy = snake.path.headY;
    for (let i = 0; i < starChips.length; i++) {
      const chip = starChips[i];
      if (collected.has(chip.id)) continue;
      const dx = hx - chip.x; const dy = hy - chip.y;
      if (dx * dx + dy * dy <= STAR_CHIP_DIST_SQ) {
        collected.add(chip.id);
        snake.score += chip.value;
      }
    }
  }
  return collected;
}

// ==========================================================================
// ONLINE Collisions
// ==========================================================================

export function checkCollisions(
  snakes: Map<string, SnakeLike>, bodyHash: SpatialHash, headHash: SpatialHash,
  scratch: SpatialEntity, now: number,
): CollisionResult {
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    const len = snake.path.length;
    scratch.id = snake.id;
    for (let i = 0; i < len; i += 2) {
      scratch.x = snake.path.getX(i); scratch.y = snake.path.getY(i);
      bodyHash.insert(scratch);
    }
  }

  headHash.clear();
  const dotDist = 0.75;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    scratch.x = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    scratch.y = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const killEvents: CollisionResult['killEvents'] = [];

  // Head-to-body
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id) continue;
      const dx = dotX - entity.x; const dy = dotY - entity.y;
      if (dx * dx + dy * dy <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        const killer = snakes.get(otherId);
        killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: killer?.name ?? 'Unknown', score: snake.score, timestamp: now });
        break;
      }
    }
  }

  // Head-on-head
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;

    const nearby = headHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id || deadSnakes.has(otherId)) continue;
      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const otherDotX = otherSnake.path.headX + Math.cos(otherSnake.angle) * otherSnake.bodyRadius * dotDist;
      const otherDotY = otherSnake.path.headY + Math.sin(otherSnake.angle) * otherSnake.bodyRadius * dotDist;
      const dx = dotX - otherDotX; const dy = dotY - otherDotY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      const lenA = snake.path.length; const lenB = otherSnake.path.length;
      const aBoost = snake.boosting; const bBoost = otherSnake.boosting;

      if (lenA > lenB) {
        if (!aBoost && bBoost) {
          deadSnakes.add(snake.id);
          killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        } else {
          deadSnakes.add(otherId);
          killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
        }
      } else if (lenB > lenA) {
        if (!bBoost && aBoost) {
          deadSnakes.add(otherId);
          killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
        } else {
          deadSnakes.add(snake.id);
          killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        }
      } else {
        deadSnakes.add(snake.id); deadSnakes.add(otherId);
        killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
      }
    }
  }

  return { deadIds: deadSnakes, killEvents };
}

// ==========================================================================
// ONLINE Death & Food Distribution
// ==========================================================================

export function killSnake(snake: SnakeLike, nextFoodId: { value: number }, foods: FoodOrb[]): void {
  snake.alive = false;
  const dropValue = 15 + snake.score;
  const largeCount = Math.max(1, Math.floor(dropValue * 0.4 / 5));
  const medCount = Math.max(1, Math.floor(dropValue * 0.3 / 2));
  let remaining = dropValue - largeCount * 5 - medCount * 2;
  const smallCount = Math.max(1, remaining);
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

  const segLen = snake.path.length;
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

// ==========================================================================
// ONLINE Bot Respawn
// ==========================================================================

export function respawnBots(
  snakes: Map<string, SnakeLike>, botCount: number, tickCount: number, now: number,
): SnakeLike[] {
  let aliveBots = 0;
  for (const [, s] of snakes) { if (s.alive && s.isBot) aliveBots++; }
  const deficit = botCount - aliveBots;
  const toRespawn = Math.min(deficit, 3);
  const newBots: SnakeLike[] = [];
  for (let i = 0; i < toRespawn; i++) {
    const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
    const nameIdx = (tickCount + i) % BOT_NAMES.length;
    const pos = findSafeSpawn(snakes, 0, 0);
    newBots.push(createSnake(`bot-${now}-${i}`, BOT_NAMES[nameIdx], score, pos.x, pos.y, true, now));
  }
  return newBots;
}

// ==========================================================================
// ONLINE Snapshot Builders
// ==========================================================================

export function buildSnakeSnapshot(snake: SnakeLike, tickCount: number): SnakeSnapshot {
  const pathLen = snake.path.length;
  const bodyCount = Math.ceil((pathLen - 1) / BODY_DOWNSAMPLE_INTERVAL);
  const bodyX = new Float32Array(bodyCount);
  const bodyY = new Float32Array(bodyCount);

  let bodyIdx = 0;
  for (let i = 1; i < pathLen; i += BODY_DOWNSAMPLE_INTERVAL) {
    bodyX[bodyIdx] = snake.path.getX(i);
    bodyY[bodyIdx] = snake.path.getY(i);
    bodyIdx++;
  }

  let turn: TurnMetadata | undefined;
  if (snake.spiral.active) {
    turn = {
      tick: tickCount, snakeId: snake.id, isSpiral: true,
      startAngle: snake.angle - snake.spiral.direction * snake.spiral.ticksElapsed * 0.1,
      direction: snake.spiral.direction, theta: snake.spiral.ticksElapsed, expectedDuration: 0,
    };
  }

  return {
    id: snake.id, name: snake.name, hx: snake.path.headX, hy: snake.path.headY,
    angle: snake.angle, length: pathLen, score: snake.score, alive: snake.alive,
    color: snake.color, headColor: snake.headColor, bodyRadius: snake.bodyRadius,
    boosting: snake.boosting, skinId: snake.skinId, rarity: snake.rarity,
    bodyX, bodyY, bodyLen: bodyIdx, turn,
  };
}

function nearAnyPlayer(
  x: number, y: number,
  players: ReadonlyArray<{ x: number; y: number }>, radiusSq: number,
): boolean {
  for (let i = 0; i < players.length; i++) {
    const dx = players[i].x - x; const dy = players[i].y - y;
    if (dx * dx + dy * dy <= radiusSq) return true;
  }
  return false;
}

export function buildArenaSnapshot(
  snakes: Map<string, SnakeLike>, foods: FoodOrb[],
  starChips: StarChip[], tickCount: number,
  extraction: { x: number; y: number; radius: number; active: boolean },
): ArenaSnapshot {
  const aliveSnakes: SnakeLike[] = [];
  for (const [, snake] of snakes) { if (snake.alive) aliveSnakes.push(snake); }
  aliveSnakes.sort((a, b) => {
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;
    return b.score - a.score;
  });
  const cappedSnakes = aliveSnakes.slice(0, MAX_SNAKES_PER_SNAPSHOT);

  const playerPositions: Array<{ x: number; y: number }> = [];
  for (const snake of aliveSnakes) {
    if (snake.isPlayer && snake.path.length > 0) {
      playerPositions.push({ x: snake.path.headX, y: snake.path.headY });
    }
  }

  const snakeSnapshots: SnakeSnapshot[] = [];
  for (const snake of cappedSnakes) snakeSnapshots.push(buildSnakeSnapshot(snake, tickCount));

  const foodRadiusSq = FOOD_DOWNSAMPLE_RADIUS * FOOD_DOWNSAMPLE_RADIUS;
  const filteredFoods: Array<{ id: number; x: number; y: number; size: FoodSize; value: number }> = [];
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (playerPositions.length === 0 || nearAnyPlayer(f.x, f.y, playerPositions, foodRadiusSq)) {
      filteredFoods.push({ id: f.id, x: f.x, y: f.y, size: f.size, value: f.value });
    }
  }

  const starChipsOut = starChips.map(c => ({ id: c.id, x: c.x, y: c.y, value: c.value }));

  return {
    tick: tickCount, timestamp: Date.now(),
    snakes: snakeSnapshots, foods: filteredFoods, starChips: starChipsOut,
    extraction: { x: extraction.x, y: extraction.y, radius: extraction.radius, active: extraction.active },
    obstacles: [],
  };
}
