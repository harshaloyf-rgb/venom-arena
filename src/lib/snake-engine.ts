// ============================================================================
// snake-engine.ts — Pure snake logic module.
// ---------------------------------------------------------------------------
// Shared between game-server (online) and offline-engine (practice).
// All values are driven by a config object (from DB / admin panel).
// ============================================================================

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** Config object — all tunable game parameters. Loaded from DB. */
export interface SnakeConfig {
  // Snake physics
  collisionRadius: number;      // hitbox radius for body segments
  visualRadius: number;         // render radius for body segments
  segmentSpacing: number;       // center-to-center distance between segments
  baseSpeed: number;            // normal move speed (px/tick)
  boostSpeed: number;           // speed while boosting
  turnBase: number;             // base turn rate (rad/tick)
  turnMin: number;              // minimum turn rate at high score
  turnScoreFactor: number;      // how much score reduces turn rate
  initialBodyLength: number;    // starting segments at spawn
  initialSpawnScore: number;    // starting score

  // Growth
  maxSegments: number;          // hard cap on body length
  lengthLogFactor: number;      // controls length growth curve
  maxExtraRadius: number;       // max additional thickness beyond base visual
  thicknessLogFactor: number;   // controls thickness growth curve

  // Boost
  boostMinLength: number;       // min segments to activate boost
  boostDropInterval: number;    // frames between tail drops while boosting

  // Collision
  hitFactor: number;            // body collision multiplier (0-1)
  headOnHitFactor: number;      // head-on collision multiplier (0-1)
  neckAngleThreshold: number;   // angle threshold for neck protection (degrees)
  neckSegmentCount: number;     // number of neck segments to check

  // Food
  foodSmallValue: number;
  foodSmallRadius: number;
  foodSmallWeight: number;
  foodMediumValue: number;
  foodMediumRadius: number;
  foodMediumWeight: number;
  foodLargeValue: number;
  foodLargeRadius: number;
  foodLargeWeight: number;
  foodCountTarget: number;
  starDropCount: number;

  // Extraction
  extractionDurationMs: number;
  extractionGlideSpeed: number;

  // Spawning
  spawnSafeDistance: number;
  spawnBoundaryMargin: number;
  spawnSafeAttempts: number;
  spawnProtectionMs: number;

  // Map
  mapMinRadius: number;
  mapMaxRadius: number;
  mapBreathAmplitude: number;
  mapBreathCycleMs: number;

  // Bots
  botSelfDestructThreshold: number;
  botEvadeRadius: number;
  botFoodScanRadius: number;

  // Economy
  commissionThreshold: number;
  commissionRate: number;
}

/** Skin definition — a repeating pattern applied to body segments. */
export interface SkinSegment {
  color: string;
  glow?: string;
  glowRadius?: number;
}

export interface SnakeSkin {
  id: string;
  name: string;
  body: SkinSegment[];   // repeating pattern
  headColor: string;     // head always uses this
  headEyeColor?: string;
}

/** Computed visual properties for a snake at a given score. */
export interface SnakeMetrics {
  bodyLength: number;         // total segments
  visualRadius: number;       // render radius per segment
  collisionRadius: number;    // hitbox radius per segment
  turnRate: number;           // current turn rate (rad/tick)
  speed: number;              // current speed (px/tick)
}

// ----------------------------------------------------------------------------
// Default config — used as fallback if DB is not available.
// Matches the seed values in game-config-db.ts.
// ----------------------------------------------------------------------------

export const DEFAULT_SNAKE_CONFIG: SnakeConfig = {
  collisionRadius: 6,
  visualRadius: 8,
  segmentSpacing: 16,
  baseSpeed: 4.5,
  boostSpeed: 8.0,
  turnBase: 0.35,
  turnMin: 0.08,
  turnScoreFactor: 0.0003,
  initialBodyLength: 20,
  initialSpawnScore: 20,
  maxSegments: 200,
  lengthLogFactor: 20,
  maxExtraRadius: 3,
  thicknessLogFactor: 0.5,
  boostMinLength: 8,
  boostDropInterval: 10,
  hitFactor: 0.75,
  headOnHitFactor: 0.8,
  neckAngleThreshold: 60,
  neckSegmentCount: 5,
  foodSmallValue: 1,
  foodSmallRadius: 3,
  foodSmallWeight: 0.93,
  foodMediumValue: 3,
  foodMediumRadius: 5,
  foodMediumWeight: 0.04,
  foodLargeValue: 5,
  foodLargeRadius: 8,
  foodLargeWeight: 0.03,
  foodCountTarget: 1200,
  starDropCount: 10,
  extractionDurationMs: 3000,
  extractionGlideSpeed: 3.2,
  spawnSafeDistance: 500,
  spawnBoundaryMargin: 500,
  spawnSafeAttempts: 30,
  spawnProtectionMs: 4000,
  mapMinRadius: 3000,
  mapMaxRadius: 16000,
  mapBreathAmplitude: 40,
  mapBreathCycleMs: 10000,
  botSelfDestructThreshold: 100,
  botEvadeRadius: 300,
  botFoodScanRadius: 300,
  commissionThreshold: 4,
  commissionRate: 0.35,
};

// ----------------------------------------------------------------------------
// Growth Formulas — Diminishing Returns
// ----------------------------------------------------------------------------

/**
 * Calculate body length (number of segments) from score.
 * Uses logarithmic scaling with a hard cap.
 *
 * Formula:  initialLength + min(maxExtra, logFactor × ln(1 + score))
 *
 * Score 0:       20 segments
 * Score 100:     ~31 segments
 * Score 1,000:   ~38 segments
 * Score 10,000:  ~46 segments
 * Score 100,000: ~53 segments
 * Hard cap:      maxSegments (200)
 */
export function calcBodyLength(score: number, cfg: SnakeConfig): number {
  const base = cfg.initialBodyLength;
  const maxExtra = cfg.maxSegments - base;
  const growth = cfg.lengthLogFactor * Math.log(1 + score);
  return Math.min(cfg.maxSegments, Math.floor(base + Math.min(maxExtra, growth)));
}

/**
 * Calculate visual radius from score.
 * Grows very slowly with diminishing returns.
 *
 * Formula:  baseVisualRadius + min(maxExtra, thicknessFactor × ln(1 + score))
 *
 * Score 0:       8px
 * Score 1,000:   ~8.35px
 * Score 10,000:  ~8.69px
 * Score 100,000: ~9.04px
 * Hard cap:      baseVisualRadius + maxExtraRadius (8 + 3 = 11px)
 */
export function calcVisualRadius(score: number, cfg: SnakeConfig): number {
  const base = cfg.visualRadius;
  const growth = cfg.thicknessLogFactor * Math.log(1 + score);
  return base + Math.min(cfg.maxExtraRadius, growth);
}

/**
 * Calculate collision radius from score.
 * Grows MUCH slower than visual — stays close to base for fair gameplay.
 * This means the visual body overlaps, but hitboxes have gaps for navigation.
 *
 * At any score, collision radius stays between baseCollision and baseCollision + 1px.
 * The gap between collision circles is what enables threading through tight spaces.
 */
export function calcCollisionRadius(score: number, cfg: SnakeConfig): number {
  // Collision radius barely grows — max 1px extra even at 100k score
  const tinyGrowth = 0.1 * Math.log(1 + score);
  return cfg.collisionRadius + Math.min(1, tinyGrowth);
}

/**
 * Calculate turn rate from score.
 * Higher score = slower turning (heavier snake).
 *
 * Formula:  max(turnMin, turnBase - turnScoreFactor × score)
 */
export function calcTurnRate(score: number, cfg: SnakeConfig): number {
  return Math.max(cfg.turnMin, cfg.turnBase - cfg.turnScoreFactor * score);
}

/**
 * Get current speed based on boost state.
 */
export function calcSpeed(isBoosting: boolean, isExtracting: boolean, cfg: SnakeConfig): number {
  if (isExtracting) return cfg.extractionGlideSpeed;
  if (isBoosting) return cfg.boostSpeed;
  return cfg.baseSpeed;
}

/**
 * Compute all snake metrics at once for a given score/state.
 */
export function calcSnakeMetrics(
  score: number,
  isBoosting: boolean,
  isExtracting: boolean,
  cfg: SnakeConfig,
): SnakeMetrics {
  return {
    bodyLength: calcBodyLength(score, cfg),
    visualRadius: calcVisualRadius(score, cfg),
    collisionRadius: calcCollisionRadius(score, cfg),
    turnRate: calcTurnRate(score, cfg),
    speed: calcSpeed(isBoosting, isExtracting, cfg),
  };
}

// ----------------------------------------------------------------------------
// Movement
// ----------------------------------------------------------------------------

/**
 * Turn toward desired angle with a max step per tick.
 * Handles angle wrapping correctly.
 */
export function turnToward(current: number, desired: number, maxStep: number): number {
  let diff = desired - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return desired;
  return current + Math.sign(diff) * maxStep;
}

/**
 * Move the head forward by `speed` pixels in direction `angle`.
 */
export function moveHead(pos: Vec2, angle: number, speed: number): Vec2 {
  return {
    x: pos.x + Math.cos(angle) * speed,
    y: pos.y + Math.sin(angle) * speed,
  };
}

// ----------------------------------------------------------------------------
// Body Management
// ----------------------------------------------------------------------------
// NOTE: The path-based body system (buildInitialPath, extendPath,
// sampleSegments) below is a MORE ACCURATE approach that maintains even
// segment spacing. The current online/offline engines use a simpler
// points.unshift/pop approach. These functions are kept for future
// migration but are NOT yet called by any engine.
// ----------------------------------------------------------------------------

/**
 * Build an initial body: `length` segments strung out behind the head.
 * Segments are placed along the reverse of the head's angle.
 *
 * CRITICAL: We store the FULL path history (not just segment positions).
 * Segments are then sampled from this path at `spacing` intervals.
 * This gives smooth curves and enables gap navigation.
 */
export function buildInitialPath(
  headX: number,
  headY: number,
  angle: number,
  segmentCount: number,
  spacing: number,
): Vec2[] {
  // The path stores every position the head has been at.
  // We need enough path points so that `segmentCount` segments can be sampled
  // at `spacing` intervals. Each segment occupies `spacing` path points.
  const totalPathPoints = segmentCount * spacing + 1;
  const path: Vec2[] = [];
  for (let i = 0; i < totalPathPoints; i++) {
    path.push({
      x: headX - Math.cos(angle) * i,
      y: headY - Math.sin(angle) * i,
    });
  }
  return path;
}

/**
 * Extend the path history with a new head position.
 * The path is a continuous record of every pixel the head has moved through.
 * Each movement of `speed` px adds `speed` new points (1 per pixel of movement).
 *
 * To keep the path from growing unbounded, we trim it to only what's needed
 * for the current body length plus a small buffer.
 */
export function extendPath(
  path: Vec2[],
  newHead: Vec2,
  oldHead: Vec2,
  bodySegmentCount: number,
  spacing: number,
): Vec2[] {
  // Calculate how many sub-steps to interpolate between old and new head.
  // This ensures smooth curves even at high speed.
  const dx = newHead.x - oldHead.x;
  const dy = newHead.y - oldHead.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist));

  // Add interpolated points
  const newPoints: Vec2[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    newPoints.push({
      x: oldHead.x + dx * t,
      y: oldHead.y + dy * t,
    });
  }

  // Prepend new points (head is always index 0)
  const newPath = [...newPoints, ...path];

  // Trim: keep only what's needed for current body + small buffer
  const maxNeeded = bodySegmentCount * spacing + spacing + 10;
  if (newPath.length > maxNeeded) {
    return newPath.slice(0, maxNeeded);
  }
  return newPath;
}

/**
 * Sample segment positions from the path history.
 * Every `spacing`-th point in the path becomes a segment.
 * Index 0 = head, index 1 = first body segment, etc.
 *
 * This is what enables gap navigation: if spacing = 16 and collisionRadius = 6,
 * there's a 4px gap between collision circles of adjacent segments.
 */
export function sampleSegments(path: Vec2[], spacing: number, count: number): Vec2[] {
  const segments: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const pathIdx = i * spacing;
    if (pathIdx < path.length) {
      segments.push(path[pathIdx]);
    } else if (path.length > 0) {
      // If path is too short (shouldn't happen), clamp to last point
      segments.push(path[path.length - 1]);
    }
  }
  return segments;
}

// ----------------------------------------------------------------------------
// Angle-Based Neck Protection
// ----------------------------------------------------------------------------

/**
 * Check if a head-to-body collision should be blocked by neck protection.
 *
 * Neck protection works by checking the APPROACH ANGLE:
 * - If the attacking head is moving roughly PARALLEL to the victim's body
 *   near the neck (shallow angle), it's a pass-through — no collision.
 * - If the attacking head is moving TOWARD the victim's body (steep angle),
 *   it's a real collision.
 *
 * @param attackerAngle  The direction the attacking snake's head is moving (radians)
 * @param attackerPos    The attacking head's position
 * @param bodySegment    The body segment being checked
 * @param segIndex       Index of the body segment (0 = first behind head)
 * @param victimAngle    The direction the victim snake is moving
 * @param cfg            Game config
 * @returns true if collision should be BLOCKED (pass-through allowed)
 */
export function isNeckProtected(
  attackerAngle: number,
  attackerPos: Vec2,
  bodySegment: Vec2,
  segIndex: number,
  victimAngle: number,
  cfg: SnakeConfig,
): boolean {
  // Only check the first N segments (neck zone)
  if (segIndex >= cfg.neckSegmentCount) return false;

  // Calculate the direction FROM the attacker's head TO the body segment
  const dx = bodySegment.x - attackerPos.x;
  const dy = bodySegment.y - attackerPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return false; // practically on top of each other — always collide

  // Angle from attacker to body segment
  const angleToSeg = Math.atan2(dy, dx);

  // The approach angle = how much the attacker's heading differs from
  // the direction toward the body segment.
  // 0° = heading straight at the segment (head-on) → should COLLIDE
  // 90° = passing perpendicular to the segment → should PASS
  let approachAngle = Math.abs(attackerAngle - angleToSeg);
  while (approachAngle > Math.PI) approachAngle -= 2 * Math.PI;
  approachAngle = Math.abs(approachAngle);

  // Convert to degrees for the threshold config
  const approachDeg = (approachAngle * 180) / Math.PI;

  // Also check the victim's body direction — if the attacker is passing
  // alongside the victim's body (parallel), it should pass through.
  // Calculate angle between attacker direction and victim body direction.
  let bodyAlign = Math.abs(attackerAngle - victimAngle);
  while (bodyAlign > Math.PI) bodyAlign -= 2 * Math.PI;
  bodyAlign = Math.abs(bodyAlign);
  const bodyAlignDeg = (bodyAlign * 180) / Math.PI;

  // Two conditions for pass-through:
  // 1. Approach angle is shallow (attacker isn't heading AT the segment)
  //    AND body alignment is close to parallel
  // OR
  // 2. The attacker is moving nearly parallel to the victim's body direction
  //    (passing alongside, not crossing)

  const threshold = cfg.neckAngleThreshold;

  // Condition: attacker is NOT heading toward the segment (shallow approach)
  // AND is roughly parallel to victim's body
  if (approachDeg > (90 - threshold) && bodyAlignDeg < threshold) {
    return true; // block collision — pass through
  }

  return false;
}

// ----------------------------------------------------------------------------
// Skin System
// ----------------------------------------------------------------------------

/** Default snake skin. */
export const DEFAULT_SKIN: SnakeSkin = {
  id: 'skin-default',
  name: 'Default Viper',
  body: [
    { color: '#22c55e' },  // green-500
  ],
  headColor: '#16a34a',   // green-600
  headEyeColor: '#ffffff',
};

/**
 * Get the visual style for a specific segment index.
 * Returns the color and optional glow from the skin pattern.
 */
export function getSegmentStyle(
  segIndex: number,
  skin: SnakeSkin,
): SkinSegment {
  if (skin.body.length === 0) return { color: '#22c55e' };
  return skin.body[segIndex % skin.body.length];
}

// ----------------------------------------------------------------------------
// Collision Helpers
// ----------------------------------------------------------------------------

/** Distance between two points. */
export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Check if two circles overlap.
 * Uses the collision hit factor to make hitboxes slightly smaller than visual.
 */
export function circlesOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
  hitFactor: number = 1.0,
): boolean {
  const effectiveR1 = ar * hitFactor;
  const effectiveR2 = br * hitFactor;
  const d = Math.hypot(ax - bx, ay - by);
  return d < effectiveR1 + effectiveR2;
}

/**
 * Check if a point is inside a circle.
 */
export function pointInCircle(
  px: number, py: number,
  cx: number, cy: number,
  radius: number,
): boolean {
  return Math.hypot(px - cx, py - cy) < radius;
}

// ----------------------------------------------------------------------------
// Food System
// ----------------------------------------------------------------------------

export interface FoodOrbDef {
  size: 'small' | 'medium' | 'large';
  value: number;
  radius: number;
  weight: number;
  color: string;
  glowColor: string;
}

/** Get food orb definitions from config. */
export function getFoodOrbs(cfg: SnakeConfig): FoodOrbDef[] {
  return [
    {
      size: 'small',
      value: cfg.foodSmallValue,
      radius: cfg.foodSmallRadius,
      weight: cfg.foodSmallWeight,
      color: '#34d399',
      glowColor: '#10b981',
    },
    {
      size: 'medium',
      value: cfg.foodMediumValue,
      radius: cfg.foodMediumRadius,
      weight: cfg.foodMediumWeight,
      color: '#38bdf8',
      glowColor: '#0ea5e9',
    },
    {
      size: 'large',
      value: cfg.foodLargeValue,
      radius: cfg.foodLargeRadius,
      weight: cfg.foodLargeWeight,
      color: '#f472b6',
      glowColor: '#ec4899',
    },
  ];
}

/** Pick a random food orb size based on weights. */
export function randomFoodOrb(orbs: FoodOrbDef[]): FoodOrbDef {
  const totalWeight = orbs.reduce((sum, o) => sum + o.weight, 0);
  let r = Math.random() * totalWeight;
  for (const orb of orbs) {
    r -= orb.weight;
    if (r <= 0) return orb;
  }
  return orbs[orbs.length - 1];
}

// ----------------------------------------------------------------------------
// Death Food Math
// ----------------------------------------------------------------------------

/**
 * Calculate death food drops from a snake's score.
 * Wall death = NO food drops.
 * Otherwise: Large (score÷5), Medium (remainder÷3), Small (rest).
 *
 * Returns counts: [smallCount, mediumCount, largeCount]
 */
export function calcDeathFood(score: number, isWallDeath: boolean): [number, number, number] {
  if (isWallDeath) return [0, 0, 0];

  const largeCount = Math.floor(score / 5);
  const remainder = score - largeCount * 5;
  const mediumCount = Math.floor(remainder / 3);
  const smallCount = remainder - mediumCount * 3;

  return [smallCount, mediumCount, largeCount];
}

// ----------------------------------------------------------------------------
// Star Chip Value
// ----------------------------------------------------------------------------

/**
 * Calculate star chip value when a player dies.
 * 10 stars, each worth: carriedChips ÷ 10.
 *
 * @param carriedChips  Chips the dead player was carrying
 * @returns Array of 10 star values (each = carriedChips / 10)
 */
export function calcStarChipValues(carriedChips: number): number[] {
  const perStar = Math.floor(carriedChips / 10);
  return new Array(10).fill(perStar);
}

// ----------------------------------------------------------------------------
// Map Breathing
// ----------------------------------------------------------------------------

/**
 * Get the current dynamic map radius with breathing effect.
 */
export function getBreathingMapRadius(
  baseRadius: number,
  elapsedMs: number,
  cfg: SnakeConfig,
): number {
  const cycle = (elapsedMs % cfg.mapBreathCycleMs) / cfg.mapBreathCycleMs;
  return baseRadius + Math.sin(cycle * Math.PI * 2) * cfg.mapBreathAmplitude;
}

/**
 * Calculate base map radius from player count (sqrt scaling).
 */
export function calcBaseMapRadius(
  realPlayerCount: number,
  cfg: SnakeConfig,
): number {
  const minP = 1;
  const maxP = 1000;
  const count = Math.max(minP, Math.min(maxP, realPlayerCount));
  return cfg.mapMinRadius + (cfg.mapMaxRadius - cfg.mapMinRadius) * Math.sqrt((count - 1) / (maxP - 1));
}

// ----------------------------------------------------------------------------
// Commission
// ----------------------------------------------------------------------------

/**
 * Calculate extraction commission rate based on real player count.
 * ≤3 real players = 0%, ≥4 = 35% (configurable).
 */
export function calcCommissionRate(realPlayerCount: number, cfg: SnakeConfig): number {
  if (realPlayerCount < cfg.commissionThreshold) return 0;
  return cfg.commissionRate;
}

// ----------------------------------------------------------------------------
// Utility: normalize angle to [-PI, PI]
// ----------------------------------------------------------------------------

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
