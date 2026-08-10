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

import type { GameState, Snake, FoodOrb } from './types';
import { BASE_SPEED, SPAWN_RADIUS, INITIAL_SPAWN_RADIUS } from './config';

// ─── Bot Types ──────────────────────────────────────────────────────────────

export type BotType = 'predator' | 'coiler' | 'baiter' | 'interceptor' | 'grazer' | 'trapper';

/** Color palette per bot type: [bodyColor, headColor] */
export const BOT_TYPE_COLORS: Record<BotType, [string, string]> = {
  predator:    ['#ef4444', '#fca5a5'],
  coiler:      ['#f97316', '#fdba74'],
  baiter:      ['#eab308', '#fde047'],
  interceptor: ['#06b6d4', '#67e8f9'],
  grazer:      ['#22c55e', '#86efac'],
  trapper:     ['#8b5cf6', '#c4b5fd'],
};

// ─── Bot Names ──────────────────────────────────────────────────────────────

const BOT_NAMES: Record<BotType, string[]> = {
  predator:    ['Viper', 'Cobra', 'Mamba', 'Taipan', 'Adder', 'Krait', 'Fang', 'Striker'],
  coiler:      ['Python', 'Anaconda', 'Constrictor', 'Squeeze', 'Crush', 'Bind', 'Wrap', 'Coil'],
  baiter:      ['Shadow', 'Phantom', 'Lurk', 'Mirage', 'Decoy', 'Trick', 'Lure', 'Snare'],
  interceptor: ['Falcon', 'Hawk', 'Eagle', 'Raptor', 'Strike', 'Blitz', 'Flash', 'Dash'],
  grazer:      ['Nibbles', 'Munch', 'Grazer', 'Harvest', 'Bloom', 'Sprout', 'Clover', 'Meadow'],
  trapper:     ['Web', 'Net', 'Cage', 'Trap', 'Fort', 'Wall', 'Barricade', 'Fence'],
};

// ─── Bot Spawn Mix ──────────────────────────────────────────────────────────

export interface BotSpawnConfig {
  predator: number; coiler: number; baiter: number;
  interceptor: number; grazer: number; trapper: number;
}

/** Default mix: 13 bots — 8 peaceful, 5 aggressive */
export const DEFAULT_BOT_MIX: BotSpawnConfig = {
  predator: 2, coiler: 1, baiter: 2, interceptor: 1, grazer: 4, trapper: 3,
};

// ─── Performance Constants ───────────────────────────────────────────────────

const MAX_FOOD_SAMPLE = 120;
const MAX_CLUSTER_SAMPLE = 150;

// ─── Ranges ──────────────────────────────────────────────────────────────────

const SIGHT_RANGE_SQ = 900 * 900;
const FOOD_SEEK_RANGE_SQ = 1200 * 1200;
const CLUSTER_RANGE = 500;
const WALL_BOUNDARY = SPAWN_RADIUS;
const RETARGET_INTERVAL = 45;

// ─── Body Scanner Config ─────────────────────────────────────────────────────

const BODY_SCAN_DIST = 180;       // px ahead to scan for body threats
const BODY_SCAN_CONE = Math.PI * 0.45; // 81° half-cone
const HEAD_ON_RANGE = 250;        // px to detect head-on approach

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

function sampleFood(foods: FoodOrb[], maxCount: number): FoodOrb[] {
  const len = foods.length;
  if (len <= maxCount) return foods;
  const sampled: FoodOrb[] = new Array(maxCount);
  for (let i = 0; i < maxCount; i++) {
    sampled[i] = foods[Math.floor(Math.random() * len)];
  }
  return sampled;
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
  snake: Snake, snakes: Map<string, Snake>, maxDistSq: number,
): { id: string; x: number; y: number; score: number; distSq: number; angle: number } | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  let best: { id: string; x: number; y: number; score: number; distSq: number; angle: number } | null = null;
  for (const [id, other] of snakes) {
    if (id === snake.id || !other.alive) continue;
    const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { id, x: other.path.headX, y: other.path.headY, score: other.score, distSq: dSq, angle: other.angle };
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
): BodyThreat | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const myAngle = snake.angle;
  const scanDistSq = BODY_SCAN_DIST * BODY_SCAN_DIST;
  const headRangeSq = (BODY_SCAN_DIST * 2.5) * (BODY_SCAN_DIST * 2.5);

  let closestDist = BODY_SCAN_DIST + 1;
  let closestFleeAngle = 0;

  for (const [id, other] of snakes) {
    if (id === snake.id || !other.alive) continue;

    // Quick reject: if their head is far, their body can't be close
    if (distSq(hx, hy, other.path.headX, other.path.headY) > headRangeSq) continue;

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
      if (aDiff > BODY_SCAN_CONE) continue;

      const d = Math.sqrt(dSq);
      if (d < closestDist) {
        closestDist = d;
        // Flee: steer away from the body point
        closestFleeAngle = Math.atan2(-dy, -dx);
      }
    }
  }

  if (closestDist > BODY_SCAN_DIST) return null;

  return {
    avoidAngle: closestFleeAngle,
    severity: Math.max(0, 1 - closestDist / BODY_SCAN_DIST),
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
): BodyThreat | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const myVx = Math.cos(snake.angle) * snake.speed;
  const myVy = Math.sin(snake.angle) * snake.speed;
  const rangeSq = HEAD_ON_RANGE * HEAD_ON_RANGE;

  let bestThreat: BodyThreat | null = null;

  for (const [id, other] of snakes) {
    if (id === snake.id || !other.alive) continue;

    const dx = other.path.headX - hx;
    const dy = other.path.headY - hy;
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

    const severity = 1 - (d / HEAD_ON_RANGE);
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
  const margin = 600;
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
  data.targetAngle = normalizeAngle(
    data.targetAngle * bias + desiredAngle * (1 - bias),
  );
}

/** Same as steerToward but with per-type food aggression bias */
function steerToFoodBias(data: BotAIData, desiredAngle: number, type: BotType): void {
  // More food-aggressive types turn harder toward food
  const foodBias = 1.0 - FOOD_AGRESSION[type] * 0.5; // 0.8 (grazer) to 0.85 (coiler)
  data.targetAngle = normalizeAngle(
    data.targetAngle * foodBias + desiredAngle * (1 - foodBias),
  );
}

// ─── Shared: Set angle to food or wander ────────────────────────────────────

function steerToFood(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
  if (cluster) {
    steerToFoodBias(data, angleTo(hx, hy, cluster.x, cluster.y), data.type);
  } else {
    const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
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
    data.retargetTimer = RETARGET_INTERVAL;
    // Prefer targeting the player
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, score: state.player.score, distSq: 0, angle: state.player.angle } : null;
    if (!target) {
      target = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ);
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
    data.retargetTimer = RETARGET_INTERVAL * 2;
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, distSq: 0, score: state.player.score, angle: state.player.angle } : null;
    if (!target) target = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ);
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

  // Detect if someone is chasing me (behind + approaching)
  let chaserDist = Infinity;
  let chaserId: string | null = null;
  let chaserAngle = 0;
  for (const [id, other] of state.snakes) {
    if (id === snake.id || !other.alive) continue;
    const dx = other.path.headX - hx;
    const dy = other.path.headY - hy;
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
      chaserId = id;
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
    data.retargetTimer = RETARGET_INTERVAL;
    is.watchId = null;
    is.angleChange = 0;
    is.watchTicks = 0;

    // Prefer player, then nearest snake
    let target = state.player?.alive ? { id: state.player.id, x: state.player.path.headX, y: state.player.path.headY, distSq: 0, score: state.player.score, angle: state.player.angle } : null;
    if (!target) target = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ);
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

// ─── Main Update Dispatch ────────────────────────────────────────────────────

const BOT_UPDATERS: Record<BotType, (snake: Snake, data: BotAIData, state: GameState) => void> = {
  predator: updatePredator, coiler: updateCoiler, baiter: updateBaiter,
  interceptor: updateInterceptor, grazer: updateGrazer, trapper: updateTrapper,
};

// ============================================================================
// MAIN LOOP — Called every tick for all bots
// ============================================================================

export function updateAllBotAI(state: GameState): void {
  for (const [id, snake] of state.snakes) {
    if (!snake.isBot || !snake.alive) continue;
    const data = getBotData(id);
    if (!data) continue;

    data.retargetTimer--;
    data.wanderChangeTimer = Math.max(0, data.wanderChangeTimer - 1);

    // ── Layer 1: Survival ──
    const bodyThreat = scanBodyAhead(snake, state.snakes);
    const headOnThreat = !bodyThreat ? checkHeadOnThreat(snake, state.snakes) : null;

    if (bodyThreat && bodyThreat.severity > 0.3) {
      // Evade body: only react when severity > 0.3 (body < 126px away)
      // Use forward bias so evasion is smooth, not jerky
      const flee = bodyThreat.avoidAngle;
      const blend = 0.2 + 0.8 * bodyThreat.severity; // 0.36 at 0.2, ramps to 1.0
      const evaded = normalizeAngle(data.targetAngle * (1 - blend) + flee * blend);
      steerToward(data, evaded, 0.7); // lighter forward bias during evasion
      data.wantBoost = bodyThreat.severity > 0.7;
    } else if (headOnThreat) {
      steerToward(data, headOnThreat.avoidAngle, 0.5); // less bias for head-on (need to turn)
      data.wantBoost = false;
    } else {
      // ── Layer 3: Type Personality ──
      BOT_UPDATERS[data.type](snake, data, state);
    }

    // ── Wall avoidance (distance-proportional, not flat 50/50) ──
    data.targetAngle = wallAvoidAngle(snake.path.headX, snake.path.headY, data.targetAngle, WALL_BOUNDARY);

    // ── Output ──
    snake.targetAngle = data.targetAngle;
  }
}

export function getBotBoost(snakeId: string): boolean {
  return getBotData(snakeId)?.wantBoost ?? false;
}

// ─── Bot Spawning ────────────────────────────────────────────────────────────

let nameCounters: Record<BotType, number> = { predator: 0, coiler: 0, baiter: 0, interceptor: 0, grazer: 0, trapper: 0 };

function pickBotName(type: BotType): string {
  const names = BOT_NAMES[type];
  const idx = nameCounters[type] % names.length;
  nameCounters[type]++;
  return names[idx];
}

function createBotAIData(type: BotType): BotAIData {
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
  return data;
}

/** Find a safe spawn position */
function findBotSpawnPos(state: GameState): { x: number; y: number } {
  const radius = INITIAL_SPAWN_RADIUS * 0.8;
  const SAFE_DIST_SQ = 1000 * 1000;
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 800 + Math.random() * (radius - 800);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    let safe = true;
    for (const [, s] of state.snakes) {
      if (!s.alive) continue;
      if (distSq(x, y, s.path.headX, s.path.headY) < SAFE_DIST_SQ) { safe = false; break; }
    }
    if (safe) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  const d = 1200 + Math.random() * (radius - 1200);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

// ─── Bot Starting Score Tiers ───────────────────────────────────────────────
// Bots spawn with varying scores so the leaderboard looks populated and
// motivating. 13 bots: rank ~1 at 25K, rank ~10 at 3K, rank ~13 at 1.5K.
const BOT_SCORE_TIERS = [
  25000, 22000, 19000, 16000, 13000, 10000, 8000, 6000, 4500, 3000, 2200, 1800, 1500,
];

export function spawnBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const now = Date.now();
  let botIndex = 0;
  const types: BotType[] = ['predator', 'coiler', 'baiter', 'interceptor', 'grazer', 'trapper'];
  const counts = [config.predator, config.coiler, config.baiter, config.interceptor, config.grazer, config.trapper];

  for (let t = 0; t < types.length; t++) {
    for (let i = 0; i < counts[t]; i++) {
      const type = types[t];
      const pos = findBotSpawnPos(state);
      const id = `bot-${type}-${botIndex++}`;
      const name = pickBotName(type);
      const startScore = BOT_SCORE_TIERS[botIndex % BOT_SCORE_TIERS.length] ?? 0;
      const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, type);
      snake.isBot = true;
      snake.isPlayer = false;
      state.snakes.set(id, snake);
      setBotData(id, createBotAIData(type));
    }
  }
}

export function respawnDeadBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const targetCount = config.predator + config.coiler + config.baiter + config.interceptor + config.grazer + config.trapper;
  let aliveBots = 0;
  for (const [, s] of state.snakes) { if (s.isBot && s.alive) aliveBots++; }
  if (aliveBots >= targetCount) return;

  const types: BotType[] = ['predator', 'coiler', 'baiter', 'interceptor', 'grazer', 'trapper'];
  const counts = [config.predator, config.coiler, config.baiter, config.interceptor, config.grazer, config.trapper];
  const alivePerType: Record<BotType, number> = { predator: 0, coiler: 0, baiter: 0, interceptor: 0, grazer: 0, trapper: 0 };
  for (const [id, s] of state.snakes) { if (s.isBot && s.alive) { const data = getBotData(id); if (data) alivePerType[data.type]++; } }

  let bestType: BotType = 'grazer';
  let biggestDeficit = -Infinity;
  for (let t = 0; t < types.length; t++) {
    const deficit = counts[t] - alivePerType[types[t]];
    if (deficit > biggestDeficit) { biggestDeficit = deficit; bestType = types[t]; }
  }

  if (biggestDeficit > 0) {
    const now = Date.now();
    const pos = findBotSpawnPos(state);
    const id = `bot-${bestType}-${Date.now()}`;
    const name = pickBotName(bestType);
    // Respawned bots get a random mid-tier score to stay competitive
    const respawnScore = BOT_SCORE_TIERS[Math.floor(Math.random() * BOT_SCORE_TIERS.length)];
    const snake = createSnakeFn(id, name, respawnScore, pos.x, pos.y, now, bestType);
    snake.isBot = true; snake.isPlayer = false;
    state.snakes.set(id, snake);
    setBotData(id, createBotAIData(bestType));
  }
}

export function removeBot(snakeId: string): void { removeBotData(snakeId); }
