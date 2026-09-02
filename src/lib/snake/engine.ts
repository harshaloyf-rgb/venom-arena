// ============================================================================
// Game Engine — SHARED — used by both offline and online modes.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, SkinRarity, FoodSize,
} from './types';
import { PathBuffer } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { checkCollisions, type KillEvent } from './collision';
import {
  updateAllBotAI, getBotBoost, spawnBots, respawnDeadBots, removeBot,
  BOT_TYPE_COLORS, type BotType, type BotSpawnConfig, DEFAULT_BOT_MIX,
} from './bot-ai';
import { SLITHER_PRESETS } from '@/components/panels/cosmetics/cosmetics-types';
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
  BOOST_DROP_INTERVAL, BOOST_MIN_SCORE, BOOST_DROP_COUNT,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  // SPIRAL
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
  // ARENA
  getArenaConfig,
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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly. */
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;



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
  mapHalf: number;
  /** Current pulsing boundary radius (kill zone) */
  boundaryRadius: number;
}

// ─── Module-level singletons ─────────────────────────────────────────────────

const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();
const headHash = new SpatialHash();

// ─── Bot Skin Pool ───────────────────────────────────────────────────────────
/** Pre-computed skin overrides from all free presets for random bot assignment */
const BOT_SKIN_POOL: PlayerSkinOverride[] = SLITHER_PRESETS.map((p) => ({
  skinId: p.id,
  bodyColor: p.colors[0],
  headColor: p.colors[0],
  accentColor: p.colors.length > 1 ? p.colors[1] : p.colors[0],
  rarity: 'common' as SkinRarity,
}));

function getRandomBotSkin(): PlayerSkinOverride {
  return BOT_SKIN_POOL[Math.floor(Math.random() * BOT_SKIN_POOL.length)];
}

// ─── Module-level cached food hash (rebuilt every 3 ticks) ───────────────
const foodValueCache = new Map<number, number>();
let _cachedFoodById = new Map<number, FoodOrb>();
const _foodHashScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
// Track magnetized food IDs for efficient flag reset (Issue #10)
const _magnetizedIds: number[] = [];
// Pre-allocated eaten IDs set (Issue #6 GC fix — avoids new Set() per tick)
const _eatenIdsSet = new Set<number>();

function rebuildFoodHash(fh: SpatialHash, foods: FoodOrb[]): void {
  fh.clear();
  _cachedFoodById.clear();
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    _foodHashScratch.x = f.x; _foodHashScratch.y = f.y;
    _foodHashScratch.radius = f.radius; _foodHashScratch.id = f.id;
    fh.insert(_foodHashScratch);
    _cachedFoodById.set(f.id, f);
  }
}

// FIX G2: Incremental food-hash maintenance.
// The hash used to be rebuilt from scratch every N ticks; food spawned between
// rebuilds was invisible to spatial queries, and the renderer scanned the FULL
// 20K food array every frame. Now every spawn indexes into the hash immediately
// and every eat/despawn unindexes — the hash + id-cache stay accurate enough
// for rendering culling at all times (the eat path still does its periodic
// full rebuild as a source-of-truth resync).
// NOTE on stale entries: magnet pull moves food without updating its hash
// cell. Ghost entries are harmless — both the eat path and the render path
// resolve hash ids through _cachedFoodById (always accurate) and skip
// unknown ids.
function indexFood(f: FoodOrb): void {
  _foodHashScratch.x = f.x; _foodHashScratch.y = f.y;
  _foodHashScratch.radius = f.radius; _foodHashScratch.id = f.id;
  foodHash.insert(_foodHashScratch);
  _cachedFoodById.set(f.id, f);
  // Keeps boost-cost/food-value scoring correct for food eaten BEFORE the
  // next periodic rebuild (previously such food scored 1 via `?? 1`).
  foodValueCache.set(f.id, f.value);
}

function unindexFood(f: FoodOrb): void {
  _foodHashScratch.x = f.x; _foodHashScratch.y = f.y;
  _foodHashScratch.radius = f.radius; _foodHashScratch.id = f.id;
  foodHash.remove(_foodHashScratch);
  _cachedFoodById.delete(f.id);
  foodValueCache.delete(f.id);
}

// FIX G2: Reused buffer for render-side food culling (zero allocation per frame).
const _visibleFoodBuf: FoodOrb[] = [];
// Dedupe set for queryVisibleFoods — a food orb at a spatial-cell boundary is
// inserted into 2 cells (correct for collision queries) and would otherwise be
// returned twice per query. Rendering the same orb twice is invisible, but the
// clean contract is one entry per orb.
const _querySeenIds = new Set<number>();

/** Query alive food orbs near a world point (for render culling).
 *  Returns a SHARED reused array — valid until the next call. Callers must
 *  not retain it across frames. */
export function queryVisibleFoods(cx: number, cy: number, radius: number): FoodOrb[] {
  const buf = _visibleFoodBuf;
  buf.length = 0;
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !(radius > 0)) return buf;
  const nearby = foodHash.query(cx, cy, radius);
  if (nearby.length === 0) return buf;
  const seen = _querySeenIds;
  seen.clear();
  for (let i = 0; i < nearby.length; i++) {
    const id = nearby[i].id as number;
    if (seen.has(id)) continue;
    seen.add(id);
    const orb = _cachedFoodById.get(id);
    if (orb) buf.push(orb);
  }
  return buf;
}

// NOTE: MAP_FOOD_GRID_SIZE, MAP_HALF, MAP_GRID_COLS/ROWS, MAP_RADIUS_SQ, DESPAWN_RADIUS_SQ,
// VISIBLE_RADIUS_SQ, MAP_FOOD_TARGET_PER_CELL, MAP_FOOD_SPAWN_PER_CELL are now per-arena
// and read from state.arenaConfig. Module-level fallbacks kept for spatial hash sizing.

// Grid counts buffer — pre-allocated for largest possible grid (29K map, 5K cells = 12×12 = 144)
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

  // Use skinOverride if provided (bots get random presets), otherwise type-specific or random
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

  return {
    id, name, path, angle, prevAngle: angle,
    speed: BASE_SPEED, score: startScore,
    boosting: false, alive: true, isBot: false, isPlayer: true,
    spawnTime: now, color, headColor,
    lastBoostDrop: 0, targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: computeBodyRadius(startScore),
    cachedBodyLength: computeBodyLength(startScore),
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
// Snake Movement
// ==========================================================================

function moveSnake(snake: Snake, targetAngle: number, wantBoost: boolean, now: number, ctx: MoveContext): boolean {
  snake.targetAngle = targetAngle;
  snake.prevAngle = snake.angle;

  // NOTE: prevHeadX/Y is saved by the GAME LOOP before the last tick in a batch
  // (for player render interpolation). Bots don't need it (alpha=1.0 → offset=0).
  // The old per-tick save here was redundant and could interfere with the
  // game loop's carefully-timed save.

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

  // FIX 2: Apply sharp turn braking to TURN RATE instead of SPEED.
  // Eliminates speed oscillation — the #1 cause of boost stutter.
  // At full turn, maxTurn is reduced by SHARP_TURN_BRAKE (30%),
  // making the snake turn more slowly (realistic) without speed variation.
  const absClampedTurn = Math.abs(clampedTurn);
  const sharpness = maxTurn > 0 ? Math.min(absClampedTurn / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
  maxTurn *= (1 - SHARP_TURN_BRAKE * smoothT);

  // Detect boost transition for instant first drop
  const boostJustStarted = canBoost && !snake.boosting;
  snake.boosting = canBoost;
  snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

  // Path buffer movement
  let newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  let newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;

  // Arena boundary — DEATH on touch, no food drop
  const distFromCenter = Math.sqrt(newHeadX * newHeadX + newHeadY * newHeadY);
  const bRadius = ctx.boundaryRadius;
  if (distFromCenter >= bRadius) {
    // Snake crossed the boundary — mark dead, no food
    return true; // caller must kill this snake
  }

  snake.path.prepend(newHeadX, newHeadY);

  // Growth / Shrink — use cached body length, recompute only when score changes.
  // This saves ~3 Math.log calls per snake per tick (~18,000 logs/frame at 6 ticks).
  const prevBodyScore = snake.cachedBodyScore;
  const scoreChanged = snake.score !== prevBodyScore;
  if (scoreChanged) {
    snake.cachedBodyLength = computeBodyLength(snake.score);
    snake.bodyRadius = computeBodyRadius(snake.score);
    snake.cachedBodyScore = snake.score;
    snake.cachedVisualTailIdx = -1; // Invalidate visual tail cache too
  }
  const logicalLen = snake.cachedBodyLength;
  const targetLength = Math.ceil(logicalLen * SPACING_RATIO);

  // Boost food drop — instant on press, then every BOOST_DROP_INTERVAL
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
        const drop: FoodOrb = {
          id: ctx.nextFoodId.value++, x: snake.path.getX(idx), y: snake.path.getY(idx),
          size: 'small', value: 1, radius: FOOD_RADII[0],
          color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0], magnetized: false,
        };
        ctx.foods.push(drop);
        indexFood(drop); // FIX G2: boost drops are visible immediately
      }
    }
  }
  // Reset drop timer when not boosting so next boost press is instant
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

  // P1: Path buffer trimming — cap path to target length + safety margin.
  // The path grows by 1 per tick (prepend). If the snake shrinks rapidly
  // (boost drain, death drops), excess tail lingers in the buffer.
  // This trim prevents unbounded memory growth in long sessions.
  // Margin = 10% extra for collision detection lookback + coil rendering.
  const pathCeil = Math.ceil(targetLength * 1.1) + 20;
  snake.path.trimTo(pathCeil);
  return false; // survived
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

/** Post-processing wrapper: create + index into the spatial hash (FIX G2).
 *  makeFood stays pure (no side effects) for any future non-arena use; every
 *  arena spawn path goes through makeFoodIndexed instead. */
function makeFoodIndexed(nextId: { value: number }, x: number, y: number, forceSize?: number): FoodOrb {
  const f = makeFood(nextId, x, y, forceSize);
  indexFood(f);
  return f;
}

function spawnFoodBatch(nextId: { value: number }, foods: FoodOrb[], count: number, cx: number, cy: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * radius; // area-uniform distribution
    foods.push(makeFoodIndexed(nextId, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ==========================================================================
// Food Eating (Magnet + Vacuum)
// ==========================================================================

function checkFoodEating(
  snakes: Iterable<Snake>, foods: FoodOrb[],
  fh: SpatialHash, fvc: Map<number, number>, now: number,
  useCachedHash: boolean,
): Set<number> {
  // FIX #10: Instead of resetting ALL food magnetized flags (O(20K-50K) writes/tick),
  // only reset the ones that were magnetized last tick. Track them in _magnetizedIds.
  for (let i = 0; i < _magnetizedIds.length; i++) {
    const f = _cachedFoodById.get(_magnetizedIds[i]);
    if (f) f.magnetized = false;
  }
  _magnetizedIds.length = 0;

  // Rebuild hash from scratch (called every N ticks per arena config)
  // Uses module-level _foodHashScratch to avoid per-rebuild object allocation.
  if (!useCachedHash) {
    fh.clear();
    fvc.clear();
    _cachedFoodById.clear();
    _magnetizedIds.length = 0; // Clear magnetized tracking on full rebuild
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

      // FIX: Use entity hash position for distance/eating checks.
      // Earlier snakes modify food.x/food.y via magnet pull, causing
      // a mismatch between the query (hash pos) and this check (actual pos).
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
        // Use actual food position for pull direction (accurate physics)
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


// (Collision detection moved to shared collision.ts)

// ==========================================================================
// Death & Food Distribution
// ==========================================================================

function killSnake(snake: Snake, nextFoodId: { value: number }, foods: FoodOrb[]): void {
  snake.alive = false;
  const dropValue = Math.max(1, snake.score);
  const segLen = snake.path.length;
  // Cap total food to path length so drops don't pile at the tail
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
    const drop: FoodOrb = {
      id: nextFoodId.value++, x: snake.path.getX(si), y: snake.path.getY(si),
      size: FOOD_SIZES[sizeIdx], value: FOOD_VALUES[sizeIdx], radius: FOOD_RADII[sizeIdx],
      color: FOOD_COLORS[sizeIdx], glowColor: FOOD_GLOW_COLORS[sizeIdx], magnetized: false,
    };
    foods.push(drop);
    indexFood(drop); // FIX G2: death drops are visible immediately
  }
}

// ==========================================================================
// Initialization
// ==========================================================================

/** Create the initial game state (player + food spawned in batches).
 *  Food is NOT spawned synchronously — the caller must call seedInitialFood()
 *  to populate food in chunks across multiple frames. This prevents the
 *  main thread from blocking for 30-50ms creating 30K objects. */
export function createInitialState(
  playerSkin?: PlayerSkinOverride | null,
  initialScore?: number,
  playerName?: string,
  arenaId?: string,
): GameState {
  const arenaConfig = getArenaConfig(arenaId);
  // FIX G2: reset module-level food index state — the hash/cache are module
  // singletons that survive across game restarts (arena switch, respawn menu).
  // Without this reset, a new game would inherit ghost entries from the old one
  // until the first periodic rebuild.
  foodHash.clear();
  _cachedFoodById.clear();
  foodValueCache.clear();
  _magnetizedIds.length = 0;
  const state: GameState = {
    snakes: new Map(), foods: [], player: null,
    nextFoodId: 0, showControls: true, tickCount: 0,
    botsEnabled: false,
    stars: [],
    nextStarId: 0,
    arenaConfig,
    boundaryRadius: arenaConfig.mapHalf,
  };

  const now = performance.now();

  const player = createSnake('player', playerName || 'Player', initialScore ?? 0, 0, 0, now, playerSkin);
  state.player = player;
  state.snakes.set(player.id, player);

  // Seed a small ring of food around player spawn (0-2000px) so the screen
  // isn't empty on the first frame. Keep it light — dense food makes the
  // player gain score too fast. The rest fills in via maintainMapFood.
  const nextIdRef = { value: 0 };
  spawnFoodBatch(nextIdRef, state.foods, 200, 0, 0, 2000);
  state.nextFoodId = nextIdRef.value;

  return state;
}

/** Incrementally seed food across the map. Call once per frame until returns false.
 *  Spawns 2000 food per call (safe budget for <1ms). */
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

export function gameTick(state: GameState, input: InputState, _dt: number): KillEvent[] {
  state.tickCount++;
  const now = performance.now();
  const ac = state.arenaConfig;
  const foodIdRef = { value: state.nextFoodId };

  // ── Pulsing boundary: 30s shrink inward, 30s grow outward ──
  // Full cycle = 60 seconds (3600 ticks at 60fps).
  // Amplitude = 8% of mapHalf. Cosine gives smooth accel/decel at endpoints.
  const PULSE_CYCLE_TICKS = 60 * 60; // 60 seconds
  const PULSE_AMPLITUDE = 0.08; // 8%
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

  // 1. Update bot AI (compute target angles + boost decisions) — offline only
  if (state.botsEnabled && state.tickCount % ac.aiTickThrottle === 0) {
    // PERF: Pass foodHash so AI uses spatial food queries instead of random sampling
    updateAllBotAI(state, foodHash);
  }

  // Collect boundary-killed snakes (separate from collision kills)
  const boundaryDead: string[] = [];

  // 2. Move player
  const player = state.player;
  if (player && player.alive) {
    const hitWall = moveSnake(player, input.targetAngle, input.boosting, now, moveCtx);
    if (hitWall) boundaryDead.push(player.id);
  }

  // 3. Move all bots — offline only
  if (state.botsEnabled) {
    for (const [id, snake] of state.snakes) {
      if (!snake.isBot || !snake.alive) continue;
      const botBoost = getBotBoost(id);
      const hitWall = moveSnake(snake, snake.targetAngle, botBoost, now, moveCtx);
      if (hitWall) boundaryDead.push(id);
    }
  }

  // 3b. Kill boundary-hit snakes (no food drop)
  for (const deadId of boundaryDead) {
    const deadSnake = state.snakes.get(deadId);
    if (deadSnake && deadSnake.alive) {
      deadSnake.alive = false;
      if (deadSnake.isBot) {
        removeBot(deadId);
        state.snakes.delete(deadId);
      }
    }
  }

  // 4. Check food eating (rebuild spatial hash per arena config)
  const rebuildHash = state.tickCount % ac.foodHashRebuildInterval === 0;
  const eatenIds = checkFoodEating(state.snakes.values(), state.foods, foodHash, foodValueCache, now, rebuildHash);
  if (eatenIds.size > 0) {
    // FIX G2: unindex eaten food so the hash/id-cache stay render-accurate
    // (no ghost orbs between periodic rebuilds).
    for (const fid of eatenIds) {
      const f = _cachedFoodById.get(fid);
      if (f) unindexFood(f);
    }
    let writeIdx = 0;
    for (let i = 0; i < state.foods.length; i++) {
      if (!eatenIds.has(state.foods[i].id)) { state.foods[writeIdx++] = state.foods[i]; }
    }
    state.foods.length = writeIdx;
  }

  // 5. Food management
  if (state.tickCount % ac.playerFoodInterval === 0) {
    maintainFoodAroundPlayer(state, foodIdRef, foodHash);
  }
  // Global map food for far-away bots
  if (state.tickCount % ac.mapFoodInterval === 0) {
    maintainMapFood(state, foodIdRef);
  }

  // 6. Check collisions (shared)
  const collisionResult = checkCollisions(state.snakes, bodyHash, headHash, now, state.player?.path.headX, state.player?.path.headY);
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

  // 7. Respawn dead bots — offline only
  if (state.botsEnabled) {
    for (let r = 0; r < ac.respawnPerTick; r++) {
      respawnDeadBots(state, ac.botMix as any, createBotSnakeFactory);
    }
  }

  state.nextFoodId = foodIdRef.value;

  return collisionResult.killEvents;
}

// ==========================================================================
// Bot Snake Factory (avoids exposing private createSnake)
// ==========================================================================

function createBotSnakeFactory(
  id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType,
): Snake {
  return createSnake(id, name, score, x, y, now, getRandomBotSkin(), botType);
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

function maintainFoodAroundPlayer(state: GameState, nextIdRef: { value: number }, fh: SpatialHash): void {
  const player = state.player;
  const refSnake = (player && player.alive && player.path.length > 0)
    ? player
    : [...state.snakes.values()].find(s => s.alive && s.path.length > 0);
  if (!refSnake) return;

  const ac = state.arenaConfig;
  const hx = refSnake.path.headX;
  const hy = refSnake.path.headY;
  const angle = refSnake.angle;
  const foods = state.foods;
  const visibleR = ac.foodVisibleRadius;
  const visibleRSq = ac.visibleRadiusSq;

  // P5 OPTIMIZATION: Use food spatial hash to count nearby food instead of
  // iterating all food items.
  let nearbyCount = 0;
  const nearby = fh.query(hx, hy, visibleR);
  for (let i = 0; i < nearby.length; i++) {
    const dx = nearby[i].x - hx;
    const dy = nearby[i].y - hy;
    if (dx * dx + dy * dy < visibleRSq) nearbyCount++;
  }

  // Spawn food near player to maintain high density
  const deficit = ac.foodDensityTarget - nearbyCount;
  if (deficit <= 0 || foods.length >= ac.foodMaxCount) return;
  const batch = Math.min(deficit, ac.foodRespawnBatch);

  const uniformCount = Math.ceil(batch * 0.5);
  const aheadCount = Math.ceil(batch * 0.3);
  const aroundCount = batch - uniformCount - aheadCount;

  for (let i = 0; i < uniformCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * (visibleR - 200);
    foods.push(makeFoodIndexed(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aheadCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.8;
    const dist = 200 + Math.random() * (visibleR - 200);
    const a = angle + spread;
    foods.push(makeFoodIndexed(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
  for (let i = 0; i < aroundCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 800 + Math.random() * (visibleR - 800);
    foods.push(makeFoodIndexed(nextIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
  }
}

/** Spawn food across the entire map using a grid-based system.
 *  Divides the map into grid cells, counts food per cell in O(food), then spawns
 *  in deficit cells. Also handles despawn of out-of-bounds food. */
function maintainMapFood(state: GameState, nextIdRef: { value: number }): void {
  const ac = state.arenaConfig;
  const foods = state.foods;
  const cellSize = ac.mapFoodGridSize;
  const halfMap = ac.mapHalf;
  const cols = ac.mapGridCols;
  const rows = ac.mapGridRows;
  const radiusSq = ac.mapRadiusSq;
  const despawnRSq = ac.despawnRadiusSq;
  const targetPerCell = ac.mapFoodTargetPerCell;
  const spawnPerCell = ac.mapFoodSpawnPerCell;
  const maxFood = ac.foodMaxCount;

  // Phase 0: Despawn out-of-bounds food + count per cell in one pass — O(food)
  const counts = _gridCounts;
  counts.fill(0);
  let writeIdx = 0;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.x * f.x + f.y * f.y > despawnRSq) {
      unindexFood(f); // FIX G2: keep hash/cache in sync with despawns
      continue;
    }
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
        if (state.foods.length >= maxFood) return;
        const x = cx + (Math.random() - 0.5) * cellSize;
        const y = cy + (Math.random() - 0.5) * cellSize;
        if (x * x + y * y < radiusSq) {
          foods.push(makeFoodIndexed(nextIdRef, x, y));
        }
      }
    }
  }
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
  const newPlayer = createSnake('player', old?.name || 'Player', 0, pos.x, pos.y, performance.now(), skinOverride);
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}


