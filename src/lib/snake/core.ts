// ============================================================================
// Snake Core Engine — Unified game logic for BOTH offline and online modes.
//
// This file contains ALL pure game logic functions. Both the offline engine
// (src/lib/snake/engine.ts) and the online game server
// (mini-services/game-server/game-state.ts) use these SAME functions.
//
// No module-level mutable state — all state is passed as parameters.
// ============================================================================

import type { FoodOrb, StarChip, SkinRarity, TurnMetadata, SnakeSnapshot, ArenaSnapshot, FoodSize } from './types';
import type { IPathBuffer } from './pool';
import { PathBuffer } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { distSq } from './vec2';
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
} from './config';

// ─── SnakeLike Interface ─────────────────────────────────────────────────────

/** Minimal interface for snake operations in core functions.
 *  Both offline Snake and online ServerSnake satisfy this. */
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

// ─── Shared Constants ───────────────────────────────────────────────────────

/** Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly. */
export const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled boost min body: covers same physical distance as BOOST_MIN_BODY * SEGMENT_SPACING */
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
export const EAT_DIST_SQ = (SNAKE_RADIUS + 10) * (SNAKE_RADIUS + 10);
export const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

// ─── Skin Override ───────────────────────────────────────────────────────────

export interface SkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  rarity: SkinRarity;
}

// ─── Move Context (passed to moveSnake) ─────────────────────────────────────

export interface MoveContext {
  /** Food array to push boost-dropped food into */
  foods: FoodOrb[];
  /** Mutable food ID counter */
  nextFoodId: { value: number };
  /** Optional extraction zone for speed bonus */
  extractionZone?: { x: number; y: number; radius: number; active: boolean };
}

// ─── Collision Result ────────────────────────────────────────────────────────

export interface KillEvent {
  victimId: string;
  victimName: string;
  killerId: string;
  killerName: string;
  score: number;
  timestamp: number;
}

export interface CollisionResult {
  deadIds: Set<string>;
  killEvents: KillEvent[];
}

// ==========================================================================
// Snake Creation
// ==========================================================================

/** Create a single snake with PathBuffer for path history.
 *  This is THE canonical snake creation — both offline and online use this. */
export function createSnake(
  id: string,
  name: string,
  startScore: number,
  posX: number,
  posY: number,
  isBot: boolean,
  now: number,
  skinOverride?: SkinOverride | null,
): SnakeLike {
  const targetLength = computeBodyLength(startScore);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  // Start facing right (angle=0) to match InputHandler's initial targetAngle=0.
  // Prevents violent spin on game start.
  const angle = 0;

  // Path buffer stores head history (one position per tick at BASE_SPEED spacing).
  // Scale the buffer size to match the visual length of SEGMENT_SPACING-based segments.
  const pathTarget = Math.max(Math.ceil(targetLength * SPACING_RATIO), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));

  // Initialize: index 0 = head, body trailing behind at BASE_SPEED intervals
  path.resetTo(posX, posY);
  for (let i = 1; i < pathTarget; i++) {
    const x = posX - Math.cos(angle) * i * BASE_SPEED;
    const y = posY - Math.sin(angle) * i * BASE_SPEED;
    path.appendTail(x, y);
  }

  // Apply skin override for player snakes
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
    bodyRadius: computeBodyRadius(startScore),
    skinId, rarity,
  };
}

// ==========================================================================
// Safe Spawn
// ==========================================================================

/** Find a safe spawn position away from all other snakes */
export function findSafeSpawn(
  snakes: Map<string, SnakeLike>,
  nearX: number,
  nearY: number,
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
      if (dx * dx + dy * dy < safeDistSq) {
        safe = false;
        break;
      }
    }
    if (safe) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  return { x: nearX + Math.cos(a) * spawnRadius, y: nearY + Math.sin(a) * spawnRadius };
}

// ==========================================================================
// Snake Movement (THE core function — same for both modes)
// ==========================================================================

export function moveSnake(
  snake: SnakeLike,
  targetAngle: number,
  wantBoost: boolean,
  now: number,
  ctx: MoveContext,
): void {
  // Store target angle so renderers can use it (responsive eyes, etc.)
  snake.targetAngle = targetAngle;
  // Store previous angle for turn detection
  snake.prevAngle = snake.angle;

  // ── Angle computation with Spiral Assist ───────────────────────────
  let diff = targetAngle - snake.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  // Determine speed for turn rate (before we know final speed, use current)
  const canBoost = wantBoost &&
    snake.score >= BOOST_MIN_SCORE &&
    snake.path.length > BOOST_MIN_BODY_SCALED;
  const currentSpeed = canBoost ? BOOST_SPEED : BASE_SPEED;
  const speedT = Math.min(1, Math.max(0, (currentSpeed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)));
  let maxTurn = snake.isBot
    ? BOT_MAX_TURN_RATE
    : BASE_TURN_RATE + (MIN_TURN_RATE - BASE_TURN_RATE) * speedT;

  // ── Spiral assist (players only) ────────────────────────────────────
  // Key fix vs old system: exit check uses INPUT diff, not the spiral's
  // own output angle. This prevents the infinite-spin bug.
  if (!snake.isBot) {
    const absDiff = Math.abs(diff);
    const turnDir: 1 | -1 = diff >= 0 ? 1 : -1;
    const sp = snake.spiral;

    if (!sp.active) {
      // ── Entry detection ──
      if (absDiff >= SPIRAL_TURN_THRESHOLD && turnDir === sp.direction) {
        sp.consecutiveTurns++;
      } else {
        // Different direction or too small — reset counter
        sp.direction = turnDir;
        sp.consecutiveTurns = absDiff >= SPIRAL_TURN_THRESHOLD ? 1 : 0;
      }
      if (sp.consecutiveTurns >= SPIRAL_ENTER_TICKS) {
        sp.active = true;
        sp.ticksElapsed = 0;
      }
    } else {
      // ── Active spiral ──
      // Exit: player straightened out or changed direction (check INPUT, not output)
      if (absDiff < SPIRAL_EXIT_THRESHOLD || turnDir !== sp.direction) {
        sp.active = false;
        sp.consecutiveTurns = 0;
      } else {
        // Ramp up: gradually increase turn rate multiplier
        sp.ticksElapsed++;
        const t = Math.min(1, sp.ticksElapsed / SPIRAL_RAMP_TICKS);
        const multiplier = 1 + (SPIRAL_MAX_MULTIPLIER - 1) * t;
        maxTurn *= multiplier;
      }
    }
  }

  // ── Steering Inertia + Dynamic Speed Braking ──────────────────────
  // Proportional dampening: apply a fraction of remaining angle diff.
  // Near target → tiny turn (buttery convergence). Far target → clamped to maxTurn.
  // This replaces the old binary snap-or-clamp that caused twitchy feel.
  const turnAmount = diff * STEERING_LERP;
  const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, turnAmount));
  snake.angle += clampedTurn;

  // Normalize angle to [-PI, PI]
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  // Dynamic speed braking: sharp turns reduce forward speed.
  // Uses smoothstep curve so braking kicks in gradually, not abruptly.
  // sharpness 0 = going straight, 1 = turning at max rate.
  const absClampedTurn = Math.abs(clampedTurn);
  const sharpness = maxTurn > 0 ? Math.min(absClampedTurn / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness); // smoothstep
  const brakeFactor = 1 - SHARP_TURN_BRAKE * smoothT;

  snake.boosting = canBoost;
  const baseSpeedForState = canBoost ? BOOST_SPEED : BASE_SPEED;
  snake.speed = baseSpeedForState * brakeFactor;

  // Extraction zone speed bonus (applied on top of braking)
  if (ctx.extractionZone?.active && snake.score >= EXTRACTION_SCORE_THRESHOLD) {
    const ez = ctx.extractionZone;
    const dx = snake.path.getX(0) - ez.x;
    const dy = snake.path.getY(0) - ez.y;
    if (dx * dx + dy * dy < ez.radius * ez.radius) {
      snake.speed *= EXTRACTION_SPEED_BONUS;
    }
  }

  // ── PATH BUFFER MOVEMENT ────────────────────────────────────────────
  const newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  const newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;
  snake.path.prepend(newHeadX, newHeadY);

  // ── Growth / Shrink ────────────────────────────────────────────────
  const logicalLen = computeBodyLength(snake.score);
  const targetLength = Math.ceil(logicalLen * SPACING_RATIO);

  // Boost food drop: leave food orbs along the body every interval.
  // Drops BOOST_DROP_COUNT orbs spaced from ~15% to 100% of body length.
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
          id: ctx.nextFoodId.value++,
          x: snake.path.getX(idx),
          y: snake.path.getY(idx),
          size: 'small', value: 1, radius: FOOD_RADII[0],
          color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
        });
      }
    }
  }

  // Boost score cost: integer-based — deduct 1 point every N ticks.
  if (canBoost) {
    snake.boostCostAccum = (snake.boostCostAccum ?? 0) + 1;
    if (snake.boostCostAccum >= BOOST_SCORE_COST_INTERVAL) {
      snake.boostCostAccum = 0;
      snake.score = Math.max(0, snake.score - BOOST_SCORE_COST_AMOUNT);
    }
  } else {
    snake.boostCostAccum = 0;
  }

  // ── Length management ──────────────────────────────────────────────
  // prepend adds 1 every tick. Allow up to 2 pops per tick so
  // excess length drains faster than it accumulates.
  const excess = snake.path.length - targetLength;
  if (excess > 0) {
    const pops = Math.min(excess, 2);
    for (let i = 0; i < pops; i++) snake.path.pop();
  }

  // Update visual body radius
  snake.bodyRadius = computeBodyRadius(snake.score);
}

// ==========================================================================
// Food Creation
// ==========================================================================

export function makeFood(
  nextId: { value: number },
  x: number,
  y: number,
  forceSize?: number,
): FoodOrb {
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
    size: FOOD_SIZES[sizeIndex],
    value: FOOD_VALUES[sizeIndex],
    radius: FOOD_RADII[sizeIndex],
    color: FOOD_COLORS[sizeIndex],
    glowColor: FOOD_GLOW_COLORS[sizeIndex],
  };
}

export function spawnFoodBatch(
  nextId: { value: number },
  foods: FoodOrb[],
  count: number,
  cx: number, cy: number, radius: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * radius;
    foods.push(makeFood(nextId, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ==========================================================================
// Food Eating
// ==========================================================================

/** Check food eating for all snakes. Returns set of eaten food IDs. */
export function checkFoodEating(
  snakes: Iterable<SnakeLike>,
  foods: FoodOrb[],
  foodHash: SpatialHash,
  foodValueCache: Map<number, number>,
  now: number,
): Set<number> {
  // Build food spatial hash + value cache
  foodHash.clear();
  foodValueCache.clear();
  const scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    scratch.x = f.x; scratch.y = f.y; scratch.radius = f.radius; scratch.id = f.id;
    foodHash.insert(scratch);
    foodValueCache.set(f.id, f.value);
  }

  const eatenIds = new Set<number>();
  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    if (snake.isPlayer && now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    const nearby = foodHash.query(hx, hy, SNAKE_RADIUS + 10);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const fid = entity.id as number;
      if (eatenIds.has(fid)) continue;
      if (distSq(hx, hy, entity.x, entity.y) <= EAT_DIST_SQ) {
        eatenIds.add(fid);
        snake.score += foodValueCache.get(fid) ?? 1;
      }
    }
  }
  return eatenIds;
}

// ==========================================================================
// Star Chips
// ==========================================================================

export function spawnStarChip(
  nextId: { value: number },
  ez: { x: number; y: number; radius: number; active: boolean },
  now: number,
): StarChip | null {
  if (!ez.active) return null;
  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * ez.radius * 0.8;
  const colorIdx = Math.floor(Math.random() * STAR_CHIP_COLORS.length);
  return {
    id: nextId.value++,
    x: ez.x + Math.cos(a) * d, y: ez.y + Math.sin(a) * d,
    value: STAR_CHIP_VALUE, radius: STAR_CHIP_RADIUS,
    glowColor: STAR_CHIP_GLOW, color: STAR_CHIP_COLORS[colorIdx],
    spawnTime: now,
  };
}

/** Check star chip collection. Returns set of collected chip IDs. */
export function checkStarChips(
  snakes: Iterable<SnakeLike>,
  starChips: StarChip[],
): Set<number> {
  const collected = new Set<number>();
  if (starChips.length === 0) return collected;
  for (const snake of snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
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
// Collisions
// ==========================================================================

/** Check all snake collisions. Returns dead IDs and kill events.
 *  bodyHash and headHash are pre-allocated by the caller. */
export function checkCollisions(
  snakes: Map<string, SnakeLike>,
  bodyHash: SpatialHash,
  headHash: SpatialHash,
  scratch: SpatialEntity,
  now: number,
): CollisionResult {
  // ── Build body segment spatial hash (step by 2 for performance) ──
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    const len = snake.path.length;
    scratch.id = snake.id;
    for (let i = 0; i < len; i += 2) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      bodyHash.insert(scratch);
    }
  }

  // ── Build head spatial hash using BLACK DOT positions ──
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
  const killEvents: KillEvent[] = [];

  // ── Head-to-body collision: black dot hits other snake's body ──
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
      if (distSq(dotX, dotY, entity.x, entity.y) <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        const killer = snakes.get(otherId);
        killEvents.push({
          victimId: snake.id, victimName: snake.name,
          killerId: otherId, killerName: killer?.name ?? 'Unknown',
          score: snake.score, timestamp: now,
        });
        break;
      }
    }
  }

  // ── Head-on-head collision: black dot vs black dot ──
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
// Death & Food Distribution
// ==========================================================================

/** Kill a snake and distribute food along its body */
export function killSnake(
  snake: SnakeLike,
  nextFoodId: { value: number },
  foods: FoodOrb[],
): void {
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
  // Fisher-Yates shuffle
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
      id: nextFoodId.value++,
      x: snake.path.getX(si), y: snake.path.getY(si),
      size: FOOD_SIZES[sizeIdx], value: FOOD_VALUES[sizeIdx], radius: FOOD_RADII[sizeIdx],
      color: FOOD_COLORS[sizeIdx], glowColor: FOOD_GLOW_COLORS[sizeIdx],
    });
  }
}

// ==========================================================================
// Bot Respawn
// ==========================================================================

/** Respawn dead bots to maintain population. Returns new bots to add. */
export function respawnBots(
  snakes: Map<string, SnakeLike>,
  botCount: number,
  tickCount: number,
  now: number,
): SnakeLike[] {
  let aliveBots = 0;
  for (const [, s] of snakes) {
    if (s.alive && s.isBot) aliveBots++;
  }
  const deficit = botCount - aliveBots;
  const toRespawn = Math.min(deficit, 3);
  const newBots: SnakeLike[] = [];
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
// Snapshot Builder (shared between offline debug and online broadcast)
// ==========================================================================

/** Build a downsampled snapshot for a single snake */
export function buildSnakeSnapshot(
  snake: SnakeLike,
  tickCount: number,
): SnakeSnapshot {
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

  // Turn metadata (spiral assist uses Fibonacci ramp, not log-spiral math)
  let turn: TurnMetadata | undefined;
  if (snake.spiral.active) {
    turn = {
      tick: tickCount,
      snakeId: snake.id,
      isSpiral: true,
      startAngle: snake.angle - snake.spiral.direction * snake.spiral.ticksElapsed * 0.1,
      direction: snake.spiral.direction,
      theta: snake.spiral.ticksElapsed,
      expectedDuration: 0,
    };
  }

  return {
    id: snake.id, name: snake.name,
    hx: snake.path.headX, hy: snake.path.headY,
    angle: snake.angle, length: pathLen,
    score: snake.score, alive: snake.alive,
    color: snake.color, headColor: snake.headColor,
    bodyRadius: snake.bodyRadius, boosting: snake.boosting,
    skinId: snake.skinId, rarity: snake.rarity,
    bodyX, bodyY, bodyLen: bodyIdx, turn,
  };
}

/** Build a full arena snapshot for network broadcast */
export function buildArenaSnapshot(
  snakes: Map<string, SnakeLike>,
  foods: FoodOrb[],
  starChips: StarChip[],
  tickCount: number,
  extraction: { x: number; y: number; radius: number; active: boolean },
): ArenaSnapshot {
  // Collect alive snakes, sort: players first, then by score desc
  const aliveSnakes: SnakeLike[] = [];
  for (const [, snake] of snakes) {
    if (snake.alive) aliveSnakes.push(snake);
  }
  aliveSnakes.sort((a, b) => {
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;
    return b.score - a.score;
  });
  const cappedSnakes = aliveSnakes.slice(0, MAX_SNAKES_PER_SNAPSHOT);

  // Collect player positions for food downsampling
  const playerPositions: Array<{ x: number; y: number }> = [];
  for (const snake of aliveSnakes) {
    if (snake.isPlayer && snake.path.length > 0) {
      playerPositions.push({ x: snake.path.headX, y: snake.path.headY });
    }
  }

  // Build snake snapshots
  const snakeSnapshots: SnakeSnapshot[] = [];
  for (const snake of cappedSnakes) {
    snakeSnapshots.push(buildSnakeSnapshot(snake, tickCount));
  }

  // Filter food near players
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

function nearAnyPlayer(
  x: number, y: number,
  players: ReadonlyArray<{ x: number; y: number }>,
  radiusSq: number,
): boolean {
  for (let i = 0; i < players.length; i++) {
    const dx = players[i].x - x;
    const dy = players[i].y - y;
    if (dx * dx + dy * dy <= radiusSq) return true;
  }
  return false;
}
