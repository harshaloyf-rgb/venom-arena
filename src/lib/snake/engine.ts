// ============================================================================
// Game Engine — Phase A: Zero-Allocation Core
// 
// Uses PathBuffer (Float32Array) for snake paths — no Vec2[] allocation.
// Adds Fibonacci turn detection, extraction zone, star chips.
// Mutates state in-place for performance with 1000 bots.
// ============================================================================

import type {
  GameState, InputState, FoodOrb, Snake, StarChip, SpiralTurnState,
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
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE, BOOST_SHRINK_RATE,
  // BOT
  BOT_COUNT, BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  // SPAWN
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  // SPIRAL_TURN
  TIGHT_TURN_THRESHOLD, SPIRAL_DETECT_WINDOW, MAX_SPIRAL_ANGLE_DELTA,
  SPIRAL_A, SPIRAL_B,
  // EXTRACTION
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD, EXTRACTION_SPEED_BONUS,
  STAR_CHIP_VALUE, STAR_CHIP_SPAWN_INTERVAL, STAR_CHIP_RADIUS,
  STAR_CHIP_GLOW, STAR_CHIP_COLORS,
} from './config';

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

/** Cached squared collision distance */
const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
const EAT_DIST_SQ = (SNAKE_RADIUS + 10) * (SNAKE_RADIUS + 10);
const STAR_CHIP_DIST_SQ = (SNAKE_RADIUS + STAR_CHIP_RADIUS) * (SNAKE_RADIUS + STAR_CHIP_RADIUS);

// ==========================================================================
// Spiral turn detection (Phase A: detection only, math in Phase B)
// ==========================================================================

function createSpiralState(): SpiralTurnState {
  return {
    active: false,
    startAngle: 0,
    theta: 0,
    ticksElapsed: 0,
    a: SPIRAL_A,
    b: SPIRAL_B,
    direction: 1,
  };
}

/**
 * Detect tight turns and update Fibonacci spiral state.
 * Phase A: detection + metadata generation only.
 * Phase B will use this state for actual spiral path math.
 */
function updateSpiralTurn(snake: Snake, angleDelta: number): void {
  const absDelta = Math.abs(angleDelta);
  const spiral = snake.spiral;

  if (!spiral.active) {
    // Check if we entered a tight turn
    if (absDelta > TIGHT_TURN_THRESHOLD) {
      spiral.active = true;
      spiral.startAngle = snake.prevAngle;
      spiral.theta = 0;
      spiral.ticksElapsed = 0;
      spiral.direction = angleDelta > 0 ? 1 : -1;
    }
  } else {
    // We're in a spiral turn
    spiral.ticksElapsed++;
    spiral.theta += absDelta;

    // Check if spiral ended (angle delta returned to normal)
    if (absDelta < MAX_SPIRAL_ANGLE_DELTA && spiral.ticksElapsed > SPIRAL_DETECT_WINDOW) {
      spiral.active = false;
    }
  }
}

// ==========================================================================
// Initialization
// ==========================================================================

/** Create the initial game state */
export function createInitialState(): GameState {
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
  const player = createSnake('player', 'You', 0, 0, 0, false, now);
  state.player = player;
  state.snakes.set(player.id, player);

  // Spawn bots with varied sizes
  for (let i = 0; i < BOT_COUNT; i++) {
    const score = BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN);
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
): Snake {
  const targetLength = Math.min(Math.floor(START_LENGTH + startScore * GROWTH_RATE), MAX_SNAKE_LENGTH);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  const angle = Math.random() * Math.PI * 2;

  // Pre-allocate path buffer
  const path = new PathBuffer(Math.max(targetLength * 2, 100));

  // Fill initial path (head at [0], body trailing behind)
  for (let i = 0; i < targetLength; i++) {
    const x = posX - Math.cos(angle) * i * SEGMENT_SPACING;
    const y = posY - Math.sin(angle) * i * SEGMENT_SPACING;
    path.prepend(x, y);
  }

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
    color: palette[0],
    headColor: palette[1],
    lastBoostDrop: 0,
    targetAngle: angle,
    spiral: createSpiralState(),
    bodyRadius: SNAKE_RADIUS,
    skinId: 'skin-default',
    rarity: 'common',
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
  // Store previous angle for turn detection
  snake.prevAngle = snake.angle;

  // Smooth turning with angle wrapping
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

  // Fibonacci spiral turn detection (Phase A)
  updateSpiralTurn(snake, diff);

  // Boost eligibility
  const canBoost = wantBoost &&
    snake.score > BOOST_MIN_SCORE &&
    snake.path.length > BOOST_MIN_BODY;

  snake.boosting = canBoost;
  snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

  // Extraction zone speed bonus
  if (state.extractionZone.active && snake.score >= EXTRACTION_SCORE_THRESHOLD) {
    const ez = state.extractionZone;
    const dx = snake.path.headX - ez.x;
    const dy = snake.path.headY - ez.y;
    if (dx * dx + dy * dy < ez.radius * ez.radius) {
      snake.speed *= EXTRACTION_SPEED_BONUS;
    }
  }

  // Move head forward
  const headX = snake.path.headX + Math.cos(snake.angle) * snake.speed;
  const headY = snake.path.headY + Math.sin(snake.angle) * snake.speed;
  snake.path.prepend(headX, headY);

  // Target length from score
  const targetLength = Math.min(Math.floor(START_LENGTH + snake.score * GROWTH_RATE), MAX_SNAKE_LENGTH);

  // Boost: drop food from tail, shrink
  if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
    snake.lastBoostDrop = now;
    const tailX = snake.path.tailX;
    const tailY = snake.path.tailY;
    state.foods.push({
      id: state.nextFoodId++, x: tailX, y: tailY,
      size: 'small', value: 1, radius: FOOD_RADII[0],
      color: FOOD_COLORS[0], glowColor: FOOD_GLOW_COLORS[0],
    });
    // Extra shrink from boost
    if (snake.path.length > 1) snake.path.pop();
  }

  // Trim segments to target length
  while (snake.path.length > targetLength) {
    snake.path.pop();
  }

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
    state.starChips = state.starChips.filter(c => !collected.has(c.id));
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
  // Build food spatial hash
  foodHash.clear();
  for (let i = 0; i < state.foods.length; i++) {
    const f = state.foods[i];
    foodHash.insert({ x: f.x, y: f.y, radius: f.radius, id: f.id } as SpatialEntity);
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
        snake.score += (state.foods.find(f => f.id === fid))?.value ?? 1;
      }
    }
  }

  if (eatenIds.size > 0) {
    state.foods = state.foods.filter(f => !eatenIds.has(f.id));
  }
}

// ==========================================================================
// Collisions
// ==========================================================================

function checkCollisions(state: GameState, now: number): void {
  // Build body segment spatial hash
  bodyHash.clear();
  const bodySegCount = state.snakes.size * 50; // rough estimate
  // Map from entityKey -> snakeId
  const bodySegMap = new Map<string, string>();

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const len = snake.path.length;
    for (let i = NECK_PROTECTION; i < len; i++) {
      const sx = snake.path.getX(i);
      const sy = snake.path.getY(i);
      const key = `${snake.id}:${i}`;
      bodySegMap.set(key, snake.id);
      bodyHash.insert({ x: sx, y: sy, radius: SNAKE_RADIUS, id: key } as SpatialEntity);
    }
  }

  const deadSnakes = new Set<string>();

  // Head-to-body collision check
  for (const [, snake] of state.snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const hx = snake.path.headX;
    const hy = snake.path.headY;

    // Spawn protection
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(hx, hy, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const key = entity.id as string;
      const otherSnakeId = bodySegMap.get(key);
      if (!otherSnakeId || otherSnakeId === snake.id) continue;

      const otherSnake = state.snakes.get(otherSnakeId);
      if (!otherSnake || !otherSnake.alive) continue;

      if (distSq(hx, hy, entity.x, entity.y) <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        break;
      }
    }
  }

  // Head-on-head collision check
  const aliveArr: Snake[] = [];
  for (const [, s] of state.snakes) {
    if (s.alive && !deadSnakes.has(s.id) && s.path.length > 0) {
      aliveArr.push(s);
    }
  }

  for (let i = 0; i < aliveArr.length; i++) {
    const a = aliveArr[i];
    if (deadSnakes.has(a.id)) continue;

    for (let j = i + 1; j < aliveArr.length; j++) {
      const b = aliveArr[j];
      if (deadSnakes.has(b.id)) continue;

      // Spawn protection
      if (now - a.spawnTime < SPAWN_PROTECTION_MS) continue;
      if (now - b.spawnTime < SPAWN_PROTECTION_MS) continue;

      const dx = a.path.headX - b.path.headX;
      const dy = a.path.headY - b.path.headY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      // Head-on-head collision resolved by length + boost rules
      const lenA = a.path.length;
      const lenB = b.path.length;

      if (lenA > lenB) {
        if (HEAD_ON_HEAD_BOOST_WINS && b.boosting && !a.boosting) {
          deadSnakes.add(a.id);
        } else {
          deadSnakes.add(b.id);
        }
      } else if (lenB > lenA) {
        if (HEAD_ON_HEAD_BOOST_WINS && a.boosting && !b.boosting) {
          deadSnakes.add(b.id);
        } else {
          deadSnakes.add(a.id);
        }
      } else {
        deadSnakes.add(a.id);
        deadSnakes.add(b.id);
      }
    }
  }

  // Process deaths
  for (const deadId of deadSnakes) {
    const deadSnake = state.snakes.get(deadId);
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
    const score = BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN);
    const nameIdx = (state.tickCount + i) % BOT_NAMES.length;
    const pos = findSafeSpawn(state.snakes, 0, 0);
    const bot = createSnake(
      `bot-${now}-${i}`, BOT_NAMES[nameIdx], score, pos.x, pos.y, true, now
    );
    state.snakes.set(bot.id, bot);
  }
}

/** Respawn the player snake */
export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;

  const pos = findSafeSpawn(state.snakes, 0, 0);
  const newPlayer = createSnake('player', 'You', 0, pos.x, pos.y, false, Date.now());
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}
