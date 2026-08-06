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
  BASE_SPEED, BOOST_SPEED, SEGMENT_SPACING, GROWTH_RATE, START_LENGTH, MAX_SNAKE_LENGTH,
  MAX_TURN_RATE,
  // FOOD
  FOOD_COUNT_TARGET, FOOD_SPAWN_WEIGHTS, FOOD_VALUES, FOOD_RADII,
  FOOD_COLORS, FOOD_GLOW_COLORS, FOOD_SPAWN_AREA_RADIUS, INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH,
  // COLLISION
  SNAKE_RADIUS, NECK_PROTECTION, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  DEATH_FOOD_LARGE_DIVISOR, DEATH_FOOD_MEDIUM_DIVISOR, HEAD_ON_HEAD_BOOST_WINS,
  // BOOST
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE, BOOST_SCORE_COST_PER_TICK,
  // BOT
  BOT_COUNT, BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  // SPAWN
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // EXTRACTION
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD, EXTRACTION_SPEED_BONUS,
  STAR_CHIP_VALUE, STAR_CHIP_SPAWN_INTERVAL, STAR_CHIP_RADIUS,
  STAR_CHIP_GLOW, STAR_CHIP_COLORS,
} from './config';

/**
 * Path buffer stores one head position per tick at BASE_SPEED spacing.
 * Original game logic uses SEGMENT_SPACING for segment counts.
 * This ratio scales path-length-dependent values accordingly.
 */
const SPACING_RATIO = SEGMENT_SPACING / BASE_SPEED;

/** Scaled neck protection: covers same physical distance as NECK_PROTECTION * SEGMENT_SPACING */
const NECK_PROTECTION_SCALED = Math.ceil(NECK_PROTECTION * SPACING_RATIO);

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
// Spiral turn system DISABLED — was causing infinite spinning bug.
// The exit condition could never trigger because the spiral's own turn
// rate (clamped to MAX_TURN_RATE * 2 = 0.754 rad) always exceeded
// MAX_SPIRAL_ANGLE_DELTA (0.15 rad). Will be re-implemented later.
// ==========================================================================

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
export function createInitialState(playerSkin?: PlayerSkinOverride | null): GameState {
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

  // Spawn player
  const player = createSnake('player', 'You', 0, 0, 0, false, now, playerSkin);
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

  // Spawn initial food
  spawnFoodBatch(state, FOOD_COUNT_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);

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
  const targetLength = Math.min(Math.floor(START_LENGTH + startScore * GROWTH_RATE), MAX_SNAKE_LENGTH);
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
    spiral: { active: false, startAngle: 0, theta: 0, ticksElapsed: 0, a: 0, b: 0, direction: 1 },
    bodyRadius: SNAKE_RADIUS,
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

  // 5. Spawn food to maintain target count
  if (state.foods.length < FOOD_COUNT_TARGET) {
    const deficit = FOOD_COUNT_TARGET - state.foods.length;
    let cx = 0;
    let cy = 0;
    const alive: Snake[] = [];
    for (const [, s] of state.snakes) {
      if (s.alive && s.path.length > 0) alive.push(s);
    }
    if (alive.length > 0) {
      const rs = alive[Math.floor(Math.random() * alive.length)];
      cx = rs.path.headX;
      cy = rs.path.headY;
    }
    spawnFoodBatch(state, Math.min(deficit, FOOD_RESPAWN_BATCH), cx, cy, FOOD_SPAWN_AREA_RADIUS);
  }

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

  // ── Angle computation ──────────────────────────────────────────────
  // Simple linear turning toward target angle.

  let diff = targetAngle - snake.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const maxTurn = snake.isBot ? BOT_MAX_TURN_RATE : MAX_TURN_RATE;
  if (Math.abs(diff) <= maxTurn) {
    snake.angle = targetAngle;
  } else {
    snake.angle += Math.sign(diff) * maxTurn;
  }

  // Normalize angle to [-PI, PI]
  if (snake.angle > Math.PI) snake.angle -= 2 * Math.PI;
  else if (snake.angle < -Math.PI) snake.angle += 2 * Math.PI;

  // Boost eligibility
  const canBoost = wantBoost &&
    snake.score >= BOOST_MIN_SCORE &&
    snake.path.length > BOOST_MIN_BODY_SCALED;

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
  const targetLength = Math.min(
    Math.ceil((START_LENGTH + snake.score * GROWTH_RATE) * SPACING_RATIO),
    Math.ceil(MAX_SNAKE_LENGTH * SPACING_RATIO),
  );

  // Boost: drop food from tail, shrink snake
  // During boost, path entries are 8px apart (vs 4.5px normal), so the path
  // covers more distance with fewer entries. We must shrink AGGRESSIVELY
  // to overcome the wide entry spacing and the trim loop.
  if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
    snake.lastBoostDrop = now;
    const tailIdx = snake.path.length - 1;
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(tailIdx),
      y: snake.path.getY(tailIdx),
      size: 'small', value: 1, radius: FOOD_RADII[0],
      color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
    });
    // Extra shrink: pop several entries so the visual body gets shorter
    for (let i = 0; i < 5; i++) {
      if (snake.path.length > BOOST_MIN_BODY_SCALED) snake.path.pop();
    }
  }

  // Per-tick boost shrink: pop 1 entry to counteract prepend's +1.
  // Without this, the trim loop would grow the path back between drops.
  if (canBoost && snake.path.length > BOOST_MIN_BODY_SCALED) {
    snake.path.pop();
  }

  // Boost score cost: decreasing score shrinks the snake over time.
  // Score directly drives targetLength, so lowering score = shorter body.
  if (canBoost) {
    snake.score = Math.max(0, snake.score - BOOST_SCORE_COST_PER_TICK);
  }

  // Trim to target length (only when NOT boosting — boost handles its own length)
  if (!canBoost) {
    while (snake.path.length > targetLength) {
      snake.path.pop();
    }
  }

  // ── NOTE: Inner curl (corner-cutting) is a PURELY VISUAL effect ──
  // It is computed fresh each frame in the renderer / snapshot builder.
  // We do NOT mutate the path buffer here, because offsets would accumulate
  // across ticks (path entries persist and shift indices on prepend),
  // causing the body to shatter and flicker.

  // Update cached body radius
  snake.bodyRadius = SNAKE_RADIUS;
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
  // ── Build body segment spatial hash ──
  // Key optimization: entity.id = snake.id (the string, reused — no concat)
  // No bodySegMap needed — just look up entity.id directly in state.snakes
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
    for (let i = NECK_PROTECTION_SCALED; i < len; i += 2) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      scratch.id = sid;
      bodyHash.insert(scratch);
    }
  }

  // ── Build head spatial hash for O(n) head-on-head check ──
  headHash.clear();
  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    scratch.x = snake.path.headX;
    scratch.y = snake.path.headY;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const snakesMap = state.snakes;

  // ── Head-to-body collision check ──
  for (const [, snake] of snakesMap) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;

    // Spawn protection
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(hx, hy, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      // Skip self-collision (body segments have same id as head)
      if (otherId === snake.id) continue;

      if (distSq(hx, hy, entity.x, entity.y) <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        break;
      }
    }
  }

  // ── Head-on-head collision via spatial hash (O(n) instead of O(n²)) ──
  for (const [, snake] of snakesMap) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const hx = snake.path.headX;
    const hy = snake.path.headY;

    const nearby = headHash.query(hx, hy, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id) continue; // skip self
      if (deadSnakes.has(otherId)) continue; // already dead

      const otherSnake = snakesMap.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const dx = hx - otherSnake.path.headX;
      const dy = hy - otherSnake.path.headY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      // Head-on-head collision resolved by length + boost rules
      const lenA = snake.path.length;
      const lenB = otherSnake.path.length;

      if (lenA > lenB) {
        if (HEAD_ON_HEAD_BOOST_WINS && otherSnake.boosting && !snake.boosting) {
          deadSnakes.add(snake.id);
        } else {
          deadSnakes.add(otherId);
        }
      } else if (lenB > lenA) {
        if (HEAD_ON_HEAD_BOOST_WINS && snake.boosting && !otherSnake.boosting) {
          deadSnakes.add(otherId);
        } else {
          deadSnakes.add(snake.id);
        }
      } else {
        deadSnakes.add(snake.id);
        deadSnakes.add(otherId);
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

  // Large food (pink)
  for (let i = 0; i < largeCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    const ox = (Math.random() - 0.5) * 20;
    const oy = (Math.random() - 0.5) * 20;
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
      size: 'large', value: FOOD_VALUES[2], radius: FOOD_RADII[2],
      color: FOOD_COLORS[2], glowColor: FOOD_GLOW_COLORS[2],
    });
    foodIdx++;
  }
  // Medium food (blue)
  for (let i = 0; i < medCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    const ox = (Math.random() - 0.5) * 20;
    const oy = (Math.random() - 0.5) * 20;
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
      size: 'medium', value: FOOD_VALUES[1], radius: FOOD_RADII[1],
      color: FOOD_COLORS[1], glowColor: FOOD_GLOW_COLORS[1],
    });
    foodIdx++;
  }
  // Small food (green)
  for (let i = 0; i < smallCount; i++) {
    const si = Math.min(foodIdx * step, segLen - 1);
    const ox = (Math.random() - 0.5) * 20;
    const oy = (Math.random() - 0.5) * 20;
    state.foods.push({
      id: state.nextFoodId++,
      x: snake.path.getX(si) + ox, y: snake.path.getY(si) + oy,
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
