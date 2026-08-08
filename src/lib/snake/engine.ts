// ============================================================================
// Offline Game Engine — Thin wrapper around the unified core engine.
//
// All pure game logic lives in ./core.ts (shared with online game server).
// This file contains ONLY offline-specific orchestration:
//   - GameState creation (player + bots + initial food)
//   - Main game tick loop (calls core functions in sequence)
//   - Density-based food management (maintainFoodAroundPlayer)
//   - Player respawn (preserving skin)
//   - Debug score setter
//   - buildSnapshot re-export
//
// Module-level singletons (SpatialHash, foodValueCache, _insertScratch) are
// kept here because the offline engine owns the tick lifecycle.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, StarChip, SkinAsset, SkinRarity,
} from './types';
import type { SnakeLike, MoveContext } from './core';
import type { BotSnakeInput } from './bot-ai';
import { getBotTarget } from './bot-ai';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import {
  // Core game logic functions
  createSnake as coreCreateSnake,
  moveSnake as coreMoveSnake,
  findSafeSpawn as coreFindSafeSpawn,
  makeFood as coreMakeFood,
  spawnFoodBatch as coreSpawnFoodBatch,
  checkFoodEating as coreCheckFoodEating,
  checkStarChips as coreCheckStarChips,
  checkCollisions as coreCheckCollisions,
  killSnake as coreKillSnake,
  respawnBots as coreRespawnBots,
  spawnStarChip as coreSpawnStarChip,
  // Core constants
  BOT_NAMES,
  SPACING_RATIO,
} from './core';
import {
  BOT_COUNT,
  BOT_START_SCORE_MIN,
  BOT_START_SCORE_MAX,
  FOOD_DENSITY_TARGET,
  FOOD_VISIBLE_RADIUS,
  FOOD_DESPAWN_RADIUS,
  FOOD_RESPAWN_BATCH,
  FOOD_MAX_COUNT,
  INITIAL_SPAWN_RADIUS,
  EXTRACTION_ZONE_RADIUS,
  STAR_CHIP_SPAWN_INTERVAL,
  BASE_SPEED,
  computeBodyRadius,
  computeBodyLength,
} from './config';

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { buildSnapshot } from './snapshot';

// ─── PlayerSkinOverride ─────────────────────────────────────────────────────

/** Optional skin override for the player snake (offline-specific — includes pattern/animation) */
export interface PlayerSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  pattern?: SkinAsset['pattern'];
  animation?: SkinAsset['animation'];
  rarity: SkinRarity;
}

// ─── Module-level singletons ─────────────────────────────────────────────────

/** Reusable spatial hashes (allocated once, cleared each tick by core functions) */
const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();
const headHash = new SpatialHash();

/** Pre-allocated food value cache: foodId → value (rebuilt each tick by checkFoodEating) */
const foodValueCache = new Map<number, number>();

/** Scratch entity for spatial hash inserts (avoids object allocation in hot paths) */
const _insertScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };

/** Pre-computed squared radii for food density management */
const DESPAWN_RADIUS_SQ = FOOD_DESPAWN_RADIUS * FOOD_DESPAWN_RADIUS;
const VISIBLE_RADIUS_SQ = FOOD_VISIBLE_RADIUS * FOOD_VISIBLE_RADIUS;

// ─── Helper: cast Map<string, Snake> → Map<string, SnakeLike> ────────────────

// Map is invariant in its value type, so we need a cast.
// This is safe because Snake structurally satisfies SnakeLike (identical fields).

function asSnakeLikeMap(m: Map<string, Snake>): Map<string, SnakeLike> {
  return m as unknown as Map<string, SnakeLike>;
}

function asBotInputMap(m: Map<string, Snake>): Map<string, BotSnakeInput> {
  return m as unknown as Map<string, BotSnakeInput>;
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
    snakes: new Map(),
    foods: [],
    starChips: [],
    player: null,
    nextFoodId: 0,
    nextStarChipId: 0,
    showControls: true,
    tickCount: 0,
    extractionZone: { x: 0, y: 0, radius: EXTRACTION_ZONE_RADIUS, active: false },
  };

  const now = Date.now();

  // Mutable food ID counter (core functions use { value: number } refs)
  const nextIdRef = { value: 0 };

  // Spawn player
  const player = coreCreateSnake(
    'player', 'You', initialScore ?? 0, 0, 0, false, now, playerSkin,
  ) as Snake;
  state.player = player;
  state.snakes.set(player.id, player);

  // Spawn bots with varied sizes
  for (let i = 0; i < BOT_COUNT; i++) {
    const score = Math.floor(
      BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN),
    );
    const nameIdx = i % BOT_NAMES.length;
    const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
    const pos = coreFindSafeSpawn(asSnakeLikeMap(state.snakes), 0, 0);
    const bot = coreCreateSnake(
      `bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos.x, pos.y, true, now,
    ) as Snake;
    state.snakes.set(bot.id, bot);
  }

  // Spawn initial food (generous spread around origin for start area)
  coreSpawnFoodBatch(nextIdRef, state.foods, 3000, 0, 0, INITIAL_SPAWN_RADIUS);
  state.nextFoodId = nextIdRef.value;

  return state;
}

// ==========================================================================
// Main Game Tick
// ==========================================================================

/**
 * Main game tick. Orchestrates core functions in the correct order.
 * Uses module-level SpatialHash singletons and a per-tick ID counter ref.
 */
export function gameTick(state: GameState, input: InputState, _dt: number): void {
  state.tickCount++;
  const now = Date.now();

  // Mutable ID counter refs — core functions increment .value directly
  const foodIdRef = { value: state.nextFoodId };
  const chipIdRef = { value: state.nextStarChipId };

  // MoveContext for core's moveSnake (shares the food array + ID ref)
  const moveCtx: MoveContext = {
    foods: state.foods,
    nextFoodId: foodIdRef,
    extractionZone: state.extractionZone,
  };

  const snakeLikeMap = asSnakeLikeMap(state.snakes);
  const botInputMap = asBotInputMap(state.snakes);

  // 1. Move player
  const player = state.player;
  if (player && player.alive) {
    coreMoveSnake(player, input.targetAngle, input.boosting, now, moveCtx);
  }

  // 2. Move bots
  for (const [, snake] of state.snakes) {
    if (!snake.alive || !snake.isBot) continue;
    const botAngle = getBotTarget(snake as BotSnakeInput, botInputMap, state.foods);
    coreMoveSnake(snake, botAngle, false, now, moveCtx);
  }

  // 3. Check food eating (core builds foodHash + foodValueCache, returns eaten IDs)
  const eatenIds = coreCheckFoodEating(
    state.snakes.values(), state.foods, foodHash, foodValueCache, now,
  );
  // Swap-remove eaten food (no .filter() allocation)
  if (eatenIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < state.foods.length; i++) {
      if (!eatenIds.has(state.foods[i].id)) {
        state.foods[writeIdx++] = state.foods[i];
      }
    }
    state.foods.length = writeIdx;
  }

  // 4. Check star chip collection (core returns collected IDs)
  const collectedIds = coreCheckStarChips(state.snakes.values(), state.starChips);
  // Swap-remove collected chips (no .filter() allocation)
  if (collectedIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < state.starChips.length; i++) {
      if (!collectedIds.has(state.starChips[i].id)) {
        state.starChips[writeIdx++] = state.starChips[i];
      }
    }
    state.starChips.length = writeIdx;
  }

  // 5. Density-based food spawning + despawn (offline-specific — slither.io style)
  maintainFoodAroundPlayer(state, foodIdRef);

  // 6. Spawn star chips in extraction zone
  if (state.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
    const chip = coreSpawnStarChip(chipIdRef, state.extractionZone, now);
    if (chip) state.starChips.push(chip);
  }

  // 7. Check collisions (core uses module-level bodyHash + headHash + _insertScratch)
  const collisionResult = coreCheckCollisions(
    snakeLikeMap, bodyHash, headHash, _insertScratch, now,
  );

  // Process deaths: kill snake, distribute food, remove non-player from map
  for (const deadId of collisionResult.deadIds) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake) {
      coreKillSnake(deadSnake as SnakeLike, foodIdRef, state.foods);
      // Remove from map unless player (kept for respawn)
      if (!deadSnake.isPlayer) {
        state.snakes.delete(deadId);
      }
    }
  }

  // 8. Respawn dead bots to maintain population
  const newBots = coreRespawnBots(snakeLikeMap, BOT_COUNT, state.tickCount, now);
  for (const bot of newBots) {
    state.snakes.set(bot.id, bot as Snake);
  }

  // Sync ID counters back to state
  state.nextFoodId = foodIdRef.value;
  state.nextStarChipId = chipIdRef.value;
}

// ==========================================================================
// Offline-Specific Food Management (density-based, slither.io style)
// ==========================================================================

/**
 * Slither.io-style food management:
 * 1. Count food within player's visible radius & despawn far food
 * 2. Spawn food ahead + around player to maintain density
 * 3. Distribution: 50% uniform, 30% ahead, 20% around ring
 *
 * Result: infinite food that follows the player, no clusters, no empty areas.
 * This is OFFLINE-SPECIFIC — online uses count-based spawning.
 */
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

  // --- Step 1: Count food within visible radius & despawn far food ---
  let nearbyCount = 0;
  let writeIdx = 0;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const dx = f.x - hx;
    const dy = f.y - hy;
    const dSq = dx * dx + dy * dy;

    if (dSq > DESPAWN_RADIUS_SQ) {
      // Too far — despawn (skip, don't copy to write position)
      continue;
    }

    // Keep this food
    if (writeIdx !== i) foods[writeIdx] = f;
    writeIdx++;

    if (dSq < VISIBLE_RADIUS_SQ) nearbyCount++;
  }

  // Trim the array
  foods.length = writeIdx;

  // --- Step 2: Spawn food to maintain density ---
  const deficit = FOOD_DENSITY_TARGET - nearbyCount;
  if (deficit <= 0 || foods.length >= FOOD_MAX_COUNT) return;

  const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);

  // 50% scattered uniformly around the player (all distances including close)
  // 30% ahead of the player (slither.io style — food where you're going)
  // 20% in a mid-range ring for ambient coverage
  const uniformCount = Math.ceil(batch * 0.5);
  const aheadCount = Math.ceil(batch * 0.3);
  const aroundCount = batch - uniformCount - aheadCount;

  // Uniform: random distance 200-4000px, all directions — fills gaps near player
  for (let i = 0; i < uniformCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
    const sx = hx + Math.cos(a) * dist;
    const sy = hy + Math.sin(a) * dist;
    foods.push(coreMakeFood(nextIdRef, sx, sy));
  }

  // Ahead: fan in front of the snake
  for (let i = 0; i < aheadCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.8; // ±72° fan
    const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
    const a = angle + spread;
    const sx = hx + Math.cos(a) * dist;
    const sy = hy + Math.sin(a) * dist;
    foods.push(coreMakeFood(nextIdRef, sx, sy));
  }

  // Around: wide ring for ambient food
  for (let i = 0; i < aroundCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * (FOOD_VISIBLE_RADIUS - 800);
    const sx = hx + Math.cos(a) * dist;
    const sy = hy + Math.sin(a) * dist;
    foods.push(coreMakeFood(nextIdRef, sx, sy));
  }
}

// ==========================================================================
// Player Respawn
// ==========================================================================

/** Respawn the player snake (preserves skin from previous life) */
export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;

  const pos = coreFindSafeSpawn(asSnakeLikeMap(state.snakes), 0, 0);

  // Preserve player's skin on respawn
  const skinOverride = old ? {
    skinId: old.skinId,
    bodyColor: old.color,
    headColor: old.headColor,
    accentColor: '',
    rarity: old.rarity,
  } : null;

  const newPlayer = coreCreateSnake(
    'player', 'You', 0, pos.x, pos.y, false, Date.now(), skinOverride,
  ) as Snake;

  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}

// ==========================================================================
// Debug Score
// ==========================================================================

/**
 * Set debug score and immediately resize the path buffer to match.
 * Extends the path behind the tail in a straight line to reach the target length,
 * or trims if the new score produces a shorter snake.
 */
export function setDebugScore(state: GameState, score: number): void {
  const player = state.player;
  if (!player) return;

  player.score = score;
  player.bodyRadius = computeBodyRadius(score);
  player.boostCostAccum = 0;

  const targetPathLen = Math.ceil(computeBodyLength(score) * SPACING_RATIO);
  const currentLen = player.path.length;

  if (targetPathLen > currentLen) {
    // Extend path behind the tail in a straight line
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
      lastX += nx;
      lastY += ny;
      player.path.appendTail(lastX, lastY);
    }
  } else if (targetPathLen < currentLen) {
    // Trim path to new target length
    while (player.path.length > targetPathLen) {
      player.path.pop();
    }
  }
}
