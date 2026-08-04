// ============================================================================
// Game Engine — Pure game logic tick. Mutates state in-place for performance.
// ============================================================================

import type { GameState, InputState, FoodOrb, Snake, Vec2 } from './types';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { getBotTarget } from './bot-ai';
import {
  BASE_SPEED,
  BOOST_SPEED,
  SEGMENT_SPACING,
  START_LENGTH,
  FOOD_COUNT_TARGET,
  FOOD_SPAWN_WEIGHTS,
  FOOD_VALUES,
  FOOD_RADII,
  FOOD_COLORS,
  FOOD_GLOW_COLORS,
  BOOST_DROP_INTERVAL,
  BOOST_MIN_BODY,
  BOOST_MIN_SCORE,
  GROWTH_RATE,
  NECK_PROTECTION,
  SPAWN_PROTECTION_MS,
  SNAKE_RADIUS,
  BOT_COUNT,
  MAX_TURN_RATE,
  BOT_START_SCORE_MIN,
  BOT_START_SCORE_MAX,
  INITIAL_SPAWN_RADIUS,
  FOOD_SPAWN_AREA_RADIUS,
  SAFE_SPAWN_DIST,
  SAFE_SPAWN_ATTEMPTS,
} from './constants';

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
  ['#ef4444', '#f87171'],
  ['#f97316', '#fb923c'],
  ['#eab308', '#facc15'],
  ['#22c55e', '#4ade80'],
  ['#06b6d4', '#22d3ee'],
  ['#8b5cf6', '#a78bfa'],
  ['#ec4899', '#f472b6'],
  ['#f43f5e', '#fb7185'],
  ['#14b8a6', '#2dd4bf'],
  ['#a855f7', '#c084fc'],
];

const FOOD_SIZES: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];

// ==========================================================================
// Reusable spatial hashes (allocated once, cleared each tick)
// ==========================================================================

const foodHash = new SpatialHash();
const bodyHash = new SpatialHash();

// ==========================================================================
// Initialization
// ==========================================================================

/** Create the initial game state */
export function createInitialState(): GameState {
  const state: GameState = {
    snakes: new Map(),
    foods: [],
    player: null,
    nextFoodId: 0,
    showControls: true,
  };

  const now = Date.now();

  // Spawn player
  const player = createSnake('player', 'You', 0, { x: 0, y: 0 }, false, now);
  state.player = player;
  state.snakes.set(player.id, player);

  // Spawn bots with varied sizes
  for (let i = 0; i < BOT_COUNT; i++) {
    const score = BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN);
    const nameIdx = i % BOT_NAMES.length;
    const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
    const pos = findSafeSpawn(state.snakes, 0, 0);
    const bot = createSnake(`bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos, true, now);
    state.snakes.set(bot.id, bot);
  }

  // Spawn initial food
  spawnFoodBatch(state, FOOD_COUNT_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);

  return state;
}

/** Create a single snake with initial segment path */
function createSnake(
  id: string,
  name: string,
  startScore: number,
  pos: Vec2,
  isBot: boolean,
  now: number,
): Snake {
  const targetLength = Math.floor(START_LENGTH + startScore * GROWTH_RATE);
  const palette = SNAKE_PALETTES[Math.floor(Math.random() * SNAKE_PALETTES.length)];
  const angle = Math.random() * Math.PI * 2;

  const segments: Vec2[] = [];
  for (let i = 0; i < targetLength; i++) {
    segments.push({
      x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
      y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }

  return {
    id,
    name,
    segments,
    angle,
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
  };
}

/** Find a safe spawn position away from all other snakes */
function findSafeSpawn(snakes: Map<string, Snake>, nearX: number, nearY: number): Vec2 {
  for (let attempt = 0; attempt < SAFE_SPAWN_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * (INITIAL_SPAWN_RADIUS - 200);
    const x = nearX + Math.cos(angle) * dist;
    const y = nearY + Math.sin(angle) * dist;

    let safe = true;
    const safeDistSq = SAFE_SPAWN_DIST * SAFE_SPAWN_DIST;
    for (const [, snake] of snakes) {
      if (!snake.alive) continue;
      const head = snake.segments[0];
      if (!head) continue;
      const dx = head.x - x;
      const dy = head.y - y;
      if (dx * dx + dy * dy < safeDistSq) {
        safe = false;
        break;
      }
    }
    if (safe) return { x, y };
  }
  const angle = Math.random() * Math.PI * 2;
  return { x: nearX + Math.cos(angle) * INITIAL_SPAWN_RADIUS, y: nearY + Math.sin(angle) * INITIAL_SPAWN_RADIUS };
}

// ==========================================================================
// Main Game Tick
// ==========================================================================

/**
 * Main game tick. Mutates state in-place for performance with 1000 bots.
 */
export function gameTick(state: GameState, input: InputState, _dt: number): void {
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

  // 4. Spawn food to maintain target count
  if (state.foods.length < FOOD_COUNT_TARGET) {
    const deficit = FOOD_COUNT_TARGET - state.foods.length;
    let cx = 0;
    let cy = 0;
    // Spawn near a random alive snake
    const alive: Snake[] = [];
    for (const [, s] of state.snakes) {
      if (s.alive && s.segments[0]) alive.push(s);
    }
    if (alive.length > 0) {
      const rs = alive[Math.floor(Math.random() * alive.length)];
      const h = rs.segments[0];
      cx = h.x;
      cy = h.y;
    }
    spawnFoodBatch(state, Math.min(deficit, 20), cx, cy, FOOD_SPAWN_AREA_RADIUS);
  }

  // 5. Check collisions
  checkCollisions(state, now);
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
  // Smooth turning with angle wrapping
  let diff = targetAngle - snake.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const maxTurn = snake.isBot ? 0.08 : MAX_TURN_RATE;
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
    snake.score > BOOST_MIN_SCORE &&
    snake.segments.length > BOOST_MIN_BODY;

  snake.boosting = canBoost;
  snake.speed = canBoost ? BOOST_SPEED : BASE_SPEED;

  // Move head forward
  const head = snake.segments[0];
  if (!head) return;

  const newHead: Vec2 = {
    x: head.x + Math.cos(snake.angle) * snake.speed,
    y: head.y + Math.sin(snake.angle) * snake.speed,
  };
  snake.segments.unshift(newHead);

  // Target length from score
  const targetLength = Math.floor(START_LENGTH + snake.score * GROWTH_RATE);

  // Boost: drop food from tail, shrink
  if (canBoost && now - snake.lastBoostDrop >= BOOST_DROP_INTERVAL) {
    snake.lastBoostDrop = now;
    const tailIdx = snake.segments.length - 1;
    if (tailIdx > 0) {
      const tail = snake.segments[tailIdx];
      state.foods.push(makeFood(state, tail.x, tail.y, 0)); // small food
      snake.segments.pop(); // extra shrink from boost
    }
  }

  // Trim segments to target length
  while (snake.segments.length > targetLength) {
    snake.segments.pop();
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
  // Build food spatial hash + food lookup map
  foodHash.clear();
  const foodMap = new Map<number, FoodOrb>();
  for (let i = 0; i < state.foods.length; i++) {
    const f = state.foods[i];
    foodHash.insert({ x: f.x, y: f.y, radius: f.radius, id: f.id } as SpatialEntity);
    foodMap.set(f.id, f);
  }

  const eatenIds = new Set<number>();
  const eatRadiusSq = (SNAKE_RADIUS + 10) * (SNAKE_RADIUS + 10);

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const head = snake.segments[0];
    if (!head) continue;

    // Spawn protection: player can't eat food for first 4s
    if (snake.isPlayer && now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = foodHash.query(head.x, head.y, SNAKE_RADIUS + 10);
    for (const entity of nearby) {
      const fid = entity.id as number;
      if (eatenIds.has(fid)) continue;
      const food = foodMap.get(fid);
      if (!food) continue;

      const dx = head.x - food.x;
      const dy = head.y - food.y;
      if (dx * dx + dy * dy <= eatRadiusSq) {
        eatenIds.add(fid);
        snake.score += food.value;
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
  // Build body segment spatial hash with O(1) lookup via Map
  bodyHash.clear();
  // Map from entityKey -> { snakeId }
  const bodySegMap = new Map<string, string>();

  for (const [, snake] of state.snakes) {
    if (!snake.alive) continue;
    const segs = snake.segments;
    for (let i = NECK_PROTECTION; i < segs.length; i++) {
      const seg = segs[i];
      const key = `${snake.id}:${i}`;
      bodySegMap.set(key, snake.id);
      bodyHash.insert({ x: seg.x, y: seg.y, radius: SNAKE_RADIUS, id: key } as SpatialEntity);
    }
  }

  const deadSnakes = new Set<string>();
  const collisionDistSq = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;

  // Head-to-body collision check
  for (const [, snake] of state.snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const head = snake.segments[0];
    if (!head) continue;

    // Spawn protection
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(head.x, head.y, SNAKE_RADIUS * 2);
    for (const entity of nearby) {
      const key = entity.id as string;
      const otherSnakeId = bodySegMap.get(key);
      if (!otherSnakeId || otherSnakeId === snake.id) continue;

      const otherSnake = state.snakes.get(otherSnakeId);
      if (!otherSnake || !otherSnake.alive) continue;

      const dx = head.x - entity.x;
      const dy = head.y - entity.y;
      if (dx * dx + dy * dy <= collisionDistSq) {
        deadSnakes.add(snake.id);
        break;
      }
    }
  }

  // Head-on-head collision check (only among still-alive snakes)
  const aliveArr: Snake[] = [];
  for (const [, s] of state.snakes) {
    if (s.alive && !deadSnakes.has(s.id) && s.segments[0]) {
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

      const hA = a.segments[0]!;
      const hB = b.segments[0]!;
      const dx = hA.x - hB.x;
      const dy = hA.y - hB.y;
      if (dx * dx + dy * dy > collisionDistSq) continue;

      // Head-on-head collision resolved by length + boost rules
      const lenA = a.segments.length;
      const lenB = b.segments.length;

      if (lenA > lenB) {
        // If smaller is boosting and larger is NOT, smaller survives
        if (b.boosting && !a.boosting) {
          deadSnakes.add(a.id);
        } else {
          deadSnakes.add(b.id);
        }
      } else if (lenB > lenA) {
        if (a.boosting && !b.boosting) {
          deadSnakes.add(b.id);
        } else {
          deadSnakes.add(a.id);
        }
      } else {
        // Same length: both die
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

  // Death food formula: L=floor(score/5), rem=score-L*5, M=floor(rem/3), S=rem-M*3
  const score = snake.score;
  const largeCount = Math.floor(score / 5);
  let remainder = score - largeCount * 5;
  const medCount = Math.floor(remainder / 3);
  const smallCount = remainder - medCount * 3;

  const totalFood = largeCount + medCount + smallCount;
  if (totalFood === 0) {
    if (!snake.isPlayer) state.snakes.delete(snake.id);
    return;
  }

  // Distribute food along body path
  const segLen = snake.segments.length;
  const step = Math.max(1, Math.floor(segLen / totalFood));
  let foodIdx = 0;

  for (let i = 0; i < largeCount; i++) {
    const seg = snake.segments[Math.min(foodIdx * step, segLen - 1)];
    if (seg) {
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      state.foods.push({
        id: state.nextFoodId++, x: seg.x + ox, y: seg.y + oy,
        size: 'large', value: 5, radius: 8, color: '#f472b6', glowColor: '#ec4899',
      });
    }
    foodIdx++;
  }
  for (let i = 0; i < medCount; i++) {
    const seg = snake.segments[Math.min(foodIdx * step, segLen - 1)];
    if (seg) {
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      state.foods.push({
        id: state.nextFoodId++, x: seg.x + ox, y: seg.y + oy,
        size: 'medium', value: 3, radius: 5, color: '#38bdf8', glowColor: '#0ea5e9',
      });
    }
    foodIdx++;
  }
  for (let i = 0; i < smallCount; i++) {
    const seg = snake.segments[Math.min(foodIdx * step, segLen - 1)];
    if (seg) {
      const ox = (Math.random() - 0.5) * 20;
      const oy = (Math.random() - 0.5) * 20;
      state.foods.push({
        id: state.nextFoodId++, x: seg.x + ox, y: seg.y + oy,
        size: 'small', value: 1, radius: 3, color: '#34d399', glowColor: '#10b981',
      });
    }
    foodIdx++;
  }

  // Remove from map unless player (kept for respawn)
  if (!snake.isPlayer) state.snakes.delete(snake.id);
}

/** Respawn the player snake */
export function respawnPlayer(state: GameState): void {
  const old = state.player;
  if (old) old.alive = false;

  const pos = findSafeSpawn(state.snakes, 0, 0);
  const newPlayer = createSnake('player', 'You', 0, pos, false, Date.now());
  state.player = newPlayer;
  state.snakes.set(newPlayer.id, newPlayer);
}
