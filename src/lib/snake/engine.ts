// ============================================================================
// OFFLINE Game Engine — Self-contained game logic for offline mode ONLY.
//
// This file has its OWN copies of all game logic functions.
// Changes here do NOT affect online mode.
//
// Shared utilities (types, config, vec2, spatial-hash, pool, bot-ai) are fine
// to import — they are pure data types and utilities with no game logic.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, StarChip, SkinRarity,
  SnakeSnapshot, ArenaSnapshot, FoodSize, TurnMetadata,
} from './types';
import type { IPathBuffer } from './pool';
import { PathBuffer } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { distSq } from './vec2';
import type { BotSnakeInput } from './bot-ai';
import { getBotTarget } from './bot-ai';
import {
  // MOVEMENT
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE, SEGMENT_SPACING,
  STEERING_LERP, SHARP_TURN_BRAKE,
  computeBodyLength, computeBodyRadius,
  // FOOD
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS,
  // COLLISION
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  // FOOD MAGNET
  FOOD_MAGNET_PULL_RADIUS, FOOD_MAGNET_DEATH_RADIUS,
  FOOD_MAGNET_MIN_SPEED, FOOD_MAGNET_MAX_SPEED,
  // BOOST
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE, BOOST_DROP_COUNT,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  // BOT
  BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  // SPAWN
  INITIAL_SPAWN_RADIUS, SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // EXTRACTION
  EXTRACTION_SCORE_THRESHOLD, EXTRACTION_SPEED_BONUS,
  STAR_CHIP_VALUE, STAR_CHIP_RADIUS, STAR_CHIP_GLOW, STAR_CHIP_COLORS,
  // SPIRAL
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  // SNAPSHOT
  BODY_DOWNSAMPLE_INTERVAL, FOOD_DOWNSAMPLE_RADIUS, MAX_SNAKES_PER_SNAPSHOT,
  // OFFLINE-SPECIFIC
  BOT_COUNT,
  FOOD_DENSITY_TARGET, FOOD_VISIBLE_RADIUS, FOOD_DESPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_MAX_COUNT,
  EXTRACTION_ZONE_RADIUS, STAR_CHIP_SPAWN_INTERVAL,
} from './config';

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { buildSnapshot, snapshotToSnake } from './snapshot';

// ─── Offline-only Types ──────────────────────────────────────────────────────

/** Optional skin override for the player snake (offline-specific — includes pattern/animation) */
export interface PlayerSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  pattern?: any;
  animation?: any;
  rarity: SkinRarity;
}

/** Kill event from offline collisions */
export interface KillEvent {
  victimId: string;
  victimName: string;
  killerId: string;
  killerName: string;
  score: number;
  timestamp: number;
}

// ─── Offline-only Constants ──────────────────────────────────────────────────

/** Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly. */
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled boost min body: covers same physical distance as BOOST_MIN_BODY * SEGMENT_SPACING */
const BOOST_MIN_BODY_SCALED = Math.ceil(BOOST_MIN_BODY * SPACING_RATIO);

const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Python', 'Anaconda', 'Rattler',
  'Sidewinder', 'Boa', 'Asp', 'Taipan', 'Krait', 'Copperhead',
  'KingSnake', 'Coral', 'Adder', 'Basilisk', 'Hydra', 'Ouroboros',
  'Naga', 'Serpent', 'Jormungandr', 'Apep', 'Quetzal', 'Coatl',
  'Wiggles', 'Slithers', 'Fang', 'Venom', 'Toxin', 'Striker',
];

const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<FoodSize> = ['small', 'medium', 'large'];

const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

const MAGNET_PULL_DIST = SNAKE_RADIUS + FOOD_MAGNET_PULL_RADIUS;
const MAGNET_DEATH_DIST = SNAKE_RADIUS + FOOD_MAGNET_DEATH_RADIUS;
const MAGNET_PULL_DIST_SQ = MAGNET_PULL_DIST * MAGNET_PULL_DIST;
const MAGNET_DEATH_DIST_SQ = MAGNET_DEATH_DIST * MAGNET_DEATH_DIST;

// ─── Move Context (passed to moveSnake) ─────────────────────────────────────

interface MoveContext {
  foods: FoodOrb[];
  nextFoodId: { value: number };
  extractionZone?: { x: number; y: number; radius: number; active: boolean };
}

// ─── Module-level singletons ─────────────────────────────────────────────────

const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();
const headHash = new SpatialHash();
const foodValueCache = new Map<number, number>();
const _insertScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
const DESPAWN_RADIUS_SQ = FOOD_DESPAWN_RADIUS * FOOD_DESPAWN_RADIUS;
const VISIBLE_RADIUS_SQ = FOOD_VISIBLE_RADIUS * FOOD_VISIBLE_RADIUS;

// ==========================================================================
// OFFLINE Snake Creation
// ==========================================================================

function createSnake(
  id: string, name: string, startScore: number,
  posX: number, posY: number, isBot: boolean, now: number,
  skinOverride?: PlayerSkinOverride | null,
): Snake {
  const targetLength = computeBodyLength(startScore);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  const angle = 0;

  const pathTarget = Math.max(Math.ceil(targetLength * SPACING_RATIO), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));
  path.resetTo(posX, posY);
  for (let i = 1; i < pathTarget; i++) {
    const x = posX - Math.cos(angle) * i * BASE_SPEED;
    const y = posY - Math.sin(angle) * i * BASE_SPEED;
    path.appendTail(x, y);
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
// OFFLINE Safe Spawn
// ==========================================================================

function findSafeSpawn(
  snakes: Map<string, Snake>,
  nearX: number, nearY: number,
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
// OFFLINE Snake Movement
// ==========================================================================

function moveSnake(snake: Snake, targetAngle: number, wantBoost: boolean, now: number, ctx: MoveContext): void {
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
  const baseSpeedForState = canBoost ? BOOST_SPEED : BASE_SPEED;
  snake.speed = baseSpeedForState * brakeFactor;

  if (ctx.extractionZone?.active && snake.score >= EXTRACTION_SCORE_THRESHOLD) {
    const ez = ctx.extractionZone;
    const dx = snake.path.getX(0) - ez.x;
    const dy = snake.path.getY(0) - ez.y;
    if (dx * dx + dy * dy < ez.radius * ez.radius) {
      snake.speed *= EXTRACTION_SPEED_BONUS;
    }
  }

  // Path buffer movement
  const newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  const newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;
  snake.path.prepend(newHeadX, newHeadY);

  // Growth / Shrink
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
// OFFLINE Food Creation
// ==========================================================================

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

// ==========================================================================
// OFFLINE Food Eating (Magnet + Vacuum)
// ==========================================================================

function checkFoodEating(
  snakes: Iterable<Snake>, foods: FoodOrb[],
  fh: SpatialHash, fvc: Map<number, number>, now: number,
): Set<number> {
  for (let i = 0; i < foods.length; i++) foods[i].magnetized = false;

  fh.clear();
  fvc.clear();
  const foodById = new Map<number, FoodOrb>();
  const scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    scratch.x = f.x; scratch.y = f.y; scratch.radius = f.radius; scratch.id = f.id;
    fh.insert(scratch);
    fvc.set(f.id, f.value);
    foodById.set(f.id, f);
  }

  const eatenIds = new Set<number>();
  const speedRange = FOOD_MAGNET_MAX_SPEED - FOOD_MAGNET_MIN_SPEED;
  const zoneWidth = MAGNET_PULL_DIST - MAGNET_DEATH_DIST;

  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    if (snake.isPlayer && now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

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
// OFFLINE Star Chips
// ==========================================================================

function spawnStarChip(nextId: { value: number }, ez: { x: number; y: number; radius: number; active: boolean }, now: number): StarChip | null {
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

function checkStarChips(snakes: Iterable<Snake>, starChips: StarChip[]): Set<number> {
  const collected = new Set<number>();
  if (starChips.length === 0) return collected;
  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX; const hy = snake.path.headY;
    for (let i = 0; i < starChips.length; i++) {
      const chip = starChips[i];
      if (collected.has(chip.id)) continue;
      if (distSq(hx, hy, chip.x, chip.y) <= STAR_CHIP_DIST_SQ) {
        collected.add(chip.id);
        snake.score += chip.value;
      }
    }
  }
  return collected;
}

// ==========================================================================
// OFFLINE Collisions
// ==========================================================================

interface CollisionResult {
  deadIds: Set<string>;
  killEvents: KillEvent[];
}

function checkCollisions(
  snakes: Map<string, Snake>, bh: SpatialHash, hh: SpatialHash, scratch: SpatialEntity, now: number,
): CollisionResult {
  bh.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    const len = snake.path.length;
    scratch.id = snake.id;
    for (let i = 0; i < len; i += 2) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      bh.insert(scratch);
    }
  }

  hh.clear();
  const dotDist = 0.75;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    scratch.x = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    scratch.y = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    hh.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const killEvents: KillEvent[] = [];

  // Head-to-body
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bh.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id) continue;
      if (distSq(dotX, dotY, entity.x, entity.y) <= COLLISION_DIST_SQ) {
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

    const nearby = hh.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id || deadSnakes.has(otherId)) continue;
      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const otherDotX = otherSnake.path.headX + Math.cos(otherSnake.angle) * otherSnake.bodyRadius * dotDist;
      const otherDotY = otherSnake.path.headY + Math.sin(otherSnake.angle) * otherSnake.bodyRadius * dotDist;
      const dx = dotX - otherDotX;
      const dy = dotY - otherDotY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      const lenA = snake.path.length;
      const lenB = otherSnake.path.length;
      const aBoost = snake.boosting;
      const bBoost = otherSnake.boosting;

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
        deadSnakes.add(snake.id);
        deadSnakes.add(otherId);
        killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
      }
    }
  }

  return { deadIds: deadSnakes, killEvents };
}

// ==========================================================================
// OFFLINE Death & Food Distribution
// ==========================================================================

function killSnake(snake: Snake, nextFoodId: { value: number }, foods: FoodOrb[]): void {
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
// OFFLINE Bot Respawn
// ==========================================================================

function respawnBots(snakes: Map<string, Snake>, botCount: number, tickCount: number, now: number): Snake[] {
  let aliveBots = 0;
  for (const [, s] of snakes) { if (s.alive && s.isBot) aliveBots++; }
  const deficit = botCount - aliveBots;
  const toRespawn = Math.min(deficit, 3);
  const newBots: Snake[] = [];
  for (let i = 0; i < toRespawn; i++) {
    const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
    const nameIdx = (tickCount + i) % BOT_NAMES.length;
    const pos = findSafeSpawn(snakes, 0, 0);
    const bot = createSnake(`bot-${now}-${i}`, BOT_NAMES[nameIdx], score, pos.x, pos.y, true, now);
    newBots.push(bot);
  }
  return newBots;
}

// ==========================================================================
// Initialization
// ==========================================================================

/** Create the initial game state (player + bots + 3000 initial food) */
export function createInitialState(
  playerSkin?: PlayerSkinOverride | null,
  initialScore?: number,
): GameState {
  const state: GameState = {
    snakes: new Map(), foods: [], starChips: [], player: null,
    nextFoodId: 0, nextStarChipId: 0, showControls: true, tickCount: 0,
    extractionZone: { x: 0, y: 0, radius: EXTRACTION_ZONE_RADIUS, active: false },
  };

  const now = Date.now();
  const nextIdRef = { value: 0 };

  const player = createSnake('player', 'You', initialScore ?? 0, 0, 0, false, now, playerSkin);
  state.player = player;
  state.snakes.set(player.id, player);

  for (let i = 0; i < BOT_COUNT; i++) {
    const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
    const nameIdx = i % BOT_NAMES.length;
    const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
    const pos = findSafeSpawn(state.snakes, 0, 0);
    const bot = createSnake(`bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos.x, pos.y, true, now);
    state.snakes.set(bot.id, bot);
  }

  spawnFoodBatch(nextIdRef, state.foods, 3000, 0, 0, INITIAL_SPAWN_RADIUS);
  state.nextFoodId = nextIdRef.value;

  return state;
}

// ==========================================================================
// Main Game Tick (OFFLINE ONLY)
// ==========================================================================

export function gameTick(state: GameState, input: InputState, _dt: number): KillEvent[] {
  state.tickCount++;
  const now = Date.now();

  const foodIdRef = { value: state.nextFoodId };
  const chipIdRef = { value: state.nextStarChipId };

  const moveCtx: MoveContext = {
    foods: state.foods,
    nextFoodId: foodIdRef,
    extractionZone: state.extractionZone,
  };

  const botInputMap = state.snakes as unknown as Map<string, BotSnakeInput>;

  // 1. Move player
  const player = state.player;
  if (player && player.alive) {
    moveSnake(player, input.targetAngle, input.boosting, now, moveCtx);
  }

  // 2. Move bots
  for (const [, snake] of state.snakes) {
    if (!snake.alive || !snake.isBot) continue;
    const botAngle = getBotTarget(snake as BotSnakeInput, botInputMap, state.foods);
    moveSnake(snake, botAngle, false, now, moveCtx);
  }

  // 3. Check food eating
  const eatenIds = checkFoodEating(state.snakes.values(), state.foods, foodHash, foodValueCache, now);
  if (eatenIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < state.foods.length; i++) {
      if (!eatenIds.has(state.foods[i].id)) { state.foods[writeIdx++] = state.foods[i]; }
    }
    state.foods.length = writeIdx;
  }

  // 4. Check star chip collection
  const collectedIds = checkStarChips(state.snakes.values(), state.starChips);
  if (collectedIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < state.starChips.length; i++) {
      if (!collectedIds.has(state.starChips[i].id)) { state.starChips[writeIdx++] = state.starChips[i]; }
    }
    state.starChips.length = writeIdx;
  }

  // 5. Density-based food spawning (OFFLINE-SPECIFIC)
  maintainFoodAroundPlayer(state, foodIdRef);

  // 6. Spawn star chips in extraction zone
  if (state.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
    const chip = spawnStarChip(chipIdRef, state.extractionZone, now);
    if (chip) state.starChips.push(chip);
  }

  // 7. Check collisions
  const collisionResult = checkCollisions(state.snakes, bodyHash, headHash, _insertScratch, now);
  for (const deadId of collisionResult.deadIds) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake) {
      killSnake(deadSnake, foodIdRef, state.foods);
      if (!deadSnake.isPlayer) { state.snakes.delete(deadId); }
    }
  }

  // 8. Respawn dead bots
  const newBots = respawnBots(state.snakes, BOT_COUNT, state.tickCount, now);
  for (const bot of newBots) { state.snakes.set(bot.id, bot); }

  state.nextFoodId = foodIdRef.value;
  state.nextStarChipId = chipIdRef.value;

  return collisionResult.killEvents;
}

// ==========================================================================
// Offline-Specific Food Management (density-based, slither.io style)
// ==========================================================================

function maintainFoodAroundPlayer(state: GameState, nextIdRef: { value: number }): void {
  const player = state.player;
  const refSnake = (player && player.alive && player.path.length > 0)
    ? player
    : [...state.snakes.values()].find(s => s.alive && s.path.length > 0);
  if (!refSnake) return;

  const hx = refSnake.path.headX;
  const hy = refSnake.path.headY;
  const angle = refSnake.angle;
  const foods = state.foods;

  let nearbyCount = 0;
  let writeIdx = 0;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const dx = f.x - hx; const dy = f.y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq > DESPAWN_RADIUS_SQ) continue;
    if (writeIdx !== i) foods[writeIdx] = f;
    writeIdx++;
    if (dSq < VISIBLE_RADIUS_SQ) nearbyCount++;
  }
  foods.length = writeIdx;

  const deficit = FOOD_DENSITY_TARGET - nearbyCount;
  if (deficit <= 0 || foods.length >= FOOD_MAX_COUNT) return;
  const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);

  const uniformCount = Math.ceil(batch * 0.5);
  const aheadCount = Math.ceil(batch * 0.3);
  const aroundCount = batch - uniformCount - aheadCount;

  for (let i = 0; i < uniformCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aheadCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.8;
    const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
    const a = angle + spread;
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aroundCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * (FOOD_VISIBLE_RADIUS - 800);
    foods.push(makeFood(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
}

// ==========================================================================
// Player Respawn (OFFLINE)
// ==========================================================================

export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;
  const pos = findSafeSpawn(state.snakes, 0, 0);
  const skinOverride = old ? {
    skinId: old.skinId, bodyColor: old.color, headColor: old.headColor,
    accentColor: '', rarity: old.rarity,
  } : null;
  const newPlayer = createSnake('player', 'You', 0, pos.x, pos.y, false, Date.now(), skinOverride);
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}

// ==========================================================================
// Debug Score (OFFLINE)
// ==========================================================================

export function setDebugScore(state: GameState, score: number): void {
  const player = state.player;
  if (!player) return;
  player.score = score;
  player.bodyRadius = computeBodyRadius(score);
  player.boostCostAccum = 0;

  const targetPathLen = Math.ceil(computeBodyLength(score) * SPACING_RATIO);
  const currentLen = player.path.length;

  if (targetPathLen > currentLen) {
    const tailIdx = currentLen - 1;
    const prevIdx = Math.max(0, tailIdx - 1);
    const dx = player.path.getX(tailIdx) - player.path.getX(prevIdx);
    const dy = player.path.getY(tailIdx) - player.path.getY(prevIdx);
    const segLen = Math.sqrt(dx * dx + dy * dy) || BASE_SPEED;
    const nx = (dx / segLen) * BASE_SPEED;
    const ny = (dy / segLen) * BASE_SPEED;
    let lastX = player.path.getX(tailIdx);
    let lastY = player.path.getY(tailIdx);
    (player.path as unknown as { ensureCapacity(n: number): void }).ensureCapacity(targetPathLen + 10);
    const needed = targetPathLen - currentLen;
    for (let i = 0; i < needed; i++) {
      lastX += nx; lastY += ny;
      player.path.appendTail(lastX, lastY);
    }
  } else if (targetPathLen < currentLen) {
    while (player.path.length > targetPathLen) { player.path.pop(); }
  }
}
