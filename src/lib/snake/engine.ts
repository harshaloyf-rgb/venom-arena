// ============================================================================
// Game Engine — SHARED — used by both offline and online modes.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, SkinRarity, FoodSize,
} from './types';
import type { IPathBuffer } from './pool';
import { PathBuffer } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { checkCollisions, type KillEvent } from './collision';
import {
  updateAllBotAI, getBotBoost, spawnBots, respawnDeadBots, removeBot,
  BOT_TYPE_COLORS, type BotType, type BotSpawnConfig, DEFAULT_BOT_MIX,
} from './bot-ai';
import {
  // MOVEMENT
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE, SEGMENT_SPACING,
  STEERING_LERP, SHARP_TURN_BRAKE,
  computeBodyLength, computeBodyRadius,
  // FOOD
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS,
  // COLLISION
  SNAKE_RADIUS, SPAWN_PROTECTION_MS,
  // FOOD MAGNET
  FOOD_MAGNET_PULL_RADIUS, FOOD_MAGNET_DEATH_RADIUS,
  FOOD_MAGNET_MIN_SPEED, FOOD_MAGNET_MAX_SPEED,
  // BOOST
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE, BOOST_DROP_COUNT,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  // SPAWN
  INITIAL_SPAWN_RADIUS, SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // SPIRAL
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  FOOD_DENSITY_TARGET, FOOD_VISIBLE_RADIUS, FOOD_DESPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_MAX_COUNT,
} from './config';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Optional skin override for the player snake (includes pattern/animation) */
export interface PlayerSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  pattern?: any;
  animation?: any;
  rarity: SkinRarity;
}

/** Re-export KillEvent from shared collision for backward compat */
export type { KillEvent } from './collision';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly. */
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled boost min body: covers same physical distance as BOOST_MIN_BODY * SEGMENT_SPACING */
const BOOST_MIN_BODY_SCALED = Math.ceil(BOOST_MIN_BODY * SPACING_RATIO);


const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<FoodSize> = ['small', 'medium', 'large'];

const MAGNET_PULL_DIST = SNAKE_RADIUS + FOOD_MAGNET_PULL_RADIUS;
const MAGNET_DEATH_DIST = SNAKE_RADIUS + FOOD_MAGNET_DEATH_RADIUS;
const MAGNET_PULL_DIST_SQ = MAGNET_PULL_DIST * MAGNET_PULL_DIST;
const MAGNET_DEATH_DIST_SQ = MAGNET_DEATH_DIST * MAGNET_DEATH_DIST;

// ─── Move Context (passed to moveSnake) ─────────────────────────────────────

interface MoveContext {
  foods: FoodOrb[];
  nextFoodId: { value: number };
}

// ─── Module-level singletons ─────────────────────────────────────────────────

const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();
const headHash = new SpatialHash();
const foodValueCache = new Map<number, number>();
const DESPAWN_RADIUS_SQ = FOOD_DESPAWN_RADIUS * FOOD_DESPAWN_RADIUS;
const VISIBLE_RADIUS_SQ = FOOD_VISIBLE_RADIUS * FOOD_VISIBLE_RADIUS;

// ==========================================================================
// Snake Creation
// ==========================================================================

function createSnake(
  id: string, name: string, startScore: number,
  posX: number, posY: number, now: number,
  skinOverride?: PlayerSkinOverride | null,
  botType?: BotType,
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

  // Use type-specific colors for bots, otherwise skinOverride or random palette
  let color: string;
  let headColor: string;
  if (botType && BOT_TYPE_COLORS[botType]) {
    [color, headColor] = BOT_TYPE_COLORS[botType];
  } else {
    color = skinOverride ? skinOverride.bodyColor : palette[0];
    headColor = skinOverride ? skinOverride.headColor : palette[1];
  }
  const skinId = skinOverride ? skinOverride.skinId : 'skin-default';
  const rarity = skinOverride ? skinOverride.rarity : 'common' as SkinRarity;

  return {
    id, name, path, angle, prevAngle: angle,
    speed: BASE_SPEED, score: startScore,
    boosting: false, alive: true, isBot: false, isPlayer: true,
    spawnTime: now, color, headColor,
    lastBoostDrop: 0, targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: computeBodyRadius(startScore), skinId, rarity,
  };
}

// ==========================================================================
// Safe Spawn
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
// Snake Movement
// ==========================================================================

function moveSnake(snake: Snake, targetAngle: number, wantBoost: boolean, now: number, ctx: MoveContext): void {
  snake.targetAngle = targetAngle;
  snake.prevAngle = snake.angle;

  let diff = targetAngle - snake.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));

  const canBoost = wantBoost && snake.score >= BOOST_MIN_SCORE && snake.path.length > BOOST_MIN_BODY_SCALED;
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

  const absClampedTurn = Math.abs(clampedTurn);
  const sharpness = maxTurn > 0 ? Math.min(absClampedTurn / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
  const brakeFactor = 1 - SHARP_TURN_BRAKE * smoothT;

  snake.boosting = canBoost;
  const baseSpeedForState = canBoost ? BOOST_SPEED : BASE_SPEED;
  snake.speed = baseSpeedForState * brakeFactor;

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
// Food Creation
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
// Food Eating (Magnet + Vacuum)
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


// (Collision detection moved to shared collision.ts)

// ==========================================================================
// Death & Food Distribution
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
// Initialization
// ==========================================================================

/** Create the initial game state (player + 3000 initial food) */
export function createInitialState(
  playerSkin?: PlayerSkinOverride | null,
  initialScore?: number,
  playerName?: string,
): GameState {
  const state: GameState = {
    snakes: new Map(), foods: [], player: null,
    nextFoodId: 0, showControls: true, tickCount: 0,
    extractionZone: { x: 0, y: 0, radius: 0, active: false },
  };

  const now = Date.now();
  const nextIdRef = { value: 0 };

  const player = createSnake('player', playerName || 'You', initialScore ?? 0, 0, 0, now, playerSkin);
  state.player = player;
  state.snakes.set(player.id, player);

  spawnFoodBatch(nextIdRef, state.foods, 3000, 0, 0, INITIAL_SPAWN_RADIUS);
  state.nextFoodId = nextIdRef.value;

  return state;
}

// ==========================================================================
// Main Game Tick
// ==========================================================================

export function gameTick(state: GameState, input: InputState, _dt: number): KillEvent[] {
  state.tickCount++;
  const now = Date.now();

  const foodIdRef = { value: state.nextFoodId };

  const moveCtx: MoveContext = {
    foods: state.foods,
    nextFoodId: foodIdRef,
  };

  // 1. Update bot AI (compute target angles + boost decisions)
  updateAllBotAI(state);

  // 2. Move player
  const player = state.player;
  if (player && player.alive) {
    moveSnake(player, input.targetAngle, input.boosting, now, moveCtx);
  }

  // 3. Move all bots
  for (const [id, snake] of state.snakes) {
    if (!snake.isBot || !snake.alive) continue;
    const botBoost = getBotBoost(id);
    moveSnake(snake, snake.targetAngle, botBoost, now, moveCtx);
  }

  // 4. Check food eating
  const eatenIds = checkFoodEating(state.snakes.values(), state.foods, foodHash, foodValueCache, now);
  if (eatenIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < state.foods.length; i++) {
      if (!eatenIds.has(state.foods[i].id)) { state.foods[writeIdx++] = state.foods[i]; }
    }
    state.foods.length = writeIdx;
  }

  // 5. Density-based food spawning
  maintainFoodAroundPlayer(state, foodIdRef);

  // 6. Check collisions (shared)
  const collisionResult = checkCollisions(state.snakes, bodyHash, headHash, now);
  for (const deadId of collisionResult.deadIds) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake) {
      killSnake(deadSnake, foodIdRef, state.foods);
      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
      }
    }
  }

  // 7. Respawn dead bots (1 per tick max)
  respawnDeadBots(state, DEFAULT_BOT_MIX, createBotSnakeFactory);

  state.nextFoodId = foodIdRef.value;

  return collisionResult.killEvents;
}

// ==========================================================================
// Bot Snake Factory (avoids exposing private createSnake)
// ==========================================================================

function createBotSnakeFactory(
  id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType,
): Snake {
  return createSnake(id, name, score, x, y, now, undefined, botType);
}

// ==========================================================================
// Bot Initialization (call once after createInitialState)
// ==========================================================================

/** Spawn the initial bot population into the game state */
export function initBots(state: GameState, config?: BotSpawnConfig): void {
  spawnBots(state, config, createBotSnakeFactory);
}

// ==========================================================================
// Food Management (density-based, slither.io style)
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
// Player Respawn
// ==========================================================================

export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;
  const pos = findSafeSpawn(state.snakes, 0, 0);
  const skinOverride = old ? {
    skinId: old.skinId, bodyColor: old.color, headColor: old.headColor,
    accentColor: '', rarity: old.rarity,
  } : null;
  const newPlayer = createSnake('player', old?.name || 'You', 0, pos.x, pos.y, Date.now(), skinOverride);
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}


