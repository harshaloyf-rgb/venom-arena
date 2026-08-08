// ============================================================================
// Shared Types, Config, and Utilities for the Venom Game Server
// Self-contained — no cross-project imports.
// Copied from src/lib/snake/{types,config,pool,spatial-hash,bot-ai,vec2}.ts
// ============================================================================

// ─── Vec2 Math Utilities ────────────────────────────────────────────────────

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function angleDirect(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type Vec2 = { x: number; y: number };
export type FoodSize = 'small' | 'medium' | 'large';
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface FoodOrb {
  id: number;
  x: number;
  y: number;
  size: FoodSize;
  value: number;
  radius: number;
  color: string;
  glowColor: string;
}

export interface StarChip {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
  glowColor: string;
  color: string;
  spawnTime: number;
}

export interface SpiralTurnState {
  active: boolean;
  startAngle: number;
  theta: number;
  ticksElapsed: number;
  a: number;
  b: number;
  direction: 1 | -1;
}

export interface TurnMetadata {
  tick: number;
  snakeId: string;
  isSpiral: boolean;
  startAngle: number;
  direction: 1 | -1;
  theta: number;
  expectedDuration: number;
}

export interface SnakeSnapshot {
  id: string;
  name: string;
  hx: number;
  hy: number;
  angle: number;
  length: number;
  score: number;
  alive: boolean;
  color: string;
  headColor: string;
  bodyRadius: number;
  boosting: boolean;
  skinId: string;
  rarity: SkinRarity;
  bodyX: Float32Array;
  bodyY: Float32Array;
  bodyLen: number;
  turn?: TurnMetadata;
}

export interface ArenaSnapshot {
  tick: number;
  timestamp: number;
  snakes: SnakeSnapshot[];
  foods: Array<{ id: number; x: number; y: number; size: FoodSize; value: number }>;
  starChips: Array<{ id: number; x: number; y: number; value: number }>;
  extraction: { x: number; y: number; radius: number; active: boolean };
  obstacles: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export interface SpatialEntity {
  x: number;
  y: number;
  radius: number;
  id: number | string;
}

export interface InputState {
  targetAngle: number;
  boosting: boolean;
}

// ─── PathBuffer ─────────────────────────────────────────────────────────────

export interface IPathBuffer {
  readonly length: number;
  getX(i: number): number;
  getY(i: number): number;
  setX(i: number, x: number): void;
  setY(i: number, y: number): void;
  readonly headX: number;
  readonly headY: number;
  readonly tailX: number;
  readonly tailY: number;
  prepend(x: number, y: number): void;
  appendTail(x: number, y: number): void;
  pop(): void;
  clear(): void;
  setLength(n: number): void;
  resetTo(x: number, y: number): void;
  ensureCapacity(needed: number): void;
}

export class PathBuffer implements IPathBuffer {
  data: Float32Array;
  capacity: number;
  length = 0;
  headSegIdx = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * 2);
  }

  prepend(x: number, y: number): void {
    this.headSegIdx = (this.headSegIdx - 1 + this.capacity) % this.capacity;
    const base = this.headSegIdx * 2;
    this.data[base] = x;
    this.data[base + 1] = y;
    if (this.length < this.capacity) this.length++;
  }

  getX(index: number): number {
    if (index < 0 || index >= this.length) return 0;
    return this.data[((this.headSegIdx + index) % this.capacity) * 2];
  }

  getY(index: number): number {
    if (index < 0 || index >= this.length) return 0;
    return this.data[((this.headSegIdx + index) % this.capacity) * 2 + 1];
  }

  get headX(): number {
    return this.data[this.headSegIdx * 2];
  }

  get headY(): number {
    return this.data[this.headSegIdx * 2 + 1];
  }

  get tailX(): number {
    return this.data[((this.headSegIdx + this.length - 1) % this.capacity) * 2];
  }

  get tailY(): number {
    return this.data[((this.headSegIdx + this.length - 1) % this.capacity) * 2 + 1];
  }

  pop(): void {
    if (this.length > 0) this.length--;
  }

  setLength(n: number): void {
    this.length = Math.max(0, Math.min(n, this.capacity));
  }

  setX(index: number, x: number): void {
    if (index < 0 || index >= this.length) return;
    this.data[((this.headSegIdx + index) % this.capacity) * 2] = x;
  }

  setY(index: number, y: number): void {
    if (index < 0 || index >= this.length) return;
    this.data[((this.headSegIdx + index) % this.capacity) * 2 + 1] = y;
  }

  appendTail(x: number, y: number): void {
    if (this.length >= this.capacity) this.grow();
    const physIdx = (this.headSegIdx + this.length) % this.capacity;
    this.data[physIdx * 2] = x;
    this.data[physIdx * 2 + 1] = y;
    this.length++;
  }

  clear(): void {
    this.length = 0;
  }

  resetTo(x: number, y: number): void {
    this.length = 1;
    this.headSegIdx = 0;
    this.data[0] = x;
    this.data[1] = y;
  }

  grow(): void {
    const newCap = this.capacity * 2;
    const newData = new Float32Array(newCap * 2);
    for (let i = 0; i < this.length; i++) {
      const srcBase = ((this.headSegIdx + i) % this.capacity) * 2;
      const dstBase = i * 2;
      newData[dstBase] = this.data[srcBase];
      newData[dstBase + 1] = this.data[srcBase + 1];
    }
    this.data = newData;
    this.capacity = newCap;
    this.headSegIdx = 0;
  }

  ensureCapacity(needed: number): void {
    while (this.capacity < needed) this.grow();
  }
}

// ─── SpatialHash ─────────────────────────────────────────────────────────────

export class SpatialHash {
  private cellSize: number;
  private cells: Map<string, Set<SpatialEntity>>;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  private toCellKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  insert(entity: SpatialEntity): void {
    const r = entity.radius;
    const minCx = Math.floor((entity.x - r) / this.cellSize);
    const maxCx = Math.floor((entity.x + r) / this.cellSize);
    const minCy = Math.floor((entity.y - r) / this.cellSize);
    const maxCy = Math.floor((entity.y + r) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(entity);
      }
    }
  }

  query(x: number, y: number, radius: number): SpatialEntity[] {
    const result: SpatialEntity[] = [];
    const seen = new Set<SpatialEntity>();

    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.toCellKey(cx, cy);
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const entity of cell) {
          if (seen.has(entity)) continue;
          seen.add(entity);

          const dx = entity.x - x;
          const dy = entity.y - y;
          const dSq = dx * dx + dy * dy;
          const maxDist = radius + entity.radius;
          if (dSq <= maxDist * maxDist) {
            result.push(entity);
          }
        }
      }
    }

    return result;
  }

  clear(): void {
    this.cells.clear();
  }

  rebuild(entities: SpatialEntity[]): void {
    this.clear();
    for (let i = 0; i < entities.length; i++) {
      this.insert(entities[i]);
    }
  }
}

// ─── Config Constants ───────────────────────────────────────────────────────

// ARENA
export const ARENA_RADIUS = 5000;
export const ARENA_BOUNDARY_MARGIN = 200;

// MOVEMENT
export const BASE_SPEED = 4.5;
export const BOOST_SPEED = 8.0;
export const MAX_TURN_RATE = Math.PI / 15; // U-turn in 0.25s
export const SEGMENT_SPACING = 8;
export const LENGTH_PER_SCORE = 5; // 1 segment per 5 score points
export const START_LENGTH = 15;
// MAX_SNAKE_LENGTH removed — length grows linearly without cap
export const BOOST_SHRINK_RATE = 1;

// FOOD
export const FOOD_COUNT_TARGET = 1200;
export const FOOD_SPAWN_WEIGHTS: [number, number, number] = [0.93, 0.04, 0.03];
export const FOOD_VALUES: [number, number, number] = [1, 2, 5];
export const FOOD_RADII: [number, number, number] = [3, 5, 8];
export const FOOD_COLORS: [string, string, string] = ['#34d399', '#38bdf8', '#f472b6'];
export const FOOD_GLOW_COLORS: [string, string, string] = ['#10b981', '#0ea5e9', '#ec4899'];
export const FOOD_SPAWN_AREA_RADIUS = 3000;
export const INITIAL_SPAWN_RADIUS = 3000;
export const FOOD_RESPAWN_BATCH = 25;

// COLLISION
export const SNAKE_RADIUS = 8;
export const SNAKE_RADIUS_MIN = 6;
export const SNAKE_RADIUS_GROWTH_RATE = 3 / Math.LN4; // ≈ 2.164
export const SNAKE_RADIUS_GROWTH_OFFSET = 100 / 3; // ≈ 33.333
export const NECK_PROTECTION = 5;
export const SPAWN_PROTECTION_MS = 4000;
export const HEAD_ON_HEAD_BOOST_WINS = true;
export const DEATH_FOOD_LARGE_DIVISOR = 5;
export const DEATH_FOOD_MEDIUM_DIVISOR = 3;
export const SPATIAL_CELL_SIZE = 100;

// BOOST
export const BOOST_DROP_INTERVAL = 333;
export const BOOST_MIN_BODY = 8;
export const BOOST_MIN_SCORE = 20;

// BOT
export const BOT_COUNT = 1000;
export const BOT_START_SCORE_MIN = 10;
export const BOT_START_SCORE_MAX = 80;
export const BOT_MAX_TURN_RATE = Math.PI * 0.08;
export const BOT_FOOD_SCAN_RADIUS = 300;
export const BOT_EVADE_RADIUS = 300;
export const BOT_PREDICT_TICKS = 8;
export const BOT_WANDER_RATE = 0.05;

// SPAWN
export const SAFE_SPAWN_DIST = 500;
export const SAFE_SPAWN_ATTEMPTS = 30;

// SPIRAL_TURN
export const TIGHT_TURN_THRESHOLD = 0.5;
export const SPIRAL_DETECT_WINDOW = 5;
export const MAX_SPIRAL_ANGLE_DELTA = 0.15;
export const SPIRAL_A = 1.0;
export const SPIRAL_B = 0.05;

// SNAPSHOT
export const BODY_DOWNSAMPLE_INTERVAL = 3;
export const FOOD_DOWNSAMPLE_RADIUS = 500;
export const MAX_SNAKES_PER_SNAPSHOT = 100;

// EXTRACTION
export const EXTRACTION_ZONE_RADIUS = 800;
export const EXTRACTION_SCORE_THRESHOLD = 50;
export const EXTRACTION_SPEED_BONUS = 1.5;
export const STAR_CHIP_VALUE = 10;
export const STAR_CHIP_SPAWN_INTERVAL = 5000;
export const STAR_CHIP_RADIUS = 12;
export const STAR_CHIP_GLOW = '#fbbf24';
export const STAR_CHIP_COLORS: string[] = [
  '#fbbf24', '#f59e0b', '#d97706', '#eab308', '#facc15',
];
export const EXTRACTION_ZONE_DURATION = 60000;
export const EXTRACTION_ZONE_SPAWN_INTERVAL = 120000;

// ─── Bot AI ─────────────────────────────────────────────────────────────────

/** ServerSnake interface used by bot AI */
export interface ServerSnake {
  id: string;
  path: IPathBuffer;
  angle: number;
  score: number;
  alive: boolean;
  isBot: boolean;
}

function smoothTurn(currentAngle: number, targetAngle: number, maxRate: number): number {
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxRate) return targetAngle;
  return currentAngle + Math.sign(diff) * maxRate;
}

export function getBotTarget(
  bot: ServerSnake,
  allSnakes: Map<string, ServerSnake>,
  foods: FoodOrb[],
): number {
  const hx = bot.path.headX;
  const hy = bot.path.headY;
  if (bot.path.length === 0) return bot.angle;

  // Phase 1: Evade nearby snake bodies
  let evadeAngle: number | null = null;
  let closestBodyDist = BOT_EVADE_RADIUS + 1;
  const evadeRsq = BOT_EVADE_RADIUS * BOT_EVADE_RADIUS;
  const evadeR1_5sq = (BOT_EVADE_RADIUS * 1.5) * (BOT_EVADE_RADIUS * 1.5);

  for (const [, other] of allSnakes) {
    if (other.id === bot.id || !other.alive) continue;

    const ohx = other.path.headX;
    const ohy = other.path.headY;

    const headDistSq = distSq(hx, hy, ohx, ohy);
    if (headDistSq > evadeR1_5sq) continue;

    const segLen = other.path.length;
    for (let i = 0; i < segLen; i++) {
      const sx = other.path.getX(i);
      const sy = other.path.getY(i);
      const dSq = distSq(hx, hy, sx, sy);
      if (dSq < closestBodyDist * closestBodyDist) {
        closestBodyDist = Math.sqrt(dSq);
        evadeAngle = angleDirect(sx, sy, hx, hy);
      }
    }

    if (headDistSq < evadeRsq) {
      const futureX = ohx + Math.cos(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureY = ohy + Math.sin(other.angle) * BASE_SPEED * BOT_PREDICT_TICKS;
      const futureDistSq = distSq(hx, hy, futureX, futureY);
      const killRadiusSq = (SNAKE_RADIUS * 4) * (SNAKE_RADIUS * 4);
      if (futureDistSq < killRadiusSq) {
        evadeAngle = angleDirect(futureX, futureY, hx, hy);
      }
    }
  }

  if (evadeAngle !== null && closestBodyDist < BOT_EVADE_RADIUS) {
    return smoothTurn(bot.angle, evadeAngle, BOT_MAX_TURN_RATE * 1.5);
  }

  // Phase 2: Find nearest food
  let nearestFood: FoodOrb | null = null;
  let nearestFoodDistSq = (BOT_FOOD_SCAN_RADIUS + 1) * (BOT_FOOD_SCAN_RADIUS + 1);
  const scanSq = BOT_FOOD_SCAN_RADIUS * BOT_FOOD_SCAN_RADIUS;

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const dSq = distSq(hx, hy, food.x, food.y);
    if (dSq < nearestFoodDistSq) {
      nearestFoodDistSq = dSq;
      nearestFood = food;
    }
  }

  if (nearestFood && nearestFoodDistSq < scanSq) {
    const foodAngle = angleDirect(hx, hy, nearestFood.x, nearestFood.y);
    return smoothTurn(bot.angle, foodAngle, BOT_MAX_TURN_RATE);
  }

  // Phase 3: Wander
  return smoothTurn(bot.angle, bot.angle + (Math.random() - 0.5) * BOT_WANDER_RATE, BOT_MAX_TURN_RATE * 0.5);
}

// Re-export for use in game-state.ts
export { distSq, angleDirect };

/** Compute visual body radius from score using logarithmic growth curve.
 *  Score 0→6  |  100→9  |  500→12  |  1K→13.4  |  10K→18.4  |  100K→23.3  |  300K→25.7 */
export function computeBodyRadius(score: number): number {
  return SNAKE_RADIUS_MIN + SNAKE_RADIUS_GROWTH_RATE * Math.log(1 + score / SNAKE_RADIUS_GROWTH_OFFSET);
}
