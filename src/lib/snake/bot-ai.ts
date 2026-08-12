// ============================================================================
// Bot AI v2 — Slither-style intelligent bots
// ============================================================================
// Core principle: Head hits body = death.
//   - Bot head must NEVER touch any body (survival)
//   - Bot body should be placed where other heads will go (kill)
//
// Architecture (3 layers, every tick):
//   Layer 1: Universal Survival — body-ahead scanner, head-on avoid, wall avoid
//   Layer 2: Smooth Steering — per-type lerp, no jitter
//   Layer 3: Type Personality — kill strategy, food priority
//
// PERFORMANCE: food scans capped at MAX_FOOD_SAMPLE. Body scanner only
// checks nearby snakes. No O(bots × total_segments) full scans.
// ============================================================================

import type { GameState, Snake, FoodOrb, ArenaConfig } from './types';
import { BASE_SPEED, SPAWN_RADIUS, computeBodyRadius, computeBodyLength, SEGMENT_SPACING } from './config';
import { SpatialHash, type SpatialEntity } from './spatial-hash';

// ─── Bot Types ──────────────────────────────────────────────────────────────

export type BotType = 'predator' | 'coiler' | 'baiter' | 'interceptor' | 'grazer' | 'trapper' | 'ranked';

/** Color palette per bot type: [bodyColor, headColor] */
export const BOT_TYPE_COLORS: Record<BotType, [string, string]> = {
  predator:    ['#ef4444', '#fca5a5'],
  coiler:      ['#f97316', '#fdba74'],
  baiter:      ['#eab308', '#fde047'],
  interceptor: ['#06b6d4', '#67e8f9'],
  grazer:      ['#22c55e', '#86efac'],
  trapper:     ['#8b5cf6', '#c4b5fd'],
  ranked:      ['#f59e0b', '#fbbf24'],
};

// ─── Bot Names ──────────────────────────────────────────────────────────────

const BOT_NAMES: Record<BotType, string[]> = {
  predator:    ['Viper', 'Cobra', 'Mamba', 'Taipan', 'Adder', 'Krait', 'Fang', 'Striker'],
  coiler:      ['Python', 'Anaconda', 'Constrictor', 'Squeeze', 'Crush', 'Bind', 'Wrap', 'Coil'],
  baiter:      ['Shadow', 'Phantom', 'Lurk', 'Mirage', 'Decoy', 'Trick', 'Lure', 'Snare'],
  interceptor: ['Falcon', 'Hawk', 'Eagle', 'Raptor', 'Strike', 'Blitz', 'Flash', 'Dash'],
  grazer:      ['Nibbles', 'Munch', 'Grazer', 'Harvest', 'Bloom', 'Sprout', 'Clover', 'Meadow'],
  trapper:     ['Web', 'Net', 'Cage', 'Trap', 'Fort', 'Wall', 'Barricade', 'Fence'],
  ranked:      ['Apex', 'Titan', 'Phantom X', 'Nemesis', 'Warden', 'Oracle', 'Sovereign', 'Sentinel', 'Vanguard', 'Champion'],
};

// ─── Bot Spawn Mix ──────────────────────────────────────────────────────────

export interface BotSpawnConfig {
  predator: number; coiler: number; baiter: number;
  interceptor: number; grazer: number; trapper: number;
  ranked: number;
}

/** Default mix: 989 regular bots + 10 ranked = 999 bots + 1 player = 1000 entities
 *  Types scaled proportionally: grazers dominate (peaceful), trappers & predators are aggressive minority.
 *  Predator(160) Coiler(80) Baiter(120) Interceptor(120) Grazer(270) Trapper(239) Ranked(10) = 999 */
export const DEFAULT_BOT_MIX: BotSpawnConfig = {
  predator: 160, coiler: 80, baiter: 120, interceptor: 120, grazer: 270, trapper: 239, ranked: 10,
};

// ─── Performance Constants ───────────────────────────────────────────────────

const MAX_FOOD_SAMPLE = 120;
const MAX_CLUSTER_SAMPLE = 150;

// ─── Ranges (defaults for easy arena — overridden per-arena via state.arenaConfig) ──

const DEFAULT_SIGHT_RANGE_SQ = 900 * 900;
const DEFAULT_FOOD_SEEK_RANGE_SQ = 1200 * 1200;
const CLUSTER_RANGE = 500;
const DEFAULT_WALL_BOUNDARY = SPAWN_RADIUS;
const DEFAULT_RETARGET_INTERVAL = 60;

// ─── Collision Avoidance Config ────────────────────────────────────────────
/** Personal space range — bots start repelling at this distance */
const PS_RANGE = 300;
const PS_RANGE_SQ = PS_RANGE * PS_RANGE;
/** Strong avoidance range — harder push within this distance */
const PS_STRONG = 120;
const PS_STRONG_SQ = PS_STRONG * PS_STRONG;
/** Default player flee range (overridden per-arena) */
const DEFAULT_PLAYER_FLEE_RANGE_SQ = 350 * 350;
/** Body proximity avoidance — steer away from any body segment within this range */
const BODY_AVOID_RANGE = 120;
const BODY_AVOID_RANGE_SQ = BODY_AVOID_RANGE * BODY_AVOID_RANGE;

// ─── Body Scanner Config (defaults — overridden per-arena) ─────────────────

const DEFAULT_BODY_SCAN_DIST = 180;       // px ahead to scan for body threats
const BODY_SCAN_CONE = Math.PI * 0.45; // 81° half-cone
const DEFAULT_HEAD_ON_RANGE = 250;        // px to detect head-on approach

// ─── Active Arena Config (set at the start of updateAllBotAI) ─────────────
// Type updaters and helper functions read from this instead of module constants.
let _ac: ArenaConfig | null = null;
function ac(): ArenaConfig {
  return _ac!;
}
// ─── Per-Type Food Aggression ───────────────────────────────────────────────
/** How aggressively the type chases food vs holds its heading.
 *  0 = pure forward (no food pull), 1 = full food chase */
const FOOD_AGRESSION: Record<BotType, number> = {
  predator: 0.4,
  coiler: 0.3,
  baiter: 0.5,
  interceptor: 0.4,
  grazer: 0.7,
  trapper: 0.3,
  ranked: 0.6,
};

// ─── Bot AI State ────────────────────────────────────────────────────────────

interface PredatorState {
  targetId: string | null;
  phase: 'seek' | 'approach' | 'cut' | 'cooldown';
  phaseTimer: number;
  cutDir: 1 | -1;
}

interface CoilerState {
  targetId: string | null;
  orbitDir: 1 | -1;
  orbitRadius: number;
  ticksOrbiting: number;
}

interface BaiterState {
  chaserId: string | null;
  chaseTicks: number;
  cooldown: number;
}

interface InterceptorState {
  watchId: string | null;
  prevAngle: number;
  angleChange: number;
  watchTicks: number;
  strikeCooldown: number;
}

interface TrapperState {
  centerX: number;
  centerY: number;
  arcAngle: number;
  arcDir: 1 | -1;
  arcRadius: number;
  arcProgress: number;
}

interface RankedState {
  /** This bot's rank (1-10) — determines score tier and spacing */
  rank: number;
  /** Desired home sector angle (radians) — spread bots around the map */
  homeAngle: number;
  /** Home orbit radius from center */
  homeRadius: number;
  /** Wandering within home sector */
  sectorWanderAngle: number;
  sectorWanderTimer: number;
}

interface BodyThreat {
  avoidAngle: number;
  severity: number; // 0 (far) → 1 (touching)
}

interface BotAIData {
  type: BotType;
  targetAngle: number;   // smoothed output → snake.targetAngle
  wantBoost: boolean;
  retargetTimer: number;
  wanderAngle: number;
  wanderChangeTimer: number;
  predator?: PredatorState;
  coiler?: CoilerState;
  baiter?: BaiterState;
  interceptor?: InterceptorState;
  trapper?: TrapperState;
  ranked?: RankedState;
}

// ─── Module-level State ─────────────────────────────────────────────────────

const botStates = new Map<string, BotAIData>();

function getBotData(snakeId: string): BotAIData | undefined {
  return botStates.get(snakeId);
}
function setBotData(snakeId: string, data: BotAIData): void {
  botStates.set(snakeId, data);
}
function removeBotData(snakeId: string): void {
  botStates.delete(snakeId);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1; const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Signed shortest angle difference from a to b, in [-PI, PI] */
function angleDiff(a: number, b: number): number {
  return normalizeAngle(b - a);
}

// ─── Food Scanning (unchanged from v1) ──────────────────────────────────────

const _sampleBuf: FoodOrb[] = [];
function sampleFood(foods: FoodOrb[], maxCount: number): FoodOrb[] {
  const len = foods.length;
  if (len <= maxCount) return foods;
  const buf = _sampleBuf;
  if (buf.length < maxCount) {
    for (let i = buf.length; i < maxCount; i++) buf.push(foods[0]);
  }
  for (let i = 0; i < maxCount; i++) {
    buf[i] = foods[(Math.random() * len) | 0];
  }
  return buf;
}

function findNearestFood(
  hx: number, hy: number, foods: FoodOrb[], maxDistSq: number,
): { x: number; y: number; distSq: number } | null {
  const sampled = sampleFood(foods, MAX_FOOD_SAMPLE);
  let best: { x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < sampled.length; i++) {
    const f = sampled[i];
    const dSq = distSq(hx, hy, f.x, f.y);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { x: f.x, y: f.y, distSq: dSq };
    }
  }
  return best;
}

function findFoodCluster(
  hx: number, hy: number, foods: FoodOrb[], radius: number,
): { x: number; y: number } | null {
  const sampled = sampleFood(foods, MAX_CLUSTER_SAMPLE);
  const rSq = radius * radius;
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < sampled.length; i++) {
    const f = sampled[i];
    if (distSq(hx, hy, f.x, f.y) < rSq) {
      sumX += f.x; sumY += f.y; count++;
    }
  }
  if (count < 3) return null;
  return { x: sumX / count, y: sumY / count };
}

// ─── Snake Scanning ─────────────────────────────────────────────────────────

function findNearestSnake(
  snake: Snake, snakes: Map<string, Snake>, maxDistSq: number, headHash: SpatialHash,
): { id: string; x: number; y: number; score: number; distSq: number; angle: number } | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const maxDist = Math.sqrt(maxDistSq);
  const nearby = headHash.query(hx, hy, maxDist);
  let best: { id: string; x: number; y: number; score: number; distSq: number; angle: number } | null = null;
  for (let i = 0; i < nearby.length; i++) {
    const s = nearby[i];
    const id = s.id as string;
    if (id === snake.id) continue;
    const other = snakes.get(id);
    if (!other || !other.alive) continue;
    const dSq = distSq(hx, hy, s.x, s.y);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { id, x: s.x, y: s.y, score: other.score, distSq: dSq, angle: other.angle };
    }
  }
  return best;
}

// ============================================================================
// SHARED SYSTEM 1: Body-Ahead Scanner
// ============================================================================
// Scans forward along the bot's movement direction for body segments.
// Only checks snakes whose heads are within 2× scan distance (quick reject).
// Checks every 2nd body point for performance.

function scanBodyAhead(
  snake: Snake,
  snakes: Map<string, Snake>,
  headHash: SpatialHash,
  scanDist = DEFAULT_BODY_SCAN_DIST,
  scanCone = BODY_SCAN_CONE,
): BodyThreat | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const myAngle = snake.angle;
  const scanDistSq = scanDist * scanDist;
  const headRange = scanDist * 2.5;

  // P1 OPTIMIZATION: Use spatial hash instead of O(n) full snake iteration.
  // With 999 bots on a 58K×58K map, PS_RANGE=300, cell=100px, each query
  // returns ~3-8 neighbors instead of scanning all 999 snakes.
  // Total: 999 × ~6 = 6K iterations instead of 999 × 999 = 1M.
  type SnakeDist = { snake: Snake; distSq: number };
  const nearby: SnakeDist[] = [];
  const heads = headHash.query(hx, hy, headRange);
  for (let hi = 0; hi < heads.length; hi++) {
    const h = heads[hi];
    const otherId = h.id as string;
    if (otherId === snake.id) continue;
    const other = snakes.get(otherId);
    if (!other || !other.alive) continue;
    const dx = h.x - hx;
    const dy = h.y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq <= headRange * headRange) nearby.push({ snake: other, distSq: dSq });
  }
  // Sort by head distance, keep only 3 nearest
  nearby.sort((a, b) => a.distSq - b.distSq);
  const scanList = nearby.length > 3 ? nearby.slice(0, 3) : nearby;

  let closestDist = scanDist + 1;
  let closestFleeAngle = 0;

  for (const { snake: other } of scanList) {
    const len = other.path.length;
    // Check every 2nd body point (6px spacing at BASE_SPEED=3)
    for (let i = 2; i < len; i += 2) {
      const bx = other.path.getX(i);
      const by = other.path.getY(i);
      const dx = bx - hx;
      const dy = by - hy;
      const dSq = dx * dx + dy * dy;

      if (dSq > scanDistSq || dSq < 1) continue;

      // Is this point in my forward cone?
      const angleToPoint = Math.atan2(dy, dx);
      const aDiff = Math.abs(normalizeAngle(angleToPoint - myAngle));
      if (aDiff > scanCone) continue;

      const d = Math.sqrt(dSq);
      if (d < closestDist) {
        closestDist = d;
        // Flee: steer away from the body point
        closestFleeAngle = Math.atan2(-dy, -dx);
      }
    }
  }

  if (closestDist > scanDist) return null;

  return {
    avoidAngle: closestFleeAngle,
    severity: Math.max(0, 1 - closestDist / scanDist),
  };
}

// ============================================================================
// SHARED SYSTEM 2: Head-On Avoidance
// ============================================================================
// Detects heads approaching head-on (both moving toward each other).
// Steers perpendicular to avoid.

function checkHeadOnThreat(
  snake: Snake,
  snakes: Map<string, Snake>,
  headHash: SpatialHash,
): BodyThreat | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const myVx = Math.cos(snake.angle) * snake.speed;
  const myVy = Math.sin(snake.angle) * snake.speed;
  const rangeSq = ac().headOnRange * ac().headOnRange;

  let bestThreat: BodyThreat | null = null;

  // P1 OPTIMIZATION: Use spatial hash instead of O(n) full iteration.
  const heads = headHash.query(hx, hy, ac().headOnRange);
  for (let hi = 0; hi < heads.length; hi++) {
    const h = heads[hi];
    const otherId = h.id as string;
    if (otherId === snake.id) continue;
    const other = snakes.get(otherId);
    if (!other || !other.alive) continue;

    const dx = h.x - hx;
    const dy = h.y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq > rangeSq || dSq < 1) continue;

    const d = Math.sqrt(dSq);

    // Are we converging? Check relative velocity toward each other.
    const ovx = Math.cos(other.angle) * other.speed;
    const ovy = Math.sin(other.angle) * other.speed;
    const relVx = myVx - ovx;
    const relVy = myVy - ovy;
    const approachSpeed = (relVx * dx + relVy * dy) / d;
    if (approachSpeed < BASE_SPEED * 0.5) continue; // Not converging fast enough

    // Is the other head roughly ahead of me? (within 60°)
    const angleToThem = Math.atan2(dy, dx);
    const aDiff = Math.abs(normalizeAngle(angleToThem - snake.angle));
    if (aDiff > Math.PI / 3) continue;

    const severity = 1 - (d / ac().headOnRange);
    if (!bestThreat || severity > bestThreat.severity) {
      // Steer perpendicular — pick the side requiring less turn
      const perpLeft = normalizeAngle(angleToThem + Math.PI / 2);
      const perpRight = normalizeAngle(angleToThem - Math.PI / 2);
      const diffL = Math.abs(normalizeAngle(perpLeft - snake.angle));
      const diffR = Math.abs(normalizeAngle(perpRight - snake.angle));
      bestThreat = { avoidAngle: diffL < diffR ? perpLeft : perpRight, severity };
    }
  }

  return bestThreat;
}

// ============================================================================
// SHARED SYSTEM 3: Wall Avoidance (distance-proportional)
// ============================================================================
// Blend ramps from 5% at 600px margin to 90% at wall edge.
// No more flat 50/50 fighting near boundaries.

function wallAvoidAngle(x: number, y: number, currentAngle: number, boundary: number): number {
  const margin = 1500; // larger margin for 29000px map
  let steerX = 0, steerY = 0;
  let maxPenetration = 0;

  if (x > boundary - margin) { const p = (x - (boundary - margin)) / margin; maxPenetration = Math.max(maxPenetration, p); steerX -= 1; }
  if (x < -boundary + margin) { const p = ((-boundary + margin) - x) / margin; maxPenetration = Math.max(maxPenetration, p); steerX += 1; }
  if (y > boundary - margin) { const p = (y - (boundary - margin)) / margin; maxPenetration = Math.max(maxPenetration, p); steerY -= 1; }
  if (y < -boundary + margin) { const p = ((-boundary + margin) - y) / margin; maxPenetration = Math.max(maxPenetration, p); steerY += 1; }

  if (steerX === 0 && steerY === 0) return currentAngle;

  // Blend: 0.05 at edge of margin → 0.9 at wall
  const blend = 0.05 + 0.85 * Math.min(maxPenetration, 1);
  const avoidAngle = Math.atan2(steerY, steerX);
  return normalizeAngle(currentAngle * (1 - blend) + avoidAngle * blend);
}

// ============================================================================
// SHARED SYSTEM 4: Forward-Biased Steering
// ============================================================================
// No bot-level lerp — engine's STEERING_LERP handles all smoothing.
// Blends 60% current heading + 40% desired direction so bots hold their line
// like real players instead of instantly snapping to new targets.

function steerToward(data: BotAIData, desiredAngle: number, bias = 0.6): void {
  // P0 FIX #3: Dampen target angle changes to prevent snap turns.
  // Don't allow more than ~15° (0.26 rad) of target angle change per AI tick.
  // This makes bots curve smoothly toward threats instead of snapping.
  const MAX_TARGET_CHANGE = 0.26; // ~15 degrees
  let newAngle = normalizeAngle(
    data.targetAngle * bias + desiredAngle * (1 - bias),
  );
  let diff = newAngle - data.targetAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest path
   if (Math.abs(diff) > MAX_TARGET_CHANGE) {
    newAngle = data.targetAngle + Math.sign(diff) * MAX_TARGET_CHANGE;
  }
  data.targetAngle = newAngle;
}

/** Same as steerToward but with per-type food aggression bias */
function steerToFoodBias(data: BotAIData, desiredAngle: number, type: BotType): void {
  // P0 FIX #3: Same 15° dampening as steerToward
  const MAX_TARGET_CHANGE = 0.26;
  const foodBias = 1.0 - FOOD_AGRESSION[type] * 0.5;
  let newAngle = normalizeAngle(
    data.targetAngle * foodBias + desiredAngle * (1 - foodBias),
  );
  let diff = newAngle - data.targetAngle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) > MAX_TARGET_CHANGE) {
    newAngle = data.targetAngle + Math.sign(diff) * MAX_TARGET_CHANGE;
  }
  data.targetAngle = newAngle;
}

// ─── Shared: Set angle to food or wander ────────────────────────────────────

function steerToFood(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
  if (cluster) {
    steerToFoodBias(data, angleTo(hx, hy, cluster.x, cluster.y), data.type);
  } else {
    const food = findNearestFood(hx, hy, state.foods, ac().foodSeekRangeSq);
    steerToFoodBias(data, food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle, data.type);
  }
  data.wantBoost = false;
}

function steerToWander(data: BotAIData, snake: Snake): void {
  if (data.wanderChangeTimer <= 0) {
    // ±0.15 rad (±8.6°) gentle drift — not the old ±0.6 rad jerks
    data.wanderAngle += (Math.random() - 0.5) * 0.3;
    data.wanderChangeTimer = 120 + Math.floor(Math.random() * 240);
  }
  steerToward(data, data.wanderAngle);
  data.wantBoost = false;
}

// ============================================================================
// TYPE 1: PREDATOR — Race ahead, cut across path
// ============================================================================
// Phases: seek → approach → cut → cooldown

function updatePredator(snake: Snake, data: BotAIData, state: GameState): void {
  const ps = data.predator!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // ── COOLDOWN: eat food, don't chase ──
  if (ps.phase === 'cooldown') {
    ps.phaseTimer--;
    if (ps.phaseTimer <= 0) ps.phase = 'seek';
    steerToFood(snake, data, state);
    return;
  }

  // ── SEEK: find a target ──
  if (ps.phase === 'seek') {
    if (data.retargetTimer > 0) { data.retargetTimer--; steerToFood(snake, data, state); return; }
    data.retargetTimer = ac().retargetInterval;
    // Prefer targeting the player
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, score: state.player.score, distSq: 0, angle: state.player.angle } : null;
    if (!target) {
      target = findNearestSnake(snake, state.snakes, ac().sightRangeSq, _aiHeadHash);
    }
    if (!target || target.id === snake.id) { steerToFood(snake, data, state); return; }
    ps.targetId = target.id;
    ps.phase = 'approach';
    ps.phaseTimer = 0;
    return;
  }

  // ── APPROACH: get ahead of target's predicted path ──
  if (ps.phase === 'approach') {
    const target = state.snakes.get(ps.targetId!);
    if (!target || !target.alive) { ps.phase = 'seek'; data.retargetTimer = 10; return; }

    // Predict where target will be
    const predictTicks = 45;
    const futureX = target.path.headX + Math.cos(target.angle) * BASE_SPEED * predictTicks;
    const futureY = target.path.headY + Math.sin(target.angle) * BASE_SPEED * predictTicks;
    // Aim well ahead of the predicted position
    const aimX = futureX + Math.cos(target.angle) * 120;
    const aimY = futureY + Math.sin(target.angle) * 120;

    // Am I ahead of the target?
    const toBotX = hx - target.path.headX;
    const toBotY = hy - target.path.headY;
    const tvx = Math.cos(target.angle);
    const tvy = Math.sin(target.angle);
    const aheadness = toBotX * tvx + toBotY * tvy; // positive = ahead
    const perpDist = Math.abs(toBotX * tvy - toBotY * tvx);

    if (aheadness > 30 && perpDist < 200) {
      // Ahead enough — start cutting
      ps.phase = 'cut';
      ps.phaseTimer = 0;
      // Pick cut direction: whichever side requires less turning
      const cutLeft = normalizeAngle(target.angle + Math.PI / 2);
      const cutRight = normalizeAngle(target.angle - Math.PI / 2);
      ps.cutDir = Math.abs(normalizeAngle(cutLeft - snake.angle)) < Math.abs(normalizeAngle(cutRight - snake.angle)) ? 1 : -1;
      return;
    }

    // Steer toward aim point
    steerToward(data, angleTo(hx, hy, aimX, aimY));
    data.wantBoost = aheadness < 0; // boost only if behind
    ps.phaseTimer++;

    // Timeout — give up and cooldown
    if (ps.phaseTimer > 200) { ps.phase = 'cooldown'; ps.phaseTimer = 120; }
    return;
  }

  // ── CUT: turn perpendicular across target's path ──
  if (ps.phase === 'cut') {
    const target = state.snakes.get(ps.targetId!);
    if (!target || !target.alive) { ps.phase = 'cooldown'; ps.phaseTimer = 90; return; }

    const cutAngle = normalizeAngle(target.angle + ps.cutDir * Math.PI * 0.55);
    steerToward(data, cutAngle);
    data.wantBoost = true;
    ps.phaseTimer++;

    if (ps.phaseTimer > 35) { ps.phase = 'cooldown'; ps.phaseTimer = 120; }
    return;
  }
}

// ============================================================================
// TYPE 2: COILER — Circle target, tighten the noose
// ============================================================================

function updateCoiler(snake: Snake, data: BotAIData, state: GameState): void {
  const cs = data.coiler!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Find or validate target
  if (data.retargetTimer <= 0) {
    data.retargetTimer = ac().retargetInterval * 2;
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, distSq: 0, score: state.player.score, angle: state.player.angle } : null;
    if (!target) target = findNearestSnake(snake, state.snakes, ac().sightRangeSq, _aiHeadHash);
    if (target && target.id !== snake.id) {
      cs.targetId = target.id;
      cs.orbitDir = Math.random() < 0.5 ? 1 : -1;
      cs.orbitRadius = 200 + Math.random() * 100;
      cs.ticksOrbiting = 0;
    } else {
      cs.targetId = null;
    }
  }

  if (!cs.targetId) { steerToFood(snake, data, state); return; }

  const target = state.snakes.get(cs.targetId);
  if (!target || !target.alive) { cs.targetId = null; steerToFood(snake, data, state); return; }

  const tx = target.path.headX;
  const ty = target.path.headY;
  const d = Math.sqrt(distSq(hx, hy, tx, ty));

  // If too far, close in first
  if (d > cs.orbitRadius * 1.5) {
    steerToward(data, angleTo(hx, hy, tx, ty));
    data.wantBoost = d > cs.orbitRadius * 2;
    return;
  }

  // Orbit: steer perpendicular to direction-to-target
  const angleToTarget = angleTo(hx, hy, tx, ty);
  const orbitAngle = normalizeAngle(angleToTarget + cs.orbitDir * Math.PI / 2);
  steerToward(data, orbitAngle);
  data.wantBoost = false;

  cs.ticksOrbiting++;
  // Gradually tighten (reduce radius by 0.5px per tick, min 60px)
  if (cs.orbitRadius > 60) cs.orbitRadius -= 0.5;

  // If target escaped far, reset
  if (d > 500) { cs.targetId = null; }
}

// ============================================================================
// TYPE 3: BAITER — Fake flee, then cut across when chaser commits
// ============================================================================

function updateBaiter(snake: Snake, data: BotAIData, state: GameState): void {
  const bs = data.baiter!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const tailAngle = normalizeAngle(snake.angle + Math.PI); // behind me

  // Cooldown
  if (bs.cooldown > 0) {
    bs.cooldown--;
    bs.chaserId = null;
    bs.chaseTicks = 0;
    steerToFood(snake, data, state);
    return;
  }

  // P1 FIX #4: Use spatial hash instead of iterating ALL snakes (O(N) → O(k)).
  // Only check snakes within 400px — same as the distance filter below.
  let chaserDist = Infinity;
  let chaserId: string | null = null;
  let chaserAngle = 0;
  const nearby = _aiHeadHash.query(hx, hy, 400);
  for (let ni = 0; ni < nearby.length; ni++) {
    const otherId = nearby[ni].id as string;
    if (otherId === snake.id) continue;
    const other = state.snakes.get(otherId);
    if (!other || !other.alive) continue;

    const dx = nearby[ni].x - hx;
    const dy = nearby[ni].y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq > 400 * 400) continue;

    // Is this snake behind me? (within 60° of my tail direction)
    const angleToOther = Math.atan2(dy, dx);
    const aDiff = Math.abs(normalizeAngle(angleToOther - tailAngle));
    if (aDiff > Math.PI / 3) continue;

    // Is it approaching?
    const relVx = Math.cos(other.angle) * other.speed - Math.cos(snake.angle) * snake.speed;
    const relVy = Math.sin(other.angle) * other.speed - Math.sin(snake.angle) * snake.speed;
    const approachSpeed = (relVx * dx + relVy * dy) / Math.sqrt(dSq);
    if (approachSpeed < BASE_SPEED * 0.3) continue;

    const d = Math.sqrt(dSq);
    if (d < chaserDist) {
      chaserDist = d;
      chaserId = otherId;
      chaserAngle = angleToOther;
    }
  }

  if (chaserId && chaserId === bs.chaserId) {
    bs.chaseTicks++;
  } else if (chaserId) {
    bs.chaserId = chaserId;
    bs.chaseTicks = 0;
  } else {
    bs.chaserId = null;
    bs.chaseTicks = 0;
  }

  // After 120+ ticks of being chased, CUT!
  if (bs.chaseTicks > 120) {
    // Cut across the chaser's path
    const chaser = state.snakes.get(bs.chaserId);
    if (chaser && chaser.alive) {
      const cutLeft = normalizeAngle(chaser.angle + Math.PI / 2);
      const cutRight = normalizeAngle(chaser.angle - Math.PI / 2);
      const cutAngle = Math.abs(normalizeAngle(cutLeft - snake.angle)) < Math.abs(normalizeAngle(cutRight - snake.angle))
        ? cutLeft : cutRight;
      steerToward(data, cutAngle);
      data.wantBoost = true;
    } else {
      steerToFood(snake, data, state);
    }
    // After cutting, go to cooldown
    if (bs.chaseTicks > 140) {
      bs.cooldown = 180;
      bs.chaserId = null;
      bs.chaseTicks = 0;
    }
    return;
  }

  // Being chased but not long enough — keep going straight (bait!)
  if (bs.chaserId) {
    // Slight drift toward food but mostly maintain course
    const food = findNearestFood(hx, hy, state.foods, 300 * 300);
    if (food) {
      const foodAngle = angleTo(hx, hy, food.x, food.y);
      // Blend 80% current direction, 20% food
      const blended = normalizeAngle(snake.angle * 0.8 + foodAngle * 0.2);
      steerToward(data, blended);
    } else {
      // Just keep going straight
      steerToward(data, snake.angle);
    }
    data.wantBoost = false;
    return;
  }

  // Not being chased — eat food normally
  steerToFood(snake, data, state);
}

// ============================================================================
// TYPE 4: INTERCEPTOR — Watch for sharp turns, cut inside
// ============================================================================

function updateInterceptor(snake: Snake, data: BotAIData, state: GameState): void {
  const is = data.interceptor!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  if (is.strikeCooldown > 0) {
    is.strikeCooldown--;
    steerToFood(snake, data, state);
    return;
  }

  // Find a snake to watch
  if (data.retargetTimer <= 0) {
    data.retargetTimer = ac().retargetInterval;
    is.watchId = null;
    is.angleChange = 0;
    is.watchTicks = 0;

    // Prefer player, then nearest snake
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, distSq: 0, score: state.player.score, angle: state.player.angle } : null;
    if (!target) target = findNearestSnake(snake, state.snakes, ac().sightRangeSq, _aiHeadHash);
    if (target && target.id !== snake.id && target.distSq < 600 * 600) {
      is.watchId = target.id;
      is.prevAngle = target.angle;
    }
  }

  if (!is.watchId) { steerToFood(snake, data, state); return; }

  const target = state.snakes.get(is.watchId);
  if (!target || !target.alive) { is.watchId = null; steerToFood(snake, data, state); return; }

  is.watchTicks++;

  // Track angle changes
  const aChange = Math.abs(normalizeAngle(target.angle - is.prevAngle));
  is.angleChange += aChange;
  is.prevAngle = target.angle;

  // Decay old change data (window of 30 ticks)
  if (is.watchTicks > 30) {
    is.angleChange *= 0.9;
  }

  // If target made a sharp turn (accumulated > 1.5 rad over 30 ticks), STRIKE
  if (is.angleChange > 1.5 && is.watchTicks > 15) {
    // Predict target's new path
    const predictTicks = 25;
    const futureX = target.path.headX + Math.cos(target.angle) * BASE_SPEED * predictTicks;
    const futureY = target.path.headY + Math.sin(target.angle) * BASE_SPEED * predictTicks;

    // Aim for the inside of their turn
    const turnDir = normalizeAngle(target.angle - snake.angle) > 0 ? 1 : -1;
    const insideX = futureX + Math.cos(target.angle + turnDir * Math.PI / 2) * 80;
    const insideY = futureY + Math.sin(target.angle + turnDir * Math.PI / 2) * 80;

    steerToward(data, angleTo(hx, hy, insideX, insideY));
    data.wantBoost = true;

    // After striking, cooldown
    if (is.angleChange > 2.5) {
      is.strikeCooldown = 150;
      is.watchId = null;
      is.angleChange = 0;
    }
    return;
  }

  // Otherwise, follow at safe distance while watching
  const d = Math.sqrt(distSq(hx, hy, target.path.headX, target.path.headY));
  if (d > 300) {
    // Close in a bit
    steerToward(data, angleTo(hx, hy, target.path.headX, target.path.headY));
    data.wantBoost = false;
  } else {
    // Maintain distance, eat food
    steerToFood(snake, data, state);
  }
}

// ============================================================================
// TYPE 5: GRAZER — Eat food, survive. Arena filler.
// ============================================================================

function updateGrazer(snake: Snake, data: BotAIData, state: GameState): void {
  steerToFood(snake, data, state);
}

// ============================================================================
// TYPE 6: TRAPPER — Wide arcs creating body walls across paths
// ============================================================================

function updateTrapper(snake: Snake, data: BotAIData, state: GameState): void {
  const ts = data.trapper!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Pick new arc center if needed
  const distToCenter = Math.sqrt(distSq(hx, hy, ts.centerX, ts.centerY));
  if (ts.arcProgress > 0.85 || distToCenter > ts.arcRadius * 1.8) {
    // Pick a new center near a food cluster or random
    const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE * 2);
    if (cluster) {
      ts.centerX = cluster.x;
      ts.centerY = cluster.y;
    } else {
      ts.centerX = hx + (Math.random() - 0.5) * 800;
      ts.centerY = hy + (Math.random() - 0.5) * 800;
    }
    ts.arcRadius = 250 + Math.random() * 200;
    ts.arcDir = Math.random() < 0.5 ? 1 : -1;
    ts.arcAngle = angleTo(ts.centerX, ts.centerY, hx, hy);
    ts.arcProgress = 0;
  }

  // Move along the arc
  const arcSpeed = 0.015; // radians per tick along the arc
  ts.arcAngle = normalizeAngle(ts.arcAngle + ts.arcDir * arcSpeed);
  ts.arcProgress += arcSpeed / (2 * Math.PI);

  // Target point on the arc
  const targetX = ts.centerX + Math.cos(ts.arcAngle) * ts.arcRadius;
  const targetY = ts.centerY + Math.sin(ts.arcAngle) * ts.arcRadius;

  steerToward(data, angleTo(hx, hy, targetX, targetY));
  data.wantBoost = false;
}

const RANKED_DANGER_RANGE_SQ = 500 * 500;
const RANKED_PEER_RANGE_SQ = 800 * 800;

// Ranked bots have 3× the body scan range and wider cone for early detection
// (now computed inline in updateAllBotAI from arenaConfig.bodyScanDist)

function updateRanked(snake: Snake, data: BotAIData, state: GameState): void {
  const rs = data.ranked!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // P1 FIX #4: Use spatial hash instead of iterating ALL snakes.
  const dangerRange = Math.sqrt(RANKED_DANGER_RANGE_SQ);
  const nearby = _aiHeadHash.query(hx, hy, dangerRange);
  let fleeX = 0, fleeY = 0;
  let dangerCount = 0;
  let closestDanger = Infinity;
  let closestDangerAngle = 0;

  for (let ni = 0; ni < nearby.length; ni++) {
    const otherId = nearby[ni].id as string;
    if (otherId === snake.id) continue;
    const other = state.snakes.get(otherId);
    if (!other || !other.alive) continue;

    const dx = nearby[ni].x - hx;
    const dy = nearby[ni].y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq > RANKED_DANGER_RANGE_SQ || dSq < 1) continue;

    const d = Math.sqrt(dSq);
    dangerCount++;
    if (d < closestDanger) {
      closestDanger = d;
      closestDangerAngle = Math.atan2(dy, dx);
    }
    // Accumulate flee vector (stronger when closer)
    const weight = 1 - (d / 500);
    fleeX -= (dx / d) * weight;
    fleeY -= (dy / d) * weight;
  }

  if (dangerCount > 0) {
    // Flee: blend accumulated repulsion with strong forward bias
    const fleeAngle = Math.atan2(fleeY, fleeX);
    const urgency = 1 - (closestDanger / 500);
    const blend = 0.3 + 0.7 * urgency;
    const evaded = normalizeAngle(data.targetAngle * (1 - blend) + fleeAngle * blend);
    steerToward(data, evaded, 0.5);
    // Boost to escape when very close
    data.wantBoost = closestDanger < 200 && snake.score > 10;
    return;
  }

  // P1 FIX #4: Use spatial hash for peer repel instead of iterating ALL snakes.
  const peerRange = Math.sqrt(RANKED_PEER_RANGE_SQ);
  const nearbyPeers = _aiHeadHash.query(hx, hy, peerRange);
  let repelX = 0, repelY = 0;
  for (let ni = 0; ni < nearbyPeers.length; ni++) {
    const otherId = nearbyPeers[ni].id as string;
    if (otherId === snake.id) continue;
    const other = state.snakes.get(otherId);
    if (!other || !other.alive || !other.isBot) continue;
    const otherData = getBotData(otherId);
    if (!otherData || otherData.type !== 'ranked') continue;
    const dx = nearbyPeers[ni].x - hx;
    const dy = nearbyPeers[ni].y - hy;
    const dSq = dx * dx + dy * dy;
    if (dSq > RANKED_PEER_RANGE_SQ || dSq < 1) continue;
    const d = Math.sqrt(dSq);
    const weight = 1 - (d / 800);
    repelX -= (dx / d) * weight * 0.6;
    repelY -= (dy / d) * weight * 0.6;
  }

  // ── Phase 3: Drift toward home sector (gentle pull) ──
  const homeX = Math.cos(rs.homeAngle) * rs.homeRadius;
  const homeY = Math.sin(rs.homeAngle) * rs.homeRadius;
  const toHomeAngle = angleTo(hx, hy, homeX, homeY);
  const homeDist = Math.sqrt(distSq(hx, hy, homeX, homeY));
  // Pull harder when far from home, very gentle when close
  const homePull = Math.min(homeDist / 1000, 0.4);

  // ── Phase 4: Gentle food seeking within sector ──
  const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
  let foodAngle = rs.sectorWanderAngle;
  if (cluster) {
    foodAngle = angleTo(hx, hy, cluster.x, cluster.y);
  }

  // ── Phase 5: Wander within sector ──
  if (rs.sectorWanderTimer <= 0) {
    rs.sectorWanderAngle += (Math.random() - 0.5) * 0.4;
    rs.sectorWanderTimer = 90 + Math.floor(Math.random() * 180);
  }
  rs.sectorWanderTimer--;

  // ── Combine: repel + home + food ──
  const repelMag = Math.sqrt(repelX * repelX + repelY * repelY);
  let combinedAngle: number;
  if (repelMag > 0.01) {
    const repelAngle = Math.atan2(repelY, repelX);
    // When peer repulsion is active, blend it with food/home
    combinedAngle = normalizeAngle(
      repelAngle * 0.5 + foodAngle * 0.3 + toHomeAngle * 0.2
    );
  } else {
    // No peer nearby: mostly food, gentle home pull
    combinedAngle = normalizeAngle(
      foodAngle * (1 - homePull) + toHomeAngle * homePull
    );
  }

  steerToward(data, combinedAngle, 0.7); // stronger forward bias = smoother
  data.wantBoost = false;
}

// ─── Guard System: Normal bots protect nearby ranked bots ─────────────────
// When a non-ranked bot detects a threat (player or big snake) heading toward
// a nearby ranked bot, it steers to get between the threat and the ranked bot.

const GUARD_DETECT_RANGE_SQ = 600 * 600;
const GUARD_INTERCEPT_RANGE_SQ = 400 * 400;

function computeGuardRankedAngle(snake: Snake, state: GameState): number | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // P1 FIX #4: Use spatial hash to find nearest ranked bot instead of iterating ALL.
  const guardRange = Math.sqrt(GUARD_DETECT_RANGE_SQ);
  const nearby = _aiHeadHash.query(hx, hy, guardRange);
  let nearestRanked: { id: string; x: number; y: number; distSq: number } | null = null;
  for (let ni = 0; ni < nearby.length; ni++) {
    const otherId = nearby[ni].id as string;
    if (otherId === snake.id) continue;
    const other = state.snakes.get(otherId);
    if (!other || !other.alive || !other.isBot) continue;
    const data = getBotData(otherId);
    if (!data || data.type !== 'ranked') continue;
    const dSq = distSq(hx, hy, nearby[ni].x, nearby[ni].y);
    if (dSq < GUARD_DETECT_RANGE_SQ && (!nearestRanked || dSq < nearestRanked.distSq)) {
      nearestRanked = { id: otherId, x: nearby[ni].x, y: nearby[ni].y, distSq: dSq };
    }
  }
  if (!nearestRanked) return null;

  // P1 FIX #4: Use spatial hash to find threats to the ranked bot.
  const threatRange = Math.sqrt(GUARD_DETECT_RANGE_SQ);
  const nearRanked = _aiHeadHash.query(nearestRanked.x, nearestRanked.y, threatRange);
  for (let ni = 0; ni < nearRanked.length; ni++) {
    const otherId = nearRanked[ni].id as string;
    if (otherId === snake.id) continue;
    const other = state.snakes.get(otherId);
    if (!other || !other.alive) continue;
    const otherData = getBotData(otherId);
    if (otherData && otherData.type === 'ranked') continue;

    const tx = other.path.headX;
    const ty = other.path.headY;
    const dToRanked = Math.sqrt(distSq(tx, ty, nearestRanked.x, nearestRanked.y));
    if (dToRanked > 500) continue; // threat too far from ranked bot

    // Is the threat heading toward the ranked bot? (within 60° of the direction)
    const threatAngle = other.angle;
    const angleToRanked = angleTo(tx, ty, nearestRanked.x, nearestRanked.y);
    const headingDiff = Math.abs(normalizeAngle(angleToRanked - threatAngle));
    if (headingDiff > Math.PI / 3) continue; // not heading toward ranked bot

    // Threat detected! Steer to get between the threat and the ranked bot
    // Target: midpoint between threat and ranked bot, offset perpendicular
    const midX = (tx + nearestRanked.x) / 2;
    const midY = (ty + nearestRanked.y) / 2;
    return angleTo(hx, hy, midX, midY);
  }

  return null;
}

// ─── Main Update Dispatch ────────────────────────────────────────────────────

const BOT_UPDATERS: Record<BotType, (snake: Snake, data: BotAIData, state: GameState) => void> = {
  predator: updatePredator, coiler: updateCoiler, baiter: updateBaiter,
  interceptor: updateInterceptor, grazer: updateGrazer, trapper: updateTrapper,
  ranked: updateRanked,
};

/** Dispatch to type-specific updater (reads arena config from _ac) */
function updateBotPersonality(snake: Snake, data: BotAIData, state: GameState, _ac: ArenaConfig): void {
  BOT_UPDATERS[data.type](snake, data, state);
}

// ─── AI Spatial Hash — reusable head hash for O(n×k) neighbor queries ──
// Built once per AI update, then queried by all bots for personal space.
// Eliminates the O(n²) full-scan loop that cost 5-10ms with 999 bots.

const _aiHeadHash = new SpatialHash();
const _aiScratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };

// P2 OPTIMIZATION: Distance-based AI tiering.
// Bots far from player skip expensive body/head scanning.
// Thresholds are per-arena via state.arenaConfig.
// Full AI: scanBodyAhead + checkHeadOnThreat + body proximity (~200μs/bot)
// Lite AI:  personal space (hash query) + wall + wander (~15μs/bot)
const DEFAULT_FAR_BOT_DIST_SQ = 5000 * 5000;
const DEFAULT_RANKED_FAR_DIST_SQ = 8000 * 8000;
function buildAIHeadHash(snakes: Map<string, Snake>): void {
  _aiHeadHash.clear();
  for (const [id, snake] of snakes) {
    if (!snake.alive) continue;
    _aiScratch.x = snake.path.headX;
    _aiScratch.y = snake.path.headY;
    _aiScratch.radius = 0;
    _aiScratch.id = id;
    _aiHeadHash.insert(_aiScratch);
  }
}

// ============================================================================
// MAIN LOOP — Called every tick for all bots
// ============================================================================

export function updateAllBotAI(state: GameState): void {
  const ac = state.arenaConfig;
  _ac = ac; // Set module-level ref for type updaters and helpers
  // P0 OPTIMIZATION: Build head hash once for all bots to share.
  buildAIHeadHash(state.snakes);

  // P2 OPTIMIZATION: Cache player position for distance-based AI tiering.
  const player = state.player;
  const playerX = player?.alive ? player.path.headX : NaN;
  const playerY = player?.alive ? player.path.headY : NaN;

  // Arena-specific AI params
  const farDistSq = ac.aiDistanceTierSq;
  const rankedFarDistSq = ac.rankedAiDistanceTierSq;
  const bodyScanDist = ac.bodyScanDist;
  const headOnRange = ac.headOnRange;
  const playerFleeRangeSq = ac.playerFleeRangeSq;
  const sightRangeSq = ac.sightRangeSq;
  const foodSeekRangeSq = ac.foodSeekRangeSq;
  const wallBoundary = ac.spawnRadius;
  const retargetInterval = ac.retargetInterval;
  const foodAggMult = ac.foodAggressionMult;
  const rankedBodyScanDist = bodyScanDist * 3;
  const rankedBodyScanCone = Math.PI * 0.7;

  for (const [id, snake] of state.snakes) {
    if (!snake.isBot || !snake.alive) continue;
    const data = getBotData(id);
    if (!data) continue;

    data.retargetTimer--;
    data.wanderChangeTimer = Math.max(0, data.wanderChangeTimer - 1);

    // ── P2: Distance-based AI tiering ──
    const isRanked = data.type === 'ranked';
    const farThresholdSq = isRanked ? rankedFarDistSq : farDistSq;
    const dxToPlayer = snake.path.headX - playerX;
    const dyToPlayer = snake.path.headY - playerY;
    const isFarFromPlayer = isNaN(playerX) || (dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer > farThresholdSq);

    if (!isFarFromPlayer) {
      // ── FULL AI ──
      const bodyThreat = scanBodyAhead(
        snake, state.snakes, _aiHeadHash,
        isRanked ? rankedBodyScanDist : bodyScanDist,
        isRanked ? rankedBodyScanCone : BODY_SCAN_CONE,
      );
      const headOnThreat = !bodyThreat ? checkHeadOnThreat(snake, state.snakes, _aiHeadHash) : null;

      if (bodyThreat && bodyThreat.severity > 0.3) {
        const flee = bodyThreat.avoidAngle;
        const blend = 0.2 + 0.8 * bodyThreat.severity;
        const evaded = normalizeAngle(data.targetAngle * (1 - blend) + flee * blend);
        steerToward(data, evaded, 0.7);
        data.wantBoost = bodyThreat.severity > 0.7;
      } else if (headOnThreat) {
        steerToward(data, headOnThreat.avoidAngle, 0.5);
        data.wantBoost = false;
      } else {
        if (!isRanked) {
          const guardAngle = computeGuardRankedAngle(snake, state);
          if (guardAngle !== null) {
            steerToward(data, guardAngle, 0.4);
            data.wantBoost = true;
          } else {
            updateBotPersonality(snake, data, state, ac);
          }
        } else {
          updateBotPersonality(snake, data, state, ac);
        }
      }
    } else {
      // ── LITE AI: Far from player ──
      steerToWander(data, snake);
    }

    // ── Layer 1.5: Collision Avoidance ──
    {
      const shx = snake.path.headX;
      const shy = snake.path.headY;
      let avX = 0, avY = 0;
      let hasAvoid = false;

      const nearby = _aiHeadHash.query(shx, shy, PS_RANGE);
      for (let ni = 0; ni < nearby.length; ni++) {
        const otherId = nearby[ni].id as string;
        if (otherId === snake.id) continue;
        const other = state.snakes.get(otherId);
        if (!other || !other.alive) continue;

        const dx = nearby[ni].x - shx;
        const dy = nearby[ni].y - shy;
        const dSq = dx * dx + dy * dy;
        if (dSq < 1) continue;
        const d = Math.sqrt(dSq);

        const isPlayer = other.isPlayer;

        // (A) Normal bots flee from player (range varies per arena, 0 = never flee)
        if (isPlayer && !isRanked && playerFleeRangeSq > 0 && dSq < playerFleeRangeSq) {
          const fleeRange = Math.sqrt(playerFleeRangeSq);
          const fleeUrgency = 1 - (d / fleeRange);
          const fleeWeight = 2.5 * fleeUrgency;
          avX -= (dx / d) * fleeWeight;
          avY -= (dy / d) * fleeWeight;
          hasAvoid = true;
          continue;
        }

        // (B) Personal space repulsion
        let weight: number;
        if (dSq < PS_STRONG_SQ) {
          const otherR = computeBodyRadius(other.score);
          const sizeFactor = 1 + otherR * 0.15;
          weight = 1.8 * (1 - d / PS_STRONG) * sizeFactor;
        } else {
          weight = 0.5 * (1 - d / PS_RANGE);
        }
        avX -= (dx / d) * weight;
        avY -= (dy / d) * weight;
        hasAvoid = true;
      }

      // (C) Body proximity
      if (!isFarFromPlayer && (data.type === 'predator' || data.type === 'coiler' || data.type === 'interceptor' || data.type === 'ranked')) {
        const bodyNearby = _aiHeadHash.query(shx, shy, 600);
        for (let ni = 0; ni < bodyNearby.length; ni++) {
          const otherId = bodyNearby[ni].id as string;
          if (otherId === snake.id) continue;
          const other = state.snakes.get(otherId);
          if (!other || !other.alive) continue;
          const pathLen = other.path.length;
          const step = Math.max(4, Math.floor(pathLen / 20));
          for (let i = 4; i < pathLen; i += step) {
            const bx = other.path.getX(i);
            const by = other.path.getY(i);
            const bdx = bx - shx;
            const bdy = by - shy;
            const bSq = bdx * bdx + bdy * bdy;
            if (bSq < BODY_AVOID_RANGE_SQ && bSq > 1) {
              const bd = Math.sqrt(bSq);
              avX += -(bdx / bd) * (1 - bd / BODY_AVOID_RANGE) * 0.4;
              avY += -(bdy / bd) * (1 - bd / BODY_AVOID_RANGE) * 0.4;
              hasAvoid = true;
            }
          }
        }
      }

      if (hasAvoid) {
        const avoidAngle = Math.atan2(avY, avX);
        const avoidMag = Math.sqrt(avX * avX + avY * avY);
        const blend = Math.min(0.75, avoidMag * 0.25);
        data.targetAngle = normalizeAngle(data.targetAngle * (1 - blend) + avoidAngle * blend);
      }
    }

    // ── Wall avoidance ──
    data.targetAngle = wallAvoidAngle(snake.path.headX, snake.path.headY, data.targetAngle, wallBoundary);

    // ── Output ──
    snake.targetAngle = data.targetAngle;
  }
}

export function getBotBoost(snakeId: string): boolean {
  return getBotData(snakeId)?.wantBoost ?? false;
}

// ─── Bot Spawning ────────────────────────────────────────────────────────────

let nameCounters: Record<BotType, number> = { predator: 0, coiler: 0, baiter: 0, interceptor: 0, grazer: 0, trapper: 0, ranked: 0 };

// Monotonic counter for unique bot IDs.
// Previous: Date.now() caused ID collisions when two bots died in the same millisecond.
// Fixed: Monotonic counter guarantees uniqueness.
let _botIdCounter = 0;

function pickBotName(type: BotType): string {
  const names = BOT_NAMES[type];
  const idx = nameCounters[type] % names.length;
  nameCounters[type]++;
  return names[idx];
}

function createBotAIData(type: BotType, rank?: number, state?: GameState): BotAIData {
  const data: BotAIData = {
    type, targetAngle: Math.random() * Math.PI * 2, wantBoost: false,
    retargetTimer: 0, wanderAngle: Math.random() * Math.PI * 2,
    wanderChangeTimer: Math.floor(Math.random() * 30),
  };
  if (type === 'predator') data.predator = { targetId: null, phase: 'seek', phaseTimer: 0, cutDir: 1 };
  if (type === 'coiler') data.coiler = { targetId: null, orbitDir: 1, orbitRadius: 220, ticksOrbiting: 0 };
  if (type === 'baiter') data.baiter = { chaserId: null, chaseTicks: 0, cooldown: 0 };
  if (type === 'interceptor') data.interceptor = { watchId: null, prevAngle: 0, angleChange: 0, watchTicks: 0, strikeCooldown: 0 };
  if (type === 'trapper') data.trapper = { centerX: 0, centerY: 0, arcAngle: 0, arcDir: 1, arcRadius: 300, arcProgress: 1 };
  if (type === 'ranked') {
    const r = rank ?? 1;
    const ac = state?.arenaConfig;
    const homeMin = ac?.rankedHomeMin ?? 15000;
    const homeMax = ac?.rankedHomeMax ?? 25000;
    const sectorAngle = ((r - 1) / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const homeRadius = homeMin + Math.random() * (homeMax - homeMin);
    data.ranked = {
      rank: r,
      homeAngle: sectorAngle,
      homeRadius,
      sectorWanderAngle: sectorAngle + (Math.random() - 0.5) * 0.5,
      sectorWanderTimer: Math.floor(Math.random() * 120),
    };
    data.targetAngle = sectorAngle;
    data.wanderAngle = sectorAngle;
  }
  return data;
}

/** Fast head-only distance check — O(snakes), no body segment scan.
 *  Used during mass spawn of 989 bots where body checks are too expensive. */
function isSafeSpawnHeadOnly(
  x: number, y: number,
  snakes: Map<string, Snake>,
  minDistSq: number,
  headHash: SpatialHash,
): boolean {
  const minDist = Math.sqrt(minDistSq);
  const nearby = headHash.query(x, y, minDist);
  for (let i = 0; i < nearby.length; i++) {
    const s = nearby[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy < minDistSq) return false;
  }
  return true;
}

function isSafeSpawnPos(
  x: number, y: number,
  snakes: Map<string, Snake>,
  headDistSq: number,
  bodyCheckRange: number,
  maxNeighbors: number,
): boolean {
  let neighborCount = 0;
  const neighborAngles: number[] = [];

  for (const [, s] of snakes) {
    if (!s.alive) continue;
    const hdx = s.path.headX - x;
    const hdy = s.path.headY - y;
    const hdSq = hdx * hdx + hdy * hdy;

    // Dynamic head distance: scale with the other snake's body size
    const otherRadius = computeBodyRadius(s.score);
    const otherLength = computeBodyLength(s.score);
    // Min safe head dist = max(100, bodyRadius * 8, bodyLength * 2)
    const minHeadDist = Math.max(100, otherRadius * 8, otherLength * SEGMENT_SPACING * 0.4);
    if (hdSq < minHeadDist * minHeadDist) return false;

    // Neighbor count (within 800px)
    if (hdSq < 800 * 800) {
      neighborCount++;
      neighborAngles.push(Math.atan2(hdy, hdx));
    }

    // Body segment check — only for snakes within bodyCheckRange of head
    if (hdSq < bodyCheckRange * bodyCheckRange) {
      // Safe distance scales with the other snake's body radius
      const bodySafeDist = Math.max(40, otherRadius * 4 + 20);
      const pathLen = s.path.length;
      const step = Math.max(2, Math.floor(pathLen / 50)); // sample ~50 segments max
      for (let i = 0; i < pathLen; i += step) {
        const bx = s.path.getX(i);
        const by = s.path.getY(i);
        const bdx = bx - x;
        const bdy = by - y;
        if (bdx * bdx + bdy * bdy < bodySafeDist * bodySafeDist) return false;
      }
    }
  }

  // Crowded area check
  if (neighborCount > maxNeighbors) return false;

  // Between-snakes check: reject if we're between two snakes whose heads
  // are on roughly opposite sides (angle diff > 120°) and both within 600px
  if (neighborAngles.length >= 2) {
    for (let i = 0; i < neighborAngles.length; i++) {
      for (let j = i + 1; j < neighborAngles.length; j++) {
        const diff = Math.abs(normalizeAngle(neighborAngles[i] - neighborAngles[j]));
        if (diff > Math.PI * 0.67) return false; // > 120° apart = between them
      }
    }
  }

  return true;
}

/** Find a safe spawn position for normal bots.
 *  Uses arenaConfig for spawn ring dimensions. */
function findBotSpawnPos(state: GameState, massSpawn = true): { x: number; y: number } {
  const ac = state.arenaConfig;
  const minDistSq = ac.safeSpawnDist * ac.safeSpawnDist;
  const dMin = ac.botSpawnInner;
  const dMax = ac.spawnRadius * ac.botSpawnOuterFactor;
  for (let attempt = 0; attempt < 60; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = dMin + Math.sqrt(Math.random()) * (dMax - dMin);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    if (massSpawn ? isSafeSpawnHeadOnly(x, y, state.snakes, minDistSq, _aiHeadHash) : isSafeSpawnPos(x, y, state.snakes, 250 * 250, 400, 2)) {
      return { x, y };
    }
  }
  const a = Math.random() * Math.PI * 2;
  const d = dMin + Math.random() * (dMax - dMin);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

/** Spawn a ranked bot in its home sector.
 *  Uses arenaConfig for max radius and jitter. */
function findRankedSpawnPos(state: GameState, homeAngle: number, homeRadius: number, massSpawn = true): { x: number; y: number } {
  const ac = state.arenaConfig;
  const maxR = ac.spawnRadius * 0.92;
  const jitter = ac.rankedHomeJitter;
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = homeAngle + (Math.random() - 0.5) * 0.2;
    const rJitter = (Math.random() - 0.5) * jitter;
    const r = Math.min(homeRadius + rJitter, maxR);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (massSpawn ? isSafeSpawnHeadOnly(x, y, state.snakes, 600 * 600, _aiHeadHash) : isSafeSpawnPos(x, y, state.snakes, 600 * 600, 600, 1)) {
      return { x, y };
    }
  }
  return { x: Math.cos(homeAngle) * homeRadius, y: Math.sin(homeAngle) * homeRadius };
}

// ─── Bot Starting Score Generation ──────────────────────────────────────────
// Score range is per-arena via state.arenaConfig
function generateNormalBotScore(state: GameState): number {
  const ac = state.arenaConfig;
  return ac.normalBotScoreMin + Math.floor(
    (ac.normalBotScoreMax - ac.normalBotScoreMin) * Math.pow(Math.random(), ac.normalBotScoreExp)
  );
}

// Ranked scores are per-arena via state.arenaConfig.rankedScores
function getRankedScore(rank: number, state: GameState): number {
  return state.arenaConfig.rankedScores[(rank - 1) % state.arenaConfig.rankedScores.length] ?? 5000;
}

export function spawnBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const now = Date.now();
  let botIndex = 0;
  const types: BotType[] = ['predator', 'coiler', 'baiter', 'interceptor', 'grazer', 'trapper'];
  const counts = [config.predator, config.coiler, config.baiter, config.interceptor, config.grazer, config.trapper];

  // Spawn regular bots first — mass spawn with fast head-only safety check
  for (let t = 0; t < types.length; t++) {
    for (let i = 0; i < counts[t]; i++) {
      const type = types[t];
      const pos = findBotSpawnPos(state, true);
      const id = `bot-${type}-${botIndex++}`;
      const name = pickBotName(type);
      const startScore = generateNormalBotScore(state);
      const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, type);
      snake.isBot = true;
      snake.isPlayer = false;
      state.snakes.set(id, snake);
      setBotData(id, createBotAIData(type, undefined, state));
    }
  }

  // Spawn ranked bots — spread across sectors, high scores
  for (let r = 1; r <= config.ranked; r++) {
    const rank = r;
    const startScore = getRankedScore(rank, state);
    const tempData = createBotAIData('ranked', rank, state);
    const homeAngle = tempData.ranked!.homeAngle;
    const homeRadius = tempData.ranked!.homeRadius;
    const pos = findRankedSpawnPos(state, homeAngle, homeRadius, true);
    const id = `bot-ranked-${r}`;
    const name = BOT_NAMES.ranked[(r - 1) % BOT_NAMES.ranked.length];
    const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, 'ranked');
    snake.isBot = true;
    snake.isPlayer = false;
    state.snakes.set(id, snake);
    setBotData(id, tempData);
  }
}

export function respawnDeadBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const targetCount = config.predator + config.coiler + config.baiter + config.interceptor + config.grazer + config.trapper + config.ranked;
  let aliveBots = 0;
  for (const [, s] of state.snakes) { if (s.isBot && s.alive) aliveBots++; }
  if (aliveBots >= targetCount) return;

  const types: BotType[] = ['predator', 'coiler', 'baiter', 'interceptor', 'grazer', 'trapper', 'ranked'];
  const counts = [config.predator, config.coiler, config.baiter, config.interceptor, config.grazer, config.trapper, config.ranked];
  const alivePerType: Record<BotType, number> = { predator: 0, coiler: 0, baiter: 0, interceptor: 0, grazer: 0, trapper: 0, ranked: 0 };
  for (const [id, s] of state.snakes) { if (s.isBot && s.alive) { const data = getBotData(id); if (data) alivePerType[data.type]++; } }

  let bestType: BotType = 'grazer';
  let biggestDeficit = -Infinity;
  for (let t = 0; t < types.length; t++) {
    const deficit = counts[t] - alivePerType[types[t]];
    if (deficit > biggestDeficit) { biggestDeficit = deficit; bestType = types[t]; }
  }

  if (biggestDeficit > 0) {
    const now = Date.now();
    // Use fast head-only check when filling in (< 50% of target) to avoid
    // expensive body segment scans during initial bot population.
    const massSpawn = aliveBots < targetCount * 0.5;
    let pos: { x: number; y: number };
    let respawnScore: number;
    if (bestType === 'ranked') {
      // Find which rank slot is empty and respawn it
      const aliveRanked = alivePerType.ranked;
      const rank = aliveRanked + 1;
      const tempData = createBotAIData('ranked', rank, state);
      pos = findRankedSpawnPos(state, tempData.ranked!.homeAngle, tempData.ranked!.homeRadius, massSpawn);
      respawnScore = getRankedScore(rank, state);
    } else {
      pos = findBotSpawnPos(state, massSpawn);
      respawnScore = generateNormalBotScore(state);
    }
    const id = `bot-${bestType}-${_botIdCounter++}`;
    const name = pickBotName(bestType);
    const snake = createSnakeFn(id, name, respawnScore, pos.x, pos.y, now, bestType);
    snake.isBot = true; snake.isPlayer = false;
    state.snakes.set(id, snake);
    setBotData(id, bestType === 'ranked' ? createBotAIData('ranked', alivePerType.ranked + 1, state) : createBotAIData(bestType, undefined, state));
  }
}

export function removeBot(snakeId: string): void { removeBotData(snakeId); }
