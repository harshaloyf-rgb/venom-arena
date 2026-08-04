// ============================================================================
// Venom Arena — Snake Engine (Pure Math)
// ALL functions are pure. No DOM, no canvas, no side effects.
// Importable by both client (offline-engine) and server (game-server).
// ============================================================================

import type {
  Vec2, PathPoint, SnakeState, FoodOrb, StarChip, MapState,
  CollisionResult, DeathEvent, KillCause, FoodSize,
} from './types';
import type { SnakeConfig } from './config';

// ── Vector Math ──────────────────────────────────────────────────────────────

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

// ── Movement ─────────────────────────────────────────────────────────────────

/** Move snake head forward by one tick */
export function moveHead(
  snake: SnakeState,
  config: SnakeConfig,
  dt: number, // 1.0 for normal tick
): Vec2 {
  const speed = snake.boosting ? config.boostSpeed * dt : config.baseSpeed * dt;
  return {
    x: snake.head.x + Math.cos(snake.angle) * speed,
    y: snake.head.y + Math.sin(snake.angle) * speed,
  };
}

/** Smoothly turn snake toward target angle */
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

  // Turn rate depends on thickness (thin = fast, fat = slow)
  const thickRange = config.maxThick - config.minThick;
  const thickT = thickRange > 0
    ? Math.max(0, Math.min(1, (visualRadius - config.minThick) / thickRange))
    : 0;

  let turnRate: number;
  if (isBoosting) {
    turnRate = config.turnBoost;
  } else {
    turnRate = config.turnThin + (config.turnFat - config.turnThin) * thickT;
  }

  const maxTurn = turnRate * dt;
  if (Math.abs(delta) <= maxTurn) return targetAngle;

  return currentAngle + Math.sign(delta) * maxTurn;
}

// ── Body Path Management ─────────────────────────────────────────────────────

/** Build initial body path for a newly spawned snake */
export function buildInitialPath(
  headX: number,
  headY: number,
  angle: number,
  bodyLength: number,
  spacing: number,
): PathPoint[] {
  const count = Math.ceil(bodyLength / spacing);
  const path: PathPoint[] = [];
  for (let i = 0; i < count; i++) {
    path.push({
      x: headX - Math.cos(angle) * i * spacing,
      y: headY - Math.sin(angle) * i * spacing,
      angle,
    });
  }
  return path;
}

/** Extend path: add new head, trim tail to maintain target length */
export function extendPath(
  path: PathPoint[],
  newHead: Vec2,
  angle: number,
  targetScore: number,
  config: SnakeConfig,
): PathPoint[] {
  // Prepend new head
  const newPath: PathPoint[] = [
    { x: newHead.x, y: newHead.y, angle },
    ...path,
  ];

  // Trim to target length
  const maxPoints = Math.ceil((targetScore * config.ptsPerSegment) / config.segSpacing);
  if (newPath.length > maxPoints) {
    return newPath.slice(0, maxPoints);
  }
  return newPath;
}

/** Sample path points at even spacing for rendering */
export function sampleSegments(
  path: PathPoint[],
  spacing: number,
  count: number,
): PathPoint[] {
  if (path.length === 0) return [];
  if (count <= 0) return [];

  const result: PathPoint[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(Math.floor(i * spacing), path.length - 1);
    result.push(path[idx]);
  }
  return result;
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
 * Check head-on-body collision.
 * First `skipSegs` segments (neck protection) are immune.
 * Returns the index of the hit segment, or -1 if no hit.
 */
export function checkHeadOnBody(
  headX: number,
  headY: number,
  headRadius: number,
  bodyPath: PathPoint[],
  bodyRadius: number,
  skipSegs: number,
  segSpacing: number,
): number {
  const step = Math.max(1, Math.floor(segSpacing / 3)); // Check every ~3px
  for (let i = skipSegs * step; i < bodyPath.length; i += step) {
    const seg = bodyPath[i];
    if (circlesOverlap(headX, headY, headRadius, seg.x, seg.y, bodyRadius)) {
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
 * Returns CollisionResult with victim/killer IDs.
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

  const headRadius = calcCollisionRadius(calcVisualRadius(snake.score, config));

  // Check boundary collision (online only — circular breathing map)
  if (map.type === 'circular_breathing') {
    if (checkBoundaryCollision(snake.head.x, snake.head.y, map.center, map.currentRadius)) {
      return {
        type: 'boundary',
        victimId: snake.identity.id,
        killerId: null,
        point: { x: snake.head.x, y: snake.head.y },
      };
    }
  }

  // Check against other snakes
  for (const other of allSnakes) {
    if (other.identity.id === snake.identity.id) continue;
    if (!other.alive) continue;

    const otherRadius = calcCollisionRadius(calcVisualRadius(other.score, config));

    // Head-on-head (both die — but we only report current snake as victim)
    if (checkHeadOnHead(snake, other, headRadius, otherRadius)) {
      return {
        type: 'head_on_head',
        victimId: snake.identity.id,
        killerId: other.identity.id,
        point: {
          x: (snake.head.x + other.head.x) / 2,
          y: (snake.head.y + other.head.y) / 2,
        },
      };
    }

    // Head-on-body (current snake's head hits other's body)
    const hitIdx = checkHeadOnBody(
      snake.head.x, snake.head.y, headRadius,
      other.path, otherRadius, config.skipSegs, config.segSpacing,
    );
    if (hitIdx >= 0) {
      const hitPoint = other.path[hitIdx];
      return {
        type: 'head_on_body',
        victimId: snake.identity.id,
        killerId: other.identity.id,
        point: { x: hitPoint.x, y: hitPoint.y },
      };
    }
  }

  return { type: 'none', victimId: null, killerId: null, point: null };
}

// ── Food ─────────────────────────────────────────────────────────────────────

/** Generate a random food orb */
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

/** Check if snake head eats a food orb */
export function checkFoodEat(
  snake: SnakeState,
  food: FoodOrb,
  config: SnakeConfig,
): boolean {
  const headRadius = calcVisualRadius(snake.score, config);
  return vec2Dist(snake.head, food) < headRadius + config.eatRadius + food.radius;
}

/**
 * Calculate death food drops from a snake's body.
 * Large: L ÷ 5, Medium: M ÷ 3, Small: remainder
 */
export function calcDeathFood(
  snake: SnakeState,
  config: SnakeConfig,
): FoodOrb[] {
  const bodyLength = Math.floor(snake.path.length);
  const maxOrbs = config.deathDropMaxOrbs;

  let largeCount = Math.floor(bodyLength / 5);
  let medCount = Math.floor(bodyLength / 3) - largeCount;
  let smallCount = bodyLength - largeCount - medCount;

  // Apply death drop chances
  largeCount = Math.floor(largeCount * config.deathDropLargeChance);
  medCount = Math.floor(medCount * config.deathDropMedChance);
  // Small = remainder (not capped by chance)

  const total = largeCount + medCount + smallCount;
  if (total === 0) return [];

  // Cap total
  const scale = total > maxOrbs ? maxOrbs / total : 1;
  largeCount = Math.floor(largeCount * scale);
  medCount = Math.floor(medCount * scale);
  smallCount = Math.floor(smallCount * scale);

  const orbs: FoodOrb[] = [];
  let orbIdx = 0;
  const dropSpacing = Math.max(1, Math.floor(bodyLength / (largeCount + medCount + smallCount)));

  for (let i = 0; i < bodyLength; i += dropSpacing) {
    if (orbIdx >= largeCount + medCount + smallCount) break;
    const pt = snake.path[i];
    const id = `death-${snake.identity.id}-${orbIdx}`;

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

    // Spread food around the path point
    const spread = config.dropSpread;
    orbs.push({
      id,
      x: pt.x + (Math.random() - 0.5) * spread,
      y: pt.y + (Math.random() - 0.5) * spread,
      size, value, radius, color,
    });
    orbIdx++;
  }

  return orbs;
}

// ── Star Chips (Online Only) ─────────────────────────────────────────────────

/**
 * Create star chips dropped on player death.
 * Always 10 stars. Value = carriedChips / 10 per star.
 * Only dropped if player had carried chips.
 */
export function createDeathStars(
  snake: SnakeState,
  config: SnakeConfig,
): StarChip[] {
  if (snake.carriedChips <= 0) return [];

  const count = config.starsPerDeath; // 10
  const valuePerStar = Math.floor(snake.carriedChips / count);
  const spread = 60;
  const stars: StarChip[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    stars.push({
      id: `star-${snake.identity.id}-${i}`,
      x: snake.head.x + Math.cos(angle) * spread,
      y: snake.head.y + Math.sin(angle) * spread,
      value: valuePerStar,
      phaseOffset: Math.random() * Math.PI * 2,
    });
  }

  return stars;
}

/** Check if snake head collects a star chip */
export function checkStarCollect(
  snake: SnakeState,
  star: StarChip,
  config: SnakeConfig,
): boolean {
  const headRadius = calcVisualRadius(snake.score, config);
  return vec2Dist(snake.head, star) < headRadius + 20; // 20px star radius
}

// ── Map ──────────────────────────────────────────────────────────────────────

/**
 * Calculate the base map radius based on player count.
 * Scales linearly between mapMinRadius (1 player) and mapMaxRadius (1000 players).
 */
export function calcBaseMapRadius(
  playerCount: number,
  config: SnakeConfig,
): number {
  const range = config.mapMaxRadius - config.mapMinRadius;
  const t = Math.min(1, playerCount / config.maxArenaPlayers);
  return config.mapMinRadius + range * t;
}

/**
 * Calculate breathing map radius at a given time.
 * Oscillates ±breathingAmplitude around baseRadius with given period.
 */
export function calcBreathingRadius(
  baseRadius: number,
  timeSeconds: number,
  config: SnakeConfig,
): number {
  const phase = (timeSeconds / config.breathingPeriodSeconds) * Math.PI * 2;
  return baseRadius + Math.sin(phase) * config.breathingAmplitude;
}

/** Update map state for breathing */
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

/**
 * Calculate commission rate based on real player count.
 * 0% if ≤3 real players, 35% if ≥4.
 */
export function calcCommissionRate(realPlayerCount: number): number {
  return realPlayerCount >= 4 ? 0.35 : 0;
}

/**
 * Calculate banked amount after commission.
 */
export function calcBankedAmount(carriedChips: number, commissionRate: number): number {
  return Math.floor(carriedChips * (1 - commissionRate));
}

// ── Boost Drain ──────────────────────────────────────────────────────────────

/**
 * Process boost drain for one tick.
 * Returns { newScore, shouldDropFood }.
 */
export function processBoostDrain(
  snake: SnakeState,
  config: SnakeConfig,
  frameCount: number,
): { newScore: number; shouldDropFood: boolean } {
  if (!snake.boosting || snake.score <= config.boostMinScore) {
    return { newScore: snake.score, shouldDropFood: false };
  }

  const drainPerTick = config.scoreDrainPerSec / config.tickRateHz;
  const newScore = Math.max(config.boostMinScore, snake.score - drainPerTick);

  // Drop tail food every N frames
  const shouldDropFood = frameCount % config.boostDropEveryNFrames === 0;

  return { newScore, shouldDropFood };
}

// ── Spawn Protection ─────────────────────────────────────────────────────────

/** Decrement spawn protection. Returns updated snake. */
export function tickSpawnProtection(snake: SnakeState): SnakeState {
  if (snake.spawnProtectionFrames <= 0) return snake;
  const remaining = snake.spawnProtectionFrames - 1;
  return {
    ...snake,
    spawnProtected: remaining > 0,
    spawnProtectionFrames: remaining,
  };
}

// ── Emotes ───────────────────────────────────────────────────────────────────

/** Set an emote on a snake (4 seconds at 30fps = 120 frames) */
export function setEmote(
  snake: SnakeState,
  emote: import('./types').EmoteType | null,
  frames: number = 120,
): SnakeState {
  return {
    ...snake,
    activeEmote: emote,
    emoteFramesLeft: emote ? frames : 0,
  };
}

/** Tick emote countdown */
export function tickEmote(snake: SnakeState): SnakeState {
  if (snake.emoteFramesLeft <= 0) {
    return { ...snake, activeEmote: null, emoteFramesLeft: 0 };
  }
  return {
    ...snake,
    emoteFramesLeft: snake.emoteFramesLeft - 1,
    activeEmote: snake.emoteFramesLeft - 1 > 0 ? snake.activeEmote : null,
  };
}

// ── Death Processing ─────────────────────────────────────────────────────────

/** Create a DeathEvent from a collision result */
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

// ── XP Calculation (for match result) ────────────────────────────────────────

/**
 * Calculate XP gained from a match.
 * Formula: floor((score * 5 + kills * 50) * rewardMultiplier)
 * Returns 0 for offline/practice matches.
 */
export function calcXP(
  score: number,
  kills: number,
  rewardMultiplier: number,
  isOffline: boolean,
): number {
  if (isOffline) return 0;
  return Math.floor((score * 5 + kills * 50) * rewardMultiplier);
}

/**
 * Calculate new level from XP.
 * Formula: xpForLevel(N) = (N-1) * 200
 */
export function calcNewLevel(totalXP: number): number {
  // Find highest N where (N-1)*200 <= totalXP
  return Math.floor(totalXP / 200) + 1;
}
