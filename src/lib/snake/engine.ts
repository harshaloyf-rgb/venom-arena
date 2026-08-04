// ============================================================================
// Venom Arena — Snake Engine (Pure Math, Zero-Alloc Hot Path)
// ALL functions are pure. No DOM, no canvas, no side effects.
// Importable by both client (offline-engine) and server (Bun/Node).
//
// Hot path (tickSnakeMovement) uses ZERO allocation:
//   - No object creation ({ x, y }, new Vec2())
//   - No .push(), .filter(), .map() — pre-allocated arrays + for-loops
//   - IPathBuffer (Float32Array-backed) instead of PathPoint[]
//   - Mutates snake state directly, never spreads (...snake)
// ============================================================================

import type {
  Vec2, SnakeState, FoodOrb, StarChip, MapState,
  CollisionResult, DeathEvent, KillCause, FoodSize,
  InputState, IPathBuffer, TurnMetadata, SpiralTurnState, EmoteType,
} from './types';
import type { SnakeConfig } from './config';
import { scratchVec2 } from './pool';

// ── Vector Math ──────────────────────────────────────────────────────────────
// These are pure math utilities, not in the hot path.
// Object creation here is fine — they're used for one-off calculations.

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2DistSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vec2): Vec2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function angleBetween(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Normalize angle to [-PI, PI] */
export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Shortest angular distance from current to target */
export function angleDelta(current: number, target: number): number {
  return normalizeAngle(target - current);
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/** Get max turn rate for a snake given its visual radius and boost state. */
function getMaxTurnRate(visualRadius: number, isBoosting: boolean, config: SnakeConfig): number {
  const thickRange = config.maxThick - config.minThick;
  const thickT = thickRange > 0
    ? Math.max(0, Math.min(1, (visualRadius - config.minThick) / thickRange))
    : 0;
  if (isBoosting) return config.turnBoost;
  return config.turnThin + (config.turnFat - config.turnThin) * thickT;
}

// ── Movement ─────────────────────────────────────────────────────────────────

/**
 * Move snake head forward by one tick.
 * ZERO-ALLOC: mutates snake.head directly.
 */
export function moveHead(
  snake: SnakeState,
  config: SnakeConfig,
  dt: number = 1.0,
): void {
  const speed = snake.boosting ? config.boostSpeed * dt : config.baseSpeed * dt;
  snake.head.x += Math.cos(snake.angle) * speed;
  snake.head.y += Math.sin(snake.angle) * speed;
}

/**
 * Smoothly turn snake toward target angle.
 * Returns the new angle. No allocation.
 */
export function turnToward(
  currentAngle: number,
  targetAngle: number,
  config: SnakeConfig,
  visualRadius: number,
  isBoosting: boolean,
  dt: number = 1.0,
): number {
  const delta = angleDelta(currentAngle, targetAngle);
  if (Math.abs(delta) < 0.001) return currentAngle;

  const turnRate = getMaxTurnRate(visualRadius, isBoosting, config);
  const maxTurn = turnRate * dt;
  if (Math.abs(delta) <= maxTurn) return targetAngle;

  return currentAngle + Math.sign(delta) * maxTurn;
}

// ── Size Calculations ────────────────────────────────────────────────────────

/** Calculate visual radius based on score */
export function calcVisualRadius(
  score: number,
  config: SnakeConfig,
): number {
  const range = config.maxThick - config.baseSize;
  const scoreRange = config.maxLength - config.minLength;
  const t = scoreRange > 0
    ? Math.min(1, Math.max(0, (score - config.minLength) / scoreRange))
    : 0;
  return config.baseSize + range * Math.pow(t, config.growthCurve);
}

/** Calculate collision radius (slightly smaller than visual) */
export function calcCollisionRadius(visualRadius: number): number {
  return visualRadius * 0.85;
}

/** Calculate how many body segments to render */
export function calcSegmentCount(
  score: number,
  config: SnakeConfig,
): number {
  return Math.ceil((score * config.ptsPerSegment) / config.skinSegSpacing);
}

// ── Collision Detection ──────────────────────────────────────────────────────

/** Check if two circles overlap */
export function circlesOverlap(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number,
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distSq = dx * dx + dy * dy;
  const radiusSum = r1 + r2;
  return distSq < radiusSum * radiusSum;
}

/** Check if a point is inside a circle */
export function pointInCircle(
  px: number, py: number,
  cx: number, cy: number,
  r: number,
): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy < r * r;
}

/**
 * Check head-on-body collision using IPathBuffer.
 * First `skipSegs` segments (neck protection) are immune.
 * Returns the index of the hit segment, or -1 if no hit.
 * ZERO-ALLOC: uses getX/getY instead of object indexing.
 */
export function checkHeadOnBody(
  headX: number,
  headY: number,
  headRadius: number,
  bodyPath: IPathBuffer,
  bodyRadius: number,
  skipSegs: number,
  segSpacing: number,
): number {
  const step = Math.max(1, Math.floor(segSpacing / 3));
  const startIdx = skipSegs * step;
  const len = bodyPath.length;
  const rSum = headRadius + bodyRadius;
  const rSumSq = rSum * rSum;

  for (let i = startIdx; i < len; i += step) {
    const dx = headX - bodyPath.getX(i);
    const dy = headY - bodyPath.getY(i);
    if (dx * dx + dy * dy < rSumSq) {
      return i;
    }
  }
  return -1;
}

/**
 * Check head-on-head collision (both die).
 * Returns true if heads overlap.
 */
export function checkHeadOnHead(
  a: SnakeState,
  b: SnakeState,
  aRadius: number,
  bRadius: number,
): boolean {
  return circlesOverlap(a.head.x, a.head.y, aRadius, b.head.x, b.head.y, bRadius);
}

/**
 * Check if a snake has hit the circular map boundary.
 * Returns true if head is outside the boundary.
 */
export function checkBoundaryCollision(
  headX: number,
  headY: number,
  mapCenter: Vec2,
  mapRadius: number,
): boolean {
  const dx = headX - mapCenter.x;
  const dy = headY - mapCenter.y;
  return (dx * dx + dy * dy) > (mapRadius * mapRadius);
}

/**
 * Full collision check for one snake against all others.
 * Uses cached radii where available. ZERO-ALLOC in the loop body.
 */
export function checkAllCollisions(
  snake: SnakeState,
  allSnakes: SnakeState[],
  config: SnakeConfig,
  map: MapState,
): CollisionResult {
  if (!snake.alive || snake.spawnProtected) {
    return { type: 'none', victimId: null, killerId: null, point: null };
  }

  const headRadius = snake._cachedCollisionRadius > 0
    ? snake._cachedCollisionRadius
    : calcCollisionRadius(calcVisualRadius(snake.score, config));

  // Boundary collision (online — circular breathing map)
  if (map.type === 'circular_breathing') {
    if (checkBoundaryCollision(snake.head.x, snake.head.y, map.center, map.currentRadius)) {
      scratchVec2.x = snake.head.x;
      scratchVec2.y = snake.head.y;
      return {
        type: 'boundary',
        victimId: snake.identity.id,
        killerId: null,
        point: { x: scratchVec2.x, y: scratchVec2.y },
      };
    }
  }

  const snakeId = snake.identity.id;

  for (let s = 0; s < allSnakes.length; s++) {
    const other = allSnakes[s];
    if (other.identity.id === snakeId) continue;
    if (!other.alive) continue;

    const otherRadius = other._cachedCollisionRadius > 0
      ? other._cachedCollisionRadius
      : calcCollisionRadius(calcVisualRadius(other.score, config));

    // Head-on-head
    if (checkHeadOnHead(snake, other, headRadius, otherRadius)) {
      scratchVec2.x = (snake.head.x + other.head.x) * 0.5;
      scratchVec2.y = (snake.head.y + other.head.y) * 0.5;
      return {
        type: 'head_on_head',
        victimId: snakeId,
        killerId: other.identity.id,
        point: { x: scratchVec2.x, y: scratchVec2.y },
      };
    }

    // Head-on-body: current snake's head vs other's body
    const hitIdx = checkHeadOnBody(
      snake.head.x, snake.head.y, headRadius,
      other.path, otherRadius, config.skipSegs, config.segSpacing,
    );
    if (hitIdx >= 0) {
      scratchVec2.x = other.path.getX(hitIdx);
      scratchVec2.y = other.path.getY(hitIdx);
      return {
        type: 'head_on_body',
        victimId: snakeId,
        killerId: other.identity.id,
        point: { x: scratchVec2.x, y: scratchVec2.y },
      };
    }
  }

  return { type: 'none', victimId: null, killerId: null, point: null };
}

// ── Food ─────────────────────────────────────────────────────────────────────

/** Generate a random food orb. Not in hot path. */
export function createFoodOrb(
  id: string,
  x: number,
  y: number,
  config: SnakeConfig,
): FoodOrb {
  const roll = Math.random();
  let size: FoodSize;
  let value: number;
  let radius: number;
  let color: string;

  if (roll < config.foodSmallChance) {
    size = 'small';
    value = config.foodSmallValue;
    radius = config.foodSmallRadius;
    color = '#66FF66';
  } else if (roll < config.foodSmallChance + config.foodMedChance) {
    size = 'medium';
    value = config.foodMedValue;
    radius = config.foodMedRadius;
    color = '#3498DB';
  } else {
    size = 'large';
    value = config.foodLargeValue;
    radius = config.foodLargeRadius;
    color = '#FF69B4';
  }

  return { id, x, y, size, value, radius, color };
}

/**
 * Check if snake head eats a food orb.
 * ZERO-ALLOC: inlines distance math, no vec2Dist call.
 */
export function checkFoodEat(
  snake: SnakeState,
  food: FoodOrb,
  config: SnakeConfig,
): boolean {
  const vr = snake._cachedVisualRadius > 0
    ? snake._cachedVisualRadius
    : calcVisualRadius(snake.score, config);
  const threshold = vr + config.eatRadius + food.radius;
  const dx = snake.head.x - food.x;
  const dy = snake.head.y - food.y;
  const distSq = dx * dx + dy * dy;
  return distSq < threshold * threshold;
}

/**
 * Calculate death food drops from a snake's body.
 * Uses IPathBuffer for zero-alloc reads. Death is infrequent.
 */
export function calcDeathFood(
  snake: SnakeState,
  config: SnakeConfig,
): FoodOrb[] {
  const bodyLength = snake.path.length;
  const maxOrbs = config.deathDropMaxOrbs;

  let largeCount = Math.floor(bodyLength / 5);
  let medCount = Math.floor(bodyLength / 3) - largeCount;
  let smallCount = bodyLength - largeCount - medCount;

  largeCount = Math.floor(largeCount * config.deathDropLargeChance);
  medCount = Math.floor(medCount * config.deathDropMedChance);

  const total = largeCount + medCount + smallCount;
  if (total === 0) return [];

  const scale = total > maxOrbs ? maxOrbs / total : 1;
  largeCount = Math.floor(largeCount * scale);
  medCount = Math.floor(medCount * scale);
  smallCount = Math.floor(smallCount * scale);

  const finalTotal = largeCount + medCount + smallCount;
  if (finalTotal === 0) return [];

  const orbs: FoodOrb[] = [];
  const dropSpacing = Math.max(1, Math.floor(bodyLength / finalTotal));
  const spread = config.dropSpread;
  const snakeId = snake.identity.id;
  let orbIdx = 0;

  for (let i = 0; i < bodyLength && orbIdx < finalTotal; i += dropSpacing) {
    const px = snake.path.getX(i);
    const py = snake.path.getY(i);
    const id = `death-${snakeId}-${orbIdx}`;

    let size: FoodSize;
    let value: number;
    let radius: number;
    let color: string;

    if (orbIdx < largeCount) {
      size = 'large'; value = config.foodLargeValue; radius = config.foodLargeRadius; color = '#FF69B4';
    } else if (orbIdx < largeCount + medCount) {
      size = 'medium'; value = config.foodMedValue; radius = config.foodMedRadius; color = '#3498DB';
    } else {
      size = 'small'; value = config.foodSmallValue; radius = config.foodSmallRadius; color = '#66FF66';
    }

    orbs.push({
      id,
      x: px + (Math.random() - 0.5) * spread,
      y: py + (Math.random() - 0.5) * spread,
      size, value, radius, color,
    });
    orbIdx++;
  }

  return orbs;
}

// ── Star Chips (Online Only) ─────────────────────────────────────────────────

/** Create star chips dropped on player death. Infrequent operation. */
export function createDeathStars(
  snake: SnakeState,
  config: SnakeConfig,
): StarChip[] {
  if (snake.carriedChips <= 0) return [];

  const count = config.starsPerDeath;
  const valuePerStar = Math.floor(snake.carriedChips / count);
  const spread = 60;
  const stars: StarChip[] = [];
  const snakeId = snake.identity.id;
  const hx = snake.head.x;
  const hy = snake.head.y;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    stars.push({
      id: `star-${snakeId}-${i}`,
      x: hx + Math.cos(angle) * spread,
      y: hy + Math.sin(angle) * spread,
      value: valuePerStar,
      phaseOffset: Math.random() * Math.PI * 2,
    });
  }

  return stars;
}

/** Check if snake head collects a star chip. Infrequent operation. */
export function checkStarCollect(
  snake: SnakeState,
  star: StarChip,
  config: SnakeConfig,
): boolean {
  const vr = snake._cachedVisualRadius > 0
    ? snake._cachedVisualRadius
    : calcVisualRadius(snake.score, config);
  const dx = snake.head.x - star.x;
  const dy = snake.head.y - star.y;
  const threshold = vr + 20;
  return dx * dx + dy * dy < threshold * threshold;
}

// ── Map ──────────────────────────────────────────────────────────────────────

/** Calculate the base map radius based on player count. */
export function calcBaseMapRadius(
  playerCount: number,
  config: SnakeConfig,
): number {
  const range = config.mapMaxRadius - config.mapMinRadius;
  const t = Math.min(1, playerCount / config.maxArenaPlayers);
  return config.mapMinRadius + range * t;
}

/** Calculate breathing map radius at a given time. */
export function calcBreathingRadius(
  baseRadius: number,
  timeSeconds: number,
  config: SnakeConfig,
): number {
  const phase = (timeSeconds / config.breathingPeriodSeconds) * Math.PI * 2;
  return baseRadius + Math.sin(phase) * config.breathingAmplitude;
}

/** Update map state for breathing. */
export function updateMapState(
  map: MapState,
  elapsedSeconds: number,
  config: SnakeConfig,
): MapState {
  if (map.type !== 'circular_breathing') return map;

  const currentRadius = calcBreathingRadius(map.baseRadius, elapsedSeconds, config);
  return {
    ...map,
    currentRadius,
    breathingPhase: (elapsedSeconds / config.breathingPeriodSeconds) * Math.PI * 2,
  };
}

// ── Extraction ───────────────────────────────────────────────────────────────

/** Calculate commission rate based on real player count. */
export function calcCommissionRate(realPlayerCount: number): number {
  return realPlayerCount >= 4 ? 0.35 : 0;
}

/** Calculate banked amount after commission. */
export function calcBankedAmount(carriedChips: number, commissionRate: number): number {
  return Math.floor(carriedChips * (1 - commissionRate));
}

// ── Boost Drain ──────────────────────────────────────────────────────────────

/**
 * Process boost drain for one tick.
 * ZERO-ALLOC: mutates snake.score directly. Returns void.
 */
export function processBoostDrain(
  snake: SnakeState,
  config: SnakeConfig,
  frameCount: number,
): void {
  if (!snake.boosting || snake.score <= config.boostMinScore) {
    return;
  }

  const drainPerTick = config.scoreDrainPerSec / config.tickRateHz;
  snake.score = Math.max(config.boostMinScore, snake.score - drainPerTick);

  // If score drops to minimum, stop boosting
  if (snake.score <= config.boostMinScore) {
    snake.boosting = false;
  }
}

// ── Spawn Protection ─────────────────────────────────────────────────────────

/**
 * Decrement spawn protection. Mutates snake directly.
 */
export function tickSpawnProtection(snake: SnakeState): void {
  if (snake.spawnProtectionFrames <= 0) return;
  const remaining = snake.spawnProtectionFrames - 1;
  snake.spawnProtectionFrames = remaining;
  snake.spawnProtected = remaining > 0;
}

// ── Emotes ───────────────────────────────────────────────────────────────────

/**
 * Set an emote on a snake. Mutates snake directly.
 * Default 4 seconds at 30fps = 120 frames.
 */
export function setEmote(
  snake: SnakeState,
  emote: EmoteType | null,
  frames: number = 120,
): void {
  snake.activeEmote = emote;
  snake.emoteFramesLeft = emote ? frames : 0;
}

/**
 * Tick emote countdown. Mutates snake directly.
 */
export function tickEmote(snake: SnakeState): void {
  if (snake.emoteFramesLeft <= 0) {
    snake.activeEmote = null;
    snake.emoteFramesLeft = 0;
    return;
  }
  snake.emoteFramesLeft--;
  if (snake.emoteFramesLeft <= 0) {
    snake.activeEmote = null;
    snake.emoteFramesLeft = 0;
  }
}

// ── Death Processing ─────────────────────────────────────────────────────────

/** Create a DeathEvent from a collision result. Infrequent operation. */
export function createDeathEvent(
  snake: SnakeState,
  killerId: string | null,
  cause: KillCause,
  config: SnakeConfig,
): DeathEvent {
  const isCollisionDeath = cause !== 'wall' && cause !== 'boundary';

  return {
    snakeId: snake.identity.id,
    killerId,
    cause,
    position: { x: snake.head.x, y: snake.head.y },
    droppedFood: isCollisionDeath ? calcDeathFood(snake, config) : [],
    droppedStars: createDeathStars(snake, config),
    timestamp: Date.now(),
  };
}

// ── XP Calculation ───────────────────────────────────────────────────────────

/** Calculate XP gained from a match. */
export function calcXP(
  score: number,
  kills: number,
  rewardMultiplier: number,
  isOffline: boolean,
): number {
  if (isOffline) return 0;
  return Math.floor((score * 5 + kills * 50) * rewardMultiplier);
}

/** Calculate new level from XP. */
export function calcNewLevel(totalXP: number): number {
  return Math.floor(totalXP / 200) + 1;
}

// ── Cached Radii ─────────────────────────────────────────────────────────────

/**
 * Update _cachedVisualRadius and _cachedCollisionRadius on a snake.
 * Call when score changes. Zero-alloc.
 */
export function updateCachedRadii(snake: SnakeState, config: SnakeConfig): void {
  const vr = calcVisualRadius(snake.score, config);
  snake._cachedVisualRadius = vr;
  snake._cachedCollisionRadius = calcCollisionRadius(vr);
}

// ── Fibonacci Spiral Turn System ─────────────────────────────────────────────
//
// Logarithmic spiral: r = a * e^(b * theta)
//   - a = distance from pivot to head at spiral entry
//   - b = spiral parameter (negative for inward spiral when theta advances)
//   - theta advances each tick by spiralThetaStep
//   - Head is at the innermost point (smallest r), tail fans outward
//
// The tangent angle at any theta on the spiral is: theta + phi0 + atan2(1, b)
// where phi0 = entryAngle - atan2(1, b), so tangent simplifies to theta + entryAngle.

/**
 * Detect if the snake should enter spiral mode.
 * Returns true when turn sharpness (|desired delta| / max turn rate) < threshold.
 */
export function detectTightTurn(snake: SnakeState, config: SnakeConfig): boolean {
  const vr = snake._cachedVisualRadius > 0
    ? snake._cachedVisualRadius
    : calcVisualRadius(snake.score, config);
  const maxTurn = getMaxTurnRate(vr, snake.boosting, config);
  if (maxTurn === 0) return false;
  const desiredDelta = Math.abs(angleDelta(snake.angle, snake.targetAngle));
  const sharpness = desiredDelta / maxTurn;
  return sharpness < config.tightTurnThreshold;
}

/**
 * Enter spiral mode: compute pivot, set spiral parameters on snake.
 * ZERO-ALLOC: writes to snake.spiral directly.
 */
export function enterSpiralMode(snake: SnakeState, config: SnakeConfig): void {
  const turnDelta = angleDelta(snake.angle, snake.targetAngle);
  const turnDir = turnDelta >= 0 ? 1 : -1;

  // 'a' = distance from pivot to head. Larger = wider spiral loops.
  const vr = snake._cachedVisualRadius > 0
    ? snake._cachedVisualRadius
    : calcVisualRadius(snake.score, config);
  const a = vr * 3.0;

  // spiralB sign encodes turn direction:
  //   negative b → theta increases → CW on screen (right turn)
  //   positive b → theta decreases → CCW on screen (left turn)
  const b = -turnDir * config.spiralTightness;

  // Angular offset so tangent at theta=0 matches entryAngle
  // phi0 = entryAngle - atan2(1, b)
  const phi0 = snake.angle - Math.atan2(1, b);

  // Pivot = head position - a * (cos(phi0), sin(phi0))
  const pivotX = snake.head.x - a * Math.cos(phi0);
  const pivotY = snake.head.y - a * Math.sin(phi0);

  const speed = snake.boosting ? config.boostSpeed : config.baseSpeed;

  snake.spiral = {
    active: true,
    pivotX,
    pivotY,
    entryAngle: snake.angle,
    entrySpeed: speed,
    startTheta: 0,
    currentTheta: 0,
    spiralA: a,
    spiralB: b,
    startTick: 0, // caller should set this
  };
}

/**
 * Advance the spiral by one tick.
 * Updates snake.head.x, snake.head.y, snake.angle.
 * ZERO-ALLOC.
 */
export function advanceSpiral(
  snake: SnakeState,
  config: SnakeConfig,
  _tickCount: number,
): void {
  const s = snake.spiral!;

  // Theta advancement direction: negative b → increase theta, positive b → decrease
  const dir = s.spiralB < 0 ? 1 : -1;
  s.currentTheta += dir * config.spiralThetaStep;

  const theta = s.currentTheta;
  const b = s.spiralB;
  const a = s.spiralA;

  // phi0 = entryAngle - atan2(1, b) — recompute (cheap: one atan2)
  const phi0 = s.entryAngle - Math.atan2(1, b);

  // Position on spiral
  const r = a * Math.exp(b * theta);
  const polarAngle = theta + phi0;

  snake.head.x = s.pivotX + r * Math.cos(polarAngle);
  snake.head.y = s.pivotY + r * Math.sin(polarAngle);

  // Tangent angle simplifies to: theta + entryAngle
  snake.angle = theta + s.entryAngle;
}

/**
 * Exit spiral mode. Clear spiral state on snake.
 * Sets targetAngle to current facing angle for smooth transition.
 */
export function exitSpiral(snake: SnakeState): void {
  if (snake.spiral) {
    // Smooth transition: target continues in current direction
    snake.targetAngle = snake.angle;
  }
  snake.spiral = null;
}

/**
 * Build TurnMetadata for client-side 60fps extrapolation.
 * Only called when broadcasting snapshots (not in hot tick loop).
 */
export function buildTurnMetadata(
  snake: SnakeState,
  tickCount: number,
): TurnMetadata {
  const sp = snake.spiral;
  if (!sp) {
    return {
      isInSpiral: false,
      pivotX: 0,
      pivotY: 0,
      spiralA: 0,
      spiralB: 0,
      currentTheta: 0,
      entryAngle: 0,
      entrySpeed: 0,
      headX: snake.head.x,
      headY: snake.head.y,
      headAngle: snake.angle,
      isBoosting: snake.boosting,
      visualRadius: snake._cachedVisualRadius,
      score: snake.score,
      tick: tickCount,
    };
  }

  return {
    isInSpiral: true,
    pivotX: sp.pivotX,
    pivotY: sp.pivotY,
    spiralA: sp.spiralA,
    spiralB: sp.spiralB,
    currentTheta: sp.currentTheta,
    entryAngle: sp.entryAngle,
    entrySpeed: sp.entrySpeed,
    headX: snake.head.x,
    headY: snake.head.y,
    headAngle: snake.angle,
    isBoosting: snake.boosting,
    visualRadius: snake._cachedVisualRadius,
    score: snake.score,
    tick: tickCount,
  };
}

// ── Main Hot Path ────────────────────────────────────────────────────────────

/**
 * tickSnakeMovement — THE hot path function.
 * Handles per-tick snake updates with ZERO allocation:
 *   1. Turning (normal or spiral)
 *   2. Movement (head position)
 *   3. Path extension (prepend + trim)
 *   4. Boost drain
 *   5. Spawn protection
 *   6. Emote tick
 *   7. Cached radii update
 *
 * Returns a bitmask of side effects the caller must handle:
 *   bit 0 (1): should drop boost food from tail this tick
 *   bit 1 (2): score changed (radii need recalc for snapshots)
 */
export function tickSnakeMovement(
  snake: SnakeState,
  input: InputState,
  config: SnakeConfig,
  tickCount: number,
): number {
  let flags = 0;

  // ── 1. Update target angle from input ────────────────────────────────────
  snake.targetAngle = input.targetAngle;
  snake.boosting = input.boosting && snake.score > config.boostMinScore;

  // ── 2. Normal turning (spiral system disabled — detection logic needs full rework) ──
  const vr = snake._cachedVisualRadius > 0
    ? snake._cachedVisualRadius
    : calcVisualRadius(snake.score, config);
  snake.angle = turnToward(
    snake.angle, snake.targetAngle, config, vr, snake.boosting,
  );

  // Normal movement
  moveHead(snake, config, 1.0);

  // ── 3. Extend path: prepend new head, trim tail ───────────────────────────
  snake.path.prepend(snake.head.x, snake.head.y, snake.angle);

  const maxPoints = Math.ceil((snake.score * config.ptsPerSegment) / config.segSpacing);
  if (snake.path.length > maxPoints) {
    snake.path.trimTail(snake.path.length - maxPoints);
  }

  // ── 4. Boost drain ────────────────────────────────────────────────────────
  const prevScore = snake.score;
  if (snake.boosting) {
    processBoostDrain(snake, config, tickCount);
    flags |= (tickCount % config.boostDropEveryNFrames === 0) ? 1 : 0;
  }
  if (snake.score !== prevScore) {
    flags |= 2;
  }

  // ── 5. Spawn protection ──────────────────────────────────────────────────
  tickSpawnProtection(snake);

  // ── 6. Emote ──────────────────────────────────────────────────────────────
  if (input.emoteKey !== null) {
    const emoteMap: Record<number, EmoteType> = {
      1: 'gg', 2: 'target', 3: 'flee', 4: 'ripped', 5: 'extracting',
    };
    const emote = emoteMap[input.emoteKey];
    if (emote) setEmote(snake, emote);
  }
  tickEmote(snake);

  // ── 7. Cached radii ───────────────────────────────────────────────────────
  updateCachedRadii(snake, config);

  return flags;
}
