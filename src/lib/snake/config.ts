// ============================================================================
// Snake Game Configuration — 85+ Admin-Tunable Parameters
// ============================================================================
// All values are plain named exports for admin slider binding.
// No imports required.
// ============================================================================

// ============================================================================
// 1. ARENA — arena grid appearance
// ============================================================================

/** Background grid cell size in pixels */
export const ARENA_GRID_SIZE = 100;

// ============================================================================
// 2. MOVEMENT — speed, turning, growth, length caps
// ============================================================================

/** Base movement speed (pixels per tick at 60fps) */
export const BASE_SPEED = 3.0;

/** Speed while boosting (pixels per tick at 60fps) — 2.0× base */
export const BOOST_SPEED = 6.0;

/** Turn rate at base speed (radians per tick) — ~2.9° per tick.
 *  Turn radius = speed / turn_rate → 3.0 / 0.050 = 60px. */
export const BASE_TURN_RATE = 0.050;

/** Turn rate at boost speed (radians per tick) — ~5.7° per tick.
 *  Turn radius = speed / turn_rate → 6.0 / 0.100 = 60px. */
export const MIN_TURN_RATE = 0.100;

/** Steering inertia — fraction of remaining angle applied per tick (0–1).
 *  Controls how "heavy" the snake feels when changing direction.
 *  0.12 = 12% of remaining angle each tick → ~90% convergence in ~19 ticks (~0.3s at 60fps).
 *  Lower = heavier/more sluggish. Higher = more responsive (0.5+ = nearly instant). */
export const STEERING_LERP = 0.12;

/** Maximum speed reduction during sharp turns (0–1).
 *  When the snake turns at its maximum rate, speed drops by this fraction.
 *  Uses smoothstep curve so braking kicks in gradually, not abruptly.
 *  0.30 = up to 30% speed reduction at full turn.
 *  0.0 = no braking (old behavior). */
export const SHARP_TURN_BRAKE = 0.30;

/** Distance between consecutive segment positions in the path history */
export const SEGMENT_SPACING = 8;

/** Starting body segment count for new snakes. */
export const START_LENGTH = 15;

/** Logarithmic body length growth — same pattern as bodyRadius.
 *  Formula: length = START_LENGTH + RATE × ln(1 + score / OFFSET)
 *  No hard cap — naturally flattens but ALWAYS grows (different scores = different lengths).
 *  Fitted to checkpoints: 0→15 | 1K→100 | 10K→288 | 50K→451 | 100K→523 | 1M→764 */
export const LENGTH_GROWTH_RATE = 52.5;
export const LENGTH_GROWTH_OFFSET = 800;

/** Compute visual body length (segments) from score using logarithmic growth.
 *  Same structure as computeBodyRadius — fast early, flattens at high scores, no cap.
 *  Score 0→15 | 100→27 | 500→66 | 1K→100 | 5K→223 | 10K→288 | 50K→451 | 100K→523 | 1M→764 */
export function computeBodyLength(score: number): number {
  return Math.floor(START_LENGTH + LENGTH_GROWTH_RATE * Math.log(1 + score / LENGTH_GROWTH_OFFSET));
}

/** Compute visual body radius from score using logarithmic growth curve.
 *  NO HARD CAP — grows indefinitely (logarithmically) with score.
 *  Visual-only: collision radius stays constant at SNAKE_RADIUS (fairness).
 *  Score 0→6  |  100→9  |  500→12  |  1K→13.4  |  10K→18.4  |  100K→23.3  |  1M→31  |  10M→39 */
export function computeBodyRadius(score: number): number {
  return SNAKE_RADIUS_MIN + SNAKE_RADIUS_GROWTH_RATE * Math.log(1 + score / SNAKE_RADIUS_GROWTH_OFFSET);
}


// ============================================================================
// 3. FOOD — orbs: weights, values, sizes, colors, spawn/despawn areas
// ============================================================================

/** Target food count within the player's visible radius (density-based spawning).
 *  2000 in a 4000px radius ≈ 0.04 food per 1000 sq px ≈ ~50 food visible on screen at zoom 1.0.
 */
export const FOOD_DENSITY_TARGET = 2000;

/** Radius around the player to count food for density checks and spawn food into. */
export const FOOD_VISIBLE_RADIUS = 4000;

/** Food beyond this distance from the player gets despawned (memory management). */
export const FOOD_DESPAWN_RADIUS = 6000;

/** Number of food orbs to spawn per tick when density is below target.
 *  80 × 60fps = 4800 food/sec max respawn rate — fast enough to keep screen full.
 */
export const FOOD_RESPAWN_BATCH = 80;

/** Spawn weight probabilities for [small, medium, large] food */
export const FOOD_SPAWN_WEIGHTS: [number, number, number] = [0.93, 0.04, 0.03];

/** Point values for [small, medium, large] food */
export const FOOD_VALUES: [number, number, number] = [1, 2, 5];

/** Visual radii for [small, medium, large] food — reduced for cleaner look */
export const FOOD_RADII: [number, number, number] = [1.5, 2, 3];

/** Fill colors for [small, medium, large] food */
export const FOOD_COLORS: [string, string, string] = ['#34d399', '#38bdf8', '#f472b6'];

/** Glow colors for [small, medium, large] food */
export const FOOD_GLOW_COLORS: [string, string, string] = ['#10b981', '#0ea5e9', '#ec4899'];

/** Initial food spawn area radius (around origin at game start) */
export const INITIAL_SPAWN_RADIUS = 4000;

/** Maximum food array length (safety cap to prevent unbounded memory growth). */
export const FOOD_MAX_COUNT = 10000;

// ============================================================================
// 4. COLLISION — snake radius, protection zones, death rules
// ============================================================================

/** Collision/food-eat radius — stays constant regardless of score (fair gameplay).
 *  Bigger snakes LOOK fatter (visual radius grows) but hitbox stays the same. */
export const SNAKE_RADIUS = 6;

/** Minimum visual body radius (at score 0). Thin starting snake. */
export const SNAKE_RADIUS_MIN = 6;

/** Radius growth offset: logarithmic curve parameter.
 *  Formula: radius = MIN + RATE × ln(1 + score / OFFSET)
 *  Derived from exact data-point fitting (see checkpoints in RATE). */
export const SNAKE_RADIUS_GROWTH_OFFSET = 100 / 3; // ≈ 33.333

/** Radius growth rate: logarithmic curve coefficient.
 *  Formula: radius = 6 + 1.623 × ln(1 + score / 33.333)
 *  Score 0→6  |  100→9  |  500→12  |  1K→13.4  |  10K→18.4  |  100K→23.3  |  300K→25.7 */
export const SNAKE_RADIUS_GROWTH_RATE = 2.25 / Math.log(4); // ≈ 1.623

/** First N segments of a snake's body that cannot kill on collision */
export const NECK_PROTECTION = 5;

/** Spawn protection duration in milliseconds */
export const SPAWN_PROTECTION_MS = 2000;

/** Head-on-head: if true, the boosting snake always wins */
export const HEAD_ON_HEAD_BOOST_WINS = true;

/** Spatial hash cell size in pixels for collision detection */
export const SPATIAL_CELL_SIZE = 100;

// ============================================================================
// 5. BOOST — drop interval, prerequisites, speed multiplier
// ============================================================================

/** Milliseconds between boost food drops (3 per second). */
export const BOOST_DROP_INTERVAL = 333;

/** Number of food orbs to drop per boost interval.
 *  1 drop × 500ms = 2 food/sec. */
export const BOOST_DROP_COUNT = 1;

/** Minimum body segments required to boost */
export const BOOST_MIN_BODY = 8;

/** Minimum score required to boost — must have score to spend.
 *  Set to 0 so the player can always boost (food drops continue as visual feedback).
 *  Score still drains but the snake won't suddenly stop boosting at score=0.
 *  Body length shrinks naturally as score drops, eventually hitting BOOST_MIN_BODY. */
export const BOOST_MIN_SCORE = 0;

/** Score deducted each interval while boosting (integer — no decimals in score).
 *  Combined with BOOST_SCORE_COST_INTERVAL: 1 point every 12 ticks ≈ 5/sec at 60fps. */
export const BOOST_SCORE_COST_AMOUNT = 1;

/** Ticks between each score deduction while boosting.
 *  At 60fps: 1 point every 12 ticks = 5 points/sec.
 *  Replaces old float-based BOOST_SCORE_COST_PER_TICK (0.08) which caused decimal scores. */
export const BOOST_SCORE_COST_INTERVAL = 12;


// ============================================================================
// 7. SPAWN — initial spawn radius, safe positioning, respawn timing
// ============================================================================

/** Radius used for placing new snakes safely (also see INITIAL_SPAWN_RADIUS in FOOD) */
export const SPAWN_RADIUS = 3000;

/** Minimum distance from all other snakes for safe spawn */
export const SAFE_SPAWN_DIST = 500;

/** Max attempts to find a safe spawn position before forcing placement */
export const SAFE_SPAWN_ATTEMPTS = 30;

// ============================================================================
// 8. SPIRAL_TURN — Progressive spiral assist for tight circular motion
// ============================================================================

/** Min angle diff (rad) per tick to count as "turning" for spiral detection */
export const SPIRAL_TURN_THRESHOLD = 0.08;

/** Consecutive tight-turn ticks needed to enter spiral mode (~0.17s at 60fps) */
export const SPIRAL_ENTER_TICKS = 10;

/** Max turn rate multiplier when spiral is fully ramped (1.0 = no boost, 1.8 = 80% faster turning) */
export const SPIRAL_MAX_MULTIPLIER = 1.8;

/** Ticks to reach full spiral multiplier (gradual ramp-up) */
export const SPIRAL_RAMP_TICKS = 40;

/** Min angle diff (rad) to stay in spiral — below this, player is straightening out */
export const SPIRAL_EXIT_THRESHOLD = 0.03;

// ============================================================================
// 9. COIL PHYSICS — curvature-based body contraction
// ============================================================================

/** Body contraction strength when coiling (0 = off, 0.5 = moderate, 1.0 = strong).
 *  Pulls body segments inward on curves for a python-grip tightening effect.
 *  Applied at render time only — collision/physics use the raw path. */
export const COIL_CONTRACTION = 0.45;

// ============================================================================
// 10. EXTRAPOLATION — server/client timing, interpolation, camera
// ============================================================================

/** Fixed timestep in seconds for offline game loop (targeting 60fps) */
export const FIXED_DT = 1 / 60;

/** Base camera zoom — starts closer for better visibility */
export const CAMERA_BASE_ZOOM = 1.35;

/** Minimum camera zoom level — lowered to support massive snakes (unlimited growth).
 *  At zoom 0.15, the viewport shows ~9× more world area than at zoom 1.35. */
export const CAMERA_ZOOM_MIN = 0.15;

/** Camera zoom lerp factor (0–1, lower = smoother zoom transitions).
 *  0.015 → 90% convergence in ~153 frames (2.5s at 60fps).
 *  Combined with gradual target changes, the player barely notices zoom shifting. */
export const CAMERA_ZOOM_LERP = 0.015;

// ============================================================================
// 11. TEXTURE_ATLAS — sprite sizes, segment counts, UV mapping
// ============================================================================

/** Base sprite size in pixels for atlas tiles */
export const SPRITE_SIZE = 64;

/** Number of distinct body segment sprite variants in the atlas */
export const BODY_SEGMENT_COUNT = 8;

/** Head sprite size in pixels (larger for detail) */
export const HEAD_SPRITE_SIZE = 80;

/** Tail sprite size in pixels (tapered) */
export const TAIL_SPRITE_SIZE = 56;

/** UV scale factor for pattern textures on snake body */
export const PATTERN_UV_SCALE = 1.0;

/** Padding in pixels between atlas tiles to prevent bleeding */
export const ATLAS_PADDING = 2;

/** Extra glow radius in pixels for legendary-quality snakes */
export const LEGENDARY_GLOW_SIZE = 16;

// ============================================================================
// 12. FOOD MAGNET — vacuum pull mechanic around snake head
// ============================================================================

/** Pull zone: food within (SNAKE_RADIUS + this) pixels of head center gets attracted.
 *  35px = a visible vacuum halo around the snake head. */
export const FOOD_MAGNET_PULL_RADIUS = 35;

/** Death zone: food within (SNAKE_RADIUS + this) pixels is eaten instantly.
 *  2px = tiny inner radius — food must almost touch the mouth. */
export const FOOD_MAGNET_DEATH_RADIUS = 2;

/** Minimum pull speed at the edge of the pull zone (pixels per tick).
 *  Food drifts gently when it first enters the field. */
export const FOOD_MAGNET_MIN_SPEED = 1.0;

/** Maximum pull speed at the death zone boundary (pixels per tick).
 *  Quadratic ramp from MIN to MAX creates the snappy vacuum snap. */
export const FOOD_MAGNET_MAX_SPEED = 10.0;




