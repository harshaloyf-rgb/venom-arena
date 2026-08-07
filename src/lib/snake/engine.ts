// ============================================================================
// Game Engine — Phase A+B: Zero-Allocation Core + Spiral Movement
// 
// Uses PathBuffer (Float32Array) for snake paths — no Vec2[] allocation.
// Phase A: Fibonacci turn detection, extraction zone, star chips.
// Phase B: Fibonacci spiral path computation during tight turns.
// Mutates state in-place for performance with 1000 bots.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, StarChip, SkinAsset, SkinRarity,
} from './types';
import { PathBuffer, scratchVec2 } from './pool';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { distSq } from './vec2';
import { getBotTarget } from './bot-ai';
import {
  // MOVEMENT
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE, SEGMENT_SPACING, START_LENGTH, LENGTH_PER_SCORE,
  computeBodyLength, computeBodyRadius,
  // FOOD
  FOOD_DENSITY_TARGET, FOOD_VISIBLE_RADIUS, FOOD_DESPAWN_RADIUS,
  FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS, INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_MAX_COUNT,
  // COLLISION
  SNAKE_RADIUS, SNAKE_RADIUS_MIN, SNAKE_RADIUS_GROWTH_RATE,
  SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  DEATH_FOOD_LARGE_DIVISOR, DEATH_FOOD_MEDIUM_DIVISOR,
  // BOOST
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE,
  BOOST_SCORE_COST_AMOUNT, BOOST_SCORE_COST_INTERVAL,
  // BOT
  BOT_COUNT, BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  // SPAWN
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // EXTRACTION
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD, EXTRACTION_SPEED_BONUS,
  STAR_CHIP_VALUE, STAR_CHIP_SPAWN_INTERVAL, STAR_CHIP_RADIUS,
  STAR_CHIP_GLOW, STAR_CHIP_COLORS,
  // SPIRAL
  SPIRAL_TURN_THRESHOLD, SPIRAL_ENTER_TICKS, SPIRAL_MAX_MULTIPLIER,
  SPIRAL_RAMP_TICKS, SPIRAL_EXIT_THRESHOLD,
} from './config';

/**
 * Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly.
 */
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled boost min body: covers same physical distance as BOOST_MIN_BODY * SEGMENT_SPACING */
const BOOST_MIN_BODY_SCALED = Math.ceil(BOOST_MIN_BODY * SPACING_RATIO);

// ==========================================================================
// Constants & pools
// ==========================================================================

/** Random bot name pool */
const BOT_NAMES = [
  'Viper', 'Cobra', 'Mamba', 'Python', 'Anaconda', 'Rattler',
  'Sidewinder', 'Boa', 'Asp', 'Taipan', 'Krait', 'Copperhead',
  'KingSnake', 'Coral', 'Adder', 'Basilisk', 'Hydra', 'Ouroboros',
  'Naga', 'Serpent', 'Jormungandr', 'Apep', 'Quetzal', 'Coatl',
  'Wiggles', 'Slithers', 'Fang', 'Venom', 'Toxin', 'Striker',
];

// ─── Hairline-Gap Obstacles ─────────────────────────────────────────────

/** Generate obstacle walls with hairline gaps (1px–20px).
 *  Each barrier is a long wall with a small gap that may or may not be passable.
 *  Collision uses the BLACK DOT (1px radius), so:
 *    - Gaps >= 2px  → passable with reasonable alignment
 *    - Gaps 1px     → barely passable (pixel-perfect precision needed)
 *  Walls are arranged in concentric rectangular rings at increasing distances. */
function generateTestObstacles(): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  // Helper: horizontal wall segment centered at (cx, cy) with half-length hl
  const hWall = (cx: number, cy: number, hl: number) => {
    walls.push({ x1: cx - hl, y1: cy, x2: cx + hl, y2: cy });
  };
  // Helper: vertical wall segment centered at (cx, cy) with half-length hl
  const vWall = (cx: number, cy: number, hl: number) => {
    walls.push({ x1: cx, y1: cy - hl, x2: cx, y2: cy + hl });
  };
  // Helper: full horizontal barrier at y=cy spanning from x=startX to x=endX with gap at gapX of gapSize
  const hBarrier = (cy: number, startX: number, endX: number, gapX: number, gapSize: number) => {
    const leftLen = gapX - gapSize / 2 - startX;
    const rightLen = endX - (gapX + gapSize / 2);
    if (leftLen > 0) hWall(startX + leftLen / 2, cy, leftLen / 2);
    if (rightLen > 0) hWall(gapX + gapSize / 2 + rightLen / 2, cy, rightLen / 2);
  };
  // Helper: full vertical barrier at x=cx spanning from y=startY to y=endY with gap at gapY of gapSize
  const vBarrier = (cx: number, startY: number, endY: number, gapY: number, gapSize: number) => {
    const topLen = gapY - gapSize / 2 - startY;
    const botLen = endY - (gapY + gapSize / 2);
    if (topLen > 0) vWall(cx, startY + topLen / 2, topLen / 2);
    if (botLen > 0) vWall(cx, gapY + gapSize / 2 + botLen / 2, botLen / 2);
  };

  // Helper: horizontal barrier with TWO gaps
  const hBarrier2 = (cy: number, startX: number, endX: number, g1x: number, g1s: number, g2x: number, g2s: number) => {
    const segs = [startX, g1x - g1s / 2, g1x + g1s / 2, g2x - g2s / 2, g2x + g2s / 2, endX];
    for (let i = 0; i < segs.length - 1; i += 2) {
      const cx = (segs[i] + segs[i + 1]) / 2;
      const hl = (segs[i + 1] - segs[i]) / 2;
      if (hl > 0) hWall(cx, cy, hl);
    }
  };
  // Helper: vertical barrier with TWO gaps
  const vBarrier2 = (cx: number, startY: number, endY: number, g1y: number, g1s: number, g2y: number, g2s: number) => {
    const segs = [startY, g1y - g1s / 2, g1y + g1s / 2, g2y - g2s / 2, g2y + g2s / 2, endY];
    for (let i = 0; i < segs.length - 1; i += 2) {
      const cy = (segs[i] + segs[i + 1]) / 2;
      const hl = (segs[i + 1] - segs[i]) / 2;
      if (hl > 0) vWall(cx, cy, hl);
    }
  };

  const W = 500; // wall half-extent (how far walls extend)

  // ═══════════════════════════════════════════════════════════════════
  // Ring 1: 250px from center — 4 walls, one gap each
  // ═══════════════════════════════════════════════════════════════════
  const D1 = 250;
  hBarrier(-D1, -D1 - W, D1 + W, -20, 3);   // top: 3px gap (death trap)
  hBarrier(D1, -D1 - W, D1 + W, 30, 16);     // bottom: 16px gap (passable)
  vBarrier(-D1, -D1 - W, D1 + W, 0, 8);      // left: 8px gap (impassable)
  vBarrier(D1, -D1 - W, D1 + W, 15, 14);     // right: 14px gap (barely passable)

  // ═══════════════════════════════════════════════════════════════════
  // Ring 2: 500px — two gaps per wall
  // ═══════════════════════════════════════════════════════════════════
  const D2 = 500;
  hBarrier2(-D2, -D2 - W, D2 + W, -100, 2, 150, 18);   // top: 2px trap + 18px pass
  hBarrier2(D2, -D2 - W, D2 + W, -80, 10, 120, 20);    // bottom: 10px trap + 20px pass
  vBarrier2(-D2, -D2 - W, D2 + W, -50, 1, 80, 15);     // left: 1px trap + 15px pass
  vBarrier2(D2, -D2 - W, D2 + W, -60, 6, 100, 13);     // right: 6px trap + 13px pass

  // ═══════════════════════════════════════════════════════════════════
  // Ring 3: 800px — wider walls, multiple gaps
  // ═══════════════════════════════════════════════════════════════════
  const D3 = 800;
  const W3 = 600;
  hBarrier2(-D3, -D3 - W3, D3 + W3, -200, 4, 200, 12);  // top: 4px trap + 12px borderline
  hBarrier2(D3, -D3 - W3, D3 + W3, -150, 5, 100, 19);   // bottom: 5px trap + 19px pass
  vBarrier2(-D3, -D3 - W3, D3 + W3, -180, 7, 180, 17);  // left: 7px trap + 17px pass
  vBarrier2(D3, -D3 - W3, D3 + W3, -120, 3, 160, 20);   // right: 3px trap + 20px easy

  // ═══════════════════════════════════════════════════════════════════
  // Ring 4: 1200px — single gap each, very wide walls
  // ═══════════════════════════════════════════════════════════════════
  const D4 = 1200;
  const W4 = 800;
  hBarrier(-D4, -D4 - W4, D4 + W4, 50, 11);    // top: 11px (just under passable)
  hBarrier(D4, -D4 - W4, D4 + W4, -30, 14);    // bottom: 14px (passable)
  vBarrier(-D4, -D4 - W4, D4 + W4, 20, 9);     // left: 9px (impassable)
  vBarrier(D4, -D4 - W4, D4 + W4, -10, 20);    // right: 20px (comfortable)

  // ═══════════════════════════════════════════════════════════════════
  // Ring 5: 1600px — mixed gaps
  // ═══════════════════════════════════════════════════════════════════
  const D5 = 1600;
  const W5 = 900;
  hBarrier2(-D5, -D5 - W5, D5 + W5, -300, 1, 300, 15);  // top: 1px trap + 15px pass
  hBarrier2(D5, -D5 - W5, D5 + W5, -250, 8, 250, 12);   // bottom: 8px trap + 12px borderline
  vBarrier2(-D5, -D5 - W5, D5 + W5, -200, 3, 200, 16);  // left: 3px trap + 16px pass
  vBarrier2(D5, -D5 - W5, D5 + W5, -150, 6, 150, 18);   // right: 6px trap + 18px pass

  // ═══════════════════════════════════════════════════════════════════
  // Ring 6: 2100px — outer ring, extreme gaps
  // ═══════════════════════════════════════════════════════════════════
  const D6 = 2100;
  const W6 = 1000;
  hBarrier(-D6, -D6 - W6, D6 + W6, 0, 2);      // top: 2px death trap
  hBarrier(D6, -D6 - W6, D6 + W6, 100, 20);     // bottom: 20px comfortable
  vBarrier(-D6, -D6 - W6, D6 + W6, -50, 11);    // left: 11px just under
  vBarrier(D6, -D6 - W6, D6 + W6, 50, 13);     // right: 13px passable

  return walls;
}

/** Point-to-line-segment closest distance (squared) */
function pointToSegDistSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.001) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

/** Color palette for snakes (body, head) */
const SNAKE_PALETTES: [string, string][] = [
  ['#ef4444', '#f87171'], ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'], ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'], ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'], ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'], ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

/** Reusable spatial hashes (allocated once, cleared each tick) */
const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();
const headHash = new SpatialHash();

/** Cached squared collision distance */
const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
const EAT_DIST_SQ = (SNAKE_RADIUS + 10) * (SNAKE_RADIUS + 10);
const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

/** Pre-allocated food value cache: foodId → value (rebuilt each tick, avoids .find()) */
const foodValueCache = new Map<number, number>();

/** Scratch entity for spatial hash inserts (avoids object allocation) */
const _insertScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };

// ==========================================================================
// Initialization
// ==========================================================================

/** Optional skin override for the player snake */
export interface PlayerSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
  accentColor: string;
  pattern?: SkinAsset['pattern'];
  animation?: SkinAsset['animation'];
  rarity: SkinRarity;
}

/** Create the initial game state */
export function createInitialState(playerSkin?: PlayerSkinOverride | null, initialScore?: number): GameState {
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
    obstacles: generateTestObstacles(),
  };

  const now = Date.now();

  // Spawn player
  const player = createSnake('player', 'You', initialScore ?? 0, 0, 0, false, now, playerSkin);
  state.player = player;
  state.snakes.set(player.id, player);

  // Spawn bots with varied sizes
  for (let i = 0; i < BOT_COUNT; i++) {
    const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
    const nameIdx = i % BOT_NAMES.length;
    const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
    const pos = findSafeSpawn(state.snakes, 0, 0);
    const bot = createSnake(`bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos.x, pos.y, true, now);
    state.snakes.set(bot.id, bot);
  }

  // Spawn initial food (generous spread around origin for start area)
  spawnFoodBatch(state, 1500, 0, 0, INITIAL_SPAWN_RADIUS);

  return state;
}

/** Create a single snake with PathBuffer for path history */
function createSnake(
  id: string,
  name: string,
  startScore: number,
  posX: number,
  posY: number,
  isBot: boolean,
  now: number,
  skinOverride?: PlayerSkinOverride | null,
): Snake {
  const targetLength = computeBodyLength(startScore);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  // Start facing right (angle=0) to match InputHandler's initial targetAngle=0.
  // Prevents violent spin on game start.
  const angle = 0;

  // Path buffer will store head history (one position per tick at BASE_SPEED spacing).
  // Scale the buffer size to match the visual length of SEGMENT_SPACING-based segments.
  const spacingRatio = SEGMENT_SPACING / BASE_SPEED;
  const pathTarget = Math.max(Math.ceil(targetLength * spacingRatio), 10);
  const path = new PathBuffer(Math.max(pathTarget * 2, 100));

  // Initialize: index 0 = head, body trailing behind at BASE_SPEED intervals
  // (matches the runtime spacing from prepend-every-tick)
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
  const rarity = skinOverride ? skinOverride.rarity : 'common';

  return {
    id,
    name,
    path,
    angle,
    prevAngle: angle,
    speed: BASE_SPEED,
    score: startScore,
    boosting: false,
    alive: true,
    isBot,
    isPlayer: !isBot,
    spawnTime: now,
    color,
    headColor,
    lastBoostDrop: 0,
    targetAngle: angle,
    spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
    bodyRadius: computeBodyRadius(startScore),
    skinId,
    rarity,
  };
}

/** Find a safe spawn position away from all other snakes */
function findSafeSpawn(snakes: Map<string, Snake>, nearX: number, nearY: number): { x: number; y: number } {
  const spawnRadius = INITIAL_SPAWN_RADIUS;
  for (let attempt = 0; attempt < SAFE_SPAWN_ATTEMPTS; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 200 + Math.random() * (spawnRadius - 200);
    const x = nearX + Math.cos(a) * d;
    const y = nearY + Math.sin(a) * d;

    let safe = true;
    const safeDistSq = SAFE_SPAWN_DIST * SAFE_SPAWN_DIST;
    for (const [, snake] of snakes) {
      if (!snake.alive) continue;
      // Check head only for performance
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
// Main Game Tick
// ==========================================================================

/**
 * Main game tick. Zero-alloc hot path: no Vec2 objects created.
 * Mutates state in-place for performance with 1000 bots.
 */
export function gameTick(state: GameState, input: InputState, _dt: number): void {
  state.tickCount++;
  const now = Date.now();

  // 1. Move player
  const player = state.player;
  if (player && player.alive) {
    moveSnake(state, player, input.targetAngle, input.boosting, now);
  }

  // 2. Move bots
  for (const [, snake] of state.snakes) {
    if (!snake.alive || !snake.isBot) continue;
    const botAngle = getBotTarget(snake, state.snakes, state.foods);
    moveSnake(state, snake, botAngle, false, now);
  }

  // 3. Check food eating
  checkFoodEating(state, now);

  // 4. Check star chip collection
  checkStarChips(state, now);

  // 5. Density-based food spawning + despawn (slither.io style — unlimited food)
  maintainFoodAroundPlayer(state);

  // 6. Spawn star chips in extraction zone
  if (state.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
    spawnStarChip(state, now);
  }

  // 7. Check collisions
  checkCollisions(state, now);

  // 8. Respawn dead bots to maintain population
  respawnBots(state, now);
}

// Inner curl (corner-cutting) is now applied as a purely visual effect
// in the renderer (local/offline) and snapshot builder (online).
// See renderer.ts: computeInnerCurlOffset() and snapshot.ts: applyInnerCurlToSnapshot().

// ==========================================================================
// Snake Movement
// ==========================================================================

function moveSnake(
  state: GameState,
  snake: Snake,
  targetAngle: number,
  wantBoost: boolean,
  now: number,
): void {
  // Store target angle so renderers can use it (responsive eyes, etc.)
  snake.targetAngle = targetAngle;
  // Store previous angle for turn detection
  snake.prevAngle = snake.angle;

  // ── Angle computation with Spiral Assist ───────────────────────────
  // Dynamic turn rate: faster speed = less turning ability.
  // Spiral assist: when player holds a consistent tight turn, gradually
  // enhance the turn rate so the snake can make progressively tighter
  // circles — works at both base and boost speed.

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

  // Apply turn (clamped to effective maxTurn, which may be spiral-boosted)
  if (Math.abs(diff) <= maxTurn) {
    snake.angle = targetAngle;
  } else {
    snake.angle += Math.sign(diff) * maxTurn;
  }

  // Normalize angle to [-PI, PI]
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  snake.boosting = canBoost;
  snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

  // Extraction zone speed bonus
  if (state.extractionZone.active && snake.score >= EXTRACTION_SCORE_THRESHOLD) {
    const ez = state.extractionZone;
    const dx = snake.path.getX(0) - ez.x;
    const dy = snake.path.getY(0) - ez.y;
    if (dx * dx + dy * dy < ez.radius * ez.radius) {
      snake.speed *= EXTRACTION_SPEED_BONUS;
    }
  }

  // ── PATH BUFFER MOVEMENT ────────────────────────────────────────────
  // Each tick, the new head position is prepended to the path buffer.
  // The body is simply the head's past position history — segment i is
  // where the head was i ticks ago. This guarantees the tail ALWAYS
  // moves forward because it reads from an advancing path. No chain
  // physics tangling, no self-overlap freezing.

  // 1. Compute new head position
  const newHeadX = snake.path.getX(0) + Math.cos(snake.angle) * snake.speed;
  const newHeadY = snake.path.getY(0) + Math.sin(snake.angle) * snake.speed;

  // 2. Prepend new head position (shifts all indices +1)
  snake.path.prepend(newHeadX, newHeadY);

  // ── Growth / Shrink ────────────────────────────────────────────────
  // Path entries are spaced at BASE_SPEED (one per tick).
  // To maintain the same visual length as SEGMENT_SPACING-based segments,
  // we scale the path buffer length by the spacing ratio.
  const logicalLen = computeBodyLength(snake.score);
  const targetLength = Math.ceil(logicalLen * SPACING_RATIO);

  // Boost food drop: leave a food orb at the tail every interval.
  // Visual feedback only — actual shrinking is handled by the trim logic.
  if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
    snake.lastBoostDrop = now;
    const tailIdx = snake.path.length - 1;
    if (tailIdx > 0) {
      state.foods.push({
        id: state.nextFoodId++,
        x: snake.path.getX(tailIdx),
        y: snake.path.getY(tailIdx),
        size: 'small', value: 1, radius: FOOD_RADII[0],
        color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
      });
    }
  }

  // Boost score cost: integer-based — deduct 1 point every N ticks.
  // Score drops → targetLength drops → body shrinks smoothly after boost ends.
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
  // prepend adds 1 every tick. Single pop cancels it (net zero), so the
  // snake can grow but never shrink. Fix: allow up to 2 pops per tick so
  // excess length drains faster than it accumulates.
  //   - At targetLength: prepend(+1), pop(-1) = stable
  //   - Below target: prepend(+1), no pop = grows by 1/tick
  //   - Above target: prepend(+1), pop×2(-2) = shrinks by 1/tick
  const excess = snake.path.length - targetLength;
  if (excess > 0) {
    const pops = Math.min(excess, 2);
    for (let i = 0; i < pops; i++) snake.path.pop();
  }

  // ── NOTE: Inner curl (corner-cutting) is a PURELY VISUAL effect ──
  // It is computed fresh each frame in the renderer / snapshot builder.
  // We do NOT mutate the path buffer here, because offsets would accumulate
  // across ticks (path entries persist and shift indices on prepend),
  // causing the body to shatter and flicker.

  // Update visual body radius (grows with score — collision stays at SNAKE_RADIUS)
  snake.bodyRadius = computeBodyRadius(snake.score);
}

// ==========================================================================
// Star Chips
// ==========================================================================

function spawnStarChip(state: GameState, now: number): void {
  const ez = state.extractionZone;
  if (!ez.active) return;

  const a = Math.random() * Math.PI * 2;
  const d = Math.random() * ez.radius * 0.8;
  const colorIdx = Math.floor(Math.random() * STAR_CHIP_COLORS.length);

  state.starChips.push({
    id: state.nextStarChipId++,
    x: ez.x + Math.cos(a) * d,
    y: ez.y + Math.sin(a) * d,
    value: STAR_CHIP_VALUE,
    radius: STAR_CHIP_RADIUS,
    glowColor: STAR_CHIP_GLOW,
    color: STAR_CHIP_COLORS[colorIdx],
    spawnTime: now,
  });
}

function checkStarChips(state: GameState, _now: number): void {
  if (state.starChips.length === 0) return;

  const collected = new Set<number>();

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;

    for (let i = 0; i < state.starChips.length; i++) {
      const chip = state.starChips[i];
      if (collected.has(chip.id)) continue;

      if (distSq(hx, hy, chip.x, chip.y) <= STAR_CHIP_DIST_SQ) {
        collected.add(chip.id);
        snake.score += chip.value;
      }
    }
  }

  if (collected.size > 0) {
    // Swap-remove collected chips (no .filter() allocation)
    let writeIdx = 0;
    for (let i = 0; i < state.starChips.length; i++) {
      if (!collected.has(state.starChips[i].id)) {
        state.starChips[writeIdx++] = state.starChips[i];
      }
    }
    state.starChips.length = writeIdx;
  }
}

// ==========================================================================
// Food
// ==========================================================================

function makeFood(state: GameState, x: number, y: number, forceSize?: number): FoodOrb {
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
    id: state.nextFoodId++,
    x,
    y,
    size: FOOD_SIZES[sizeIndex],
    value: FOOD_VALUES[sizeIndex],
    radius: FOOD_RADII[sizeIndex],
    color: FOOD_COLORS[sizeIndex],
    glowColor: FOOD_GLOW_COLORS[sizeIndex],
  };
}

const DESPAWN_RADIUS_SQ = FOOD_DESPAWN_RADIUS * FOOD_DESPAWN_RADIUS;
const VISIBLE_RADIUS_SQ = FOOD_VISIBLE_RADIUS * FOOD_VISIBLE_RADIUS;

/**
 * Slither.io-style food management:
 * 1. Count food within player's visible radius
 * 2. Spawn food ahead + around player to maintain density
 * 3. Despawn food beyond despawn radius
 * Result: infinite food that follows the player, no clusters, no empty areas
 */
function maintainFoodAroundPlayer(state: GameState): void {
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
    const distSq = dx * dx + dy * dy;

    if (distSq > DESPAWN_RADIUS_SQ) {
      // Too far — despawn (skip, don't copy to write position)
      continue;
    }

    // Keep this food
    if (writeIdx !== i) foods[writeIdx] = f;
    writeIdx++;

    if (distSq < VISIBLE_RADIUS_SQ) nearbyCount++;
  }

  // Trim the array
  foods.length = writeIdx;

  // --- Step 2: Spawn food to maintain density ---
  const deficit = FOOD_DENSITY_TARGET - nearbyCount;
  if (deficit <= 0 || foods.length >= FOOD_MAX_COUNT) return;

  const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);

  // 70% ahead of the player (slither.io style — food where you're going)
  // 30% in a ring around the player for variety
  const aheadCount = Math.ceil(batch * 0.7);
  const aroundCount = batch - aheadCount;

  // Ahead: fan in front of the snake
  for (let i = 0; i < aheadCount; i++) {
    const spread = (Math.random() - 0.5) * Math.PI * 0.8; // ±72° fan
    const dist = 400 + Math.random() * (FOOD_VISIBLE_RADIUS - 400);
    const a = angle + spread;
    const sx = hx + Math.cos(a) * dist;
    const sy = hy + Math.sin(a) * dist;
    state.foods.push(makeFood(state, sx, sy));
  }

  // Around: wide ring for ambient food
  for (let i = 0; i < aroundCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 600 + Math.random() * (FOOD_VISIBLE_RADIUS - 600);
    const sx = hx + Math.cos(a) * dist;
    const sy = hy + Math.sin(a) * dist;
    state.foods.push(makeFood(state, sx, sy));
  }
}

function spawnFoodBatch(state: GameState, count: number, cx: number, cy: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * radius;
    state.foods.push(makeFood(state, cx + Math.cos(a) * d, cy + Math.sin(a) * d));
  }
}

// ==========================================================================
// Food Eating
// ==========================================================================

function checkFoodEating(state: GameState, now: number): void {
  // Build food spatial hash + value cache
  foodHash.clear();
  foodValueCache.clear();
  const foods = state.foods;
  const scratch = _insertScratch;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    scratch.x = f.x; scratch.y = f.y; scratch.radius = f.radius; scratch.id = f.id;
    foodHash.insert(scratch);
    foodValueCache.set(f.id, f.value);
  }

  const eatenIds = new Set<number>();

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;

    // Spawn protection: player can't eat food for first 4s
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

  // Swap-remove eaten food (no .filter() allocation)
  if (eatenIds.size > 0) {
    let writeIdx = 0;
    for (let i = 0; i < foods.length; i++) {
      if (!eatenIds.has(foods[i].id)) {
        foods[writeIdx++] = foods[i];
      }
    }
    foods.length = writeIdx;
  }
}

// ==========================================================================
// Collisions
// ==========================================================================

function checkCollisions(state: GameState, now: number): void {
  // ── Build body segment spatial hash (no neck protection — start from index 0) ──
  bodyHash.clear();
  const scratch = _insertScratch;
  scratch.radius = SNAKE_RADIUS;

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const len = snake.path.length;
    const sid = snake.id;
    // Step by 2: adjacent path entries are only BASE_SPEED (4.5px) apart,
    // but collision radius is SNAKE_RADIUS*2 (16px). Stepping by 2 halves
    // spatial hash inserts with negligible accuracy loss.
    for (let i = 0; i < len; i += 2) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      scratch.id = sid;
      bodyHash.insert(scratch);
    }
  }

  // ── Build head spatial hash using BLACK DOT positions ──
  // Black dot is at 0.75 * bodyRadius from head center, in direction of travel.
  headHash.clear();
  const dotDist = 0.75;
  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;
    scratch.x = dotX;
    scratch.y = dotY;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const snakesMap = state.snakes;

  // ── Head-to-body collision: black dot hits other snake's body ──
  for (const [, snake] of snakesMap) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;

    // Black dot position
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;

    // Spawn protection
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      // Skip self-collision
      if (otherId === snake.id) continue;

      if (distSq(dotX, dotY, entity.x, entity.y) <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        break;
      }
    }
  }

  // ── Head-on-head collision: black dot vs black dot ──
  // Rules:
  //   Neither boosting: Larger wins, smaller dies
  //   Smaller boosting, larger steady: Smaller survives!
  //   Both boosting: Larger wins
  //   Tie (same length): Both die
  for (const [, snake] of snakesMap) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;

    const nearby = headHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id) continue; // skip self
      if (deadSnakes.has(otherId)) continue; // already dead

      const otherSnake = snakesMap.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const otherDotX = otherSnake.path.headX + Math.cos(otherSnake.angle) * otherSnake.bodyRadius * dotDist;
      const otherDotY = otherSnake.path.headY + Math.sin(otherSnake.angle) * otherSnake.bodyRadius * dotDist;

      const dx = dotX - otherDotX;
      const dy = dotY - otherDotY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      // Head-on-head: resolved by length + boost rules
      const lenA = snake.path.length;
      const lenB = otherSnake.path.length;
      const aBoost = snake.boosting;
      const bBoost = otherSnake.boosting;

      if (lenA > lenB) {
        // Larger is A
        if (!aBoost && bBoost) {
          // Larger steady, smaller boosting → smaller survives
          deadSnakes.add(snake.id); // larger dies
        } else {
          // (neither boosting) or (both boosting) → larger wins
          deadSnakes.add(otherId);
        }
      } else if (lenB > lenA) {
        // Larger is B
        if (!bBoost && aBoost) {
          // Larger steady, smaller boosting → smaller survives
          deadSnakes.add(otherId); // larger dies
        } else {
          deadSnakes.add(snake.id);
        }
      } else {
        // Tie: both die
        deadSnakes.add(snake.id);
        deadSnakes.add(otherId);
      }
    }
  }

  // ── Obstacle collision: black dot (1px radius) vs wall segments ──
  const obstacles = state.obstacles;
  if (obstacles.length > 0) {
    const wallHitDistSq = 1; // black dot is a point — 1px kill radius for walls
    for (const [, snake] of snakesMap) {
      if (!snake.alive || deadSnakes.has(snake.id)) continue;
      if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * dotDist;
      const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * dotDist;

      for (let w = 0; w < obstacles.length; w++) {
        const ob = obstacles[w];
        if (pointToSegDistSq(dotX, dotY, ob.x1, ob.y1, ob.x2, ob.y2) <= wallHitDistSq) {
          deadSnakes.add(snake.id);
          break;
        }
      }
    }
  }

  // Process deaths
  for (const deadId of deadSnakes) {
    const deadSnake = snakesMap.get(deadId);
    if (deadSnake) killSnake(state, deadSnake);
  }
}

// ==========================================================================
// Death & Respawn
// ==========================================================================

function killSnake(state: GameState, snake: Snake): void {
  snake.alive = false;

  // Death food formula: L=floor(score/divisor_L), rem=score-L*divisor_L, M=floor(rem/divisor_M), S=rem-M*divisor_M
  const score = snake.score;
  const largeCount = Math.floor(score / DEATH_FOOD_LARGE_DIVISOR);
  let remainder = score - largeCount * DEATH_FOOD_LARGE_DIVISOR;
  const medCount = Math.floor(remainder / DEATH_FOOD_MEDIUM_DIVISOR);
  const smallCount = remainder - medCount * DEATH_FOOD_MEDIUM_DIVISOR;

  const totalFood = largeCount + medCount + smallCount;
  if (totalFood === 0) {
    if (!snake.isPlayer) state.snakes.delete(snake.id);
    return;
  }

  // Distribute food along body path
  const segLen = snake.path.length;
  const step = Math.max(1, Math.floor(segLen / totalFood));
  let foodIdx = 0;

  // Large food (pink) — placed exactly on body path
  for (let i = 0; i < largeCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si), y: snake.path.getY(si),
      size: 'large', value: FOOD_VALUES[2], radius: FOOD_RADII[2],
      color: FOOD_COLORS[2], glowColor: FOOD_GLOW_COLORS[2],
    });
    foodIdx++;
  }
  // Medium food (blue) — placed exactly on body path
  for (let i = 0; i < medCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si), y: snake.path.getY(si),
      size: 'medium', value: FOOD_VALUES[1], radius: FOOD_RADII[1],
      color: FOOD_COLORS[1], glowColor: FOOD_GLOW_COLORS[1],
    });
    foodIdx++;
  }
  // Small food (green) — placed exactly on body path
  for (let i = 0; i < smallCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si), y: snake.path.getY(si),
      size: 'small', value: FOOD_VALUES[0], radius: FOOD_RADII[0],
      color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
    });
    foodIdx++;
  }

  // Remove from map unless player (kept for respawn)
  if (!snake.isPlayer) state.snakes.delete(snake.id);
}

/** Respawn dead bots to maintain population */
function respawnBots(state: GameState, now: number): void {
  // Count alive bots
  let aliveBots = 0;
  for (const [, s] of state.snakes) {
    if (s.alive && s.isBot) aliveBots++;
  }

  const deficit = BOT_COUNT - aliveBots;
  // Respawn up to 3 per tick to avoid frame spikes
  const toRespawn = Math.min(deficit, 3);

  for (let i = 0; i < toRespawn; i++) {
    const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
    const nameIdx = (state.tickCount + i) % BOT_NAMES.length;
    const pos = findSafeSpawn(state.snakes, 0, 0);
    const bot = createSnake(
      `bot-${now}-${i}`, BOT_NAMES[nameIdx], score, pos.x, pos.y, true, now
    );
    state.snakes.set(bot.id, bot);
  }
}

/** Set debug score and immediately resize the path buffer to match.
 *  Extends the path behind the tail in a straight line to reach the target length,
 *  or trims if the new score produces a shorter snake. */
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

    player.path.ensureCapacity(targetPathLen + 10);

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

// ==========================================================================
// Re-exports
// ==========================================================================

export { buildSnapshot } from './snapshot';

/** Respawn the player snake */
export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;

  const pos = findSafeSpawn(state.snakes, 0, 0);
  // Preserve player's skin on respawn
  const skinOverride: PlayerSkinOverride | undefined = old ? {
    skinId: old.skinId,
    bodyColor: old.color,
    headColor: old.headColor,
    accentColor: '',
    rarity: old.rarity,
  } : undefined;
  const newPlayer = createSnake('player', 'You', 0, pos.x, pos.y, false, Date.now(), skinOverride);
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}
