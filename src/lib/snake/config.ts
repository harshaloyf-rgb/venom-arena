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

/** Arena background fill color */
export const ARENA_BG_COLOR = '#0a0a0f';

/** Arena grid line color (subtle) */
export const ARENA_GRID_COLOR = 'rgba(255, 255, 255, 0.03)';

// ============================================================================
// 2. MOVEMENT — speed, turning, growth, length caps
// ============================================================================

/** Base movement speed (pixels per tick at 60fps) */
export const BASE_SPEED = 3.0;

/** Speed while boosting (pixels per tick at 60fps) — 2.0× base */
export const BOOST_SPEED = 6.0;

/** Turn rate at base speed (radians per tick) — ~11.5° per tick */
export const BASE_TURN_RATE = 0.200;

/** Turn rate at boost speed (radians per tick) — ~5.7° per tick.
 *  Dynamic: actual turn rate is lerped between BASE_TURN_RATE and MIN_TURN_RATE
 *  based on current speed. Faster = tighter turn radius. */
export const MIN_TURN_RATE = 0.100;

/** Distance between consecutive segment positions in the path history */
export const SEGMENT_SPACING = 8;

/** Score points required per additional body segment.
 *  Formula: length = START_LENGTH + floor(score / LENGTH_PER_SCORE)
 *  Score 0→15  |  100→35  |  1K→215  |  10K→2,015  |  100K→20,015
 *  Linear, predictable growth — 1 extra segment every 5 points earned. */
export const LENGTH_PER_SCORE = 5;

/** Starting body segment count for new snakes.
 *  With LENGTH_PER_SCORE=5, the first visible growth happens at score 5 (length 16). */
export const START_LENGTH = 15;

/** Removed: MAX_SNAKE_LENGTH.
 *  Length now grows linearly with no hard cap (1 seg per 5 score).
 *  Practical limit is rendering performance, not an arbitrary ceiling.
 *  At 100K score: 20,015 segments. Server safety: path buffer auto-grows. */

/** Compute visual body length (segments) from score using linear growth.
 *  1 extra segment per LENGTH_PER_SCORE (5) score points.
 *  Smooth, predictable growth — no sudden jumps.
 *  Score 0→15  |  5→16  |  100→35  |  1K→215  |  10K→2,015  |  100K→20,015 */
export function computeBodyLength(score: number): number {
  return Math.floor(START_LENGTH + score / LENGTH_PER_SCORE);
}

/** Compute visual body radius from score using uncapped sqrt curve.
 *  Grows forever — no hard max. Slower at high scores, meaningful at every level.
 *  Score 0→6  |  1K→8.5  |  10K→14  |  100K→31 */
export function computeBodyRadius(score: number): number {
  return SNAKE_RADIUS_MIN + SNAKE_RADIUS_GROWTH_RATE * Math.sqrt(score);
}

/** Segments lost per boost food drop */
export const BOOST_SHRINK_RATE = 1;

// ============================================================================
// 3. FOOD — orbs: weights, values, sizes, colors, spawn/despawn areas
// ============================================================================

/** Target food count within the player's visible radius (density-based spawning). */
export const FOOD_DENSITY_TARGET = 800;

/** Radius around the player to count food for density checks and spawn food into. */
export const FOOD_VISIBLE_RADIUS = 5000;

/** Food beyond this distance from the player gets despawned (memory management). */
export const FOOD_DESPAWN_RADIUS = 7000;

/** Number of food orbs to spawn per tick when density is below target. */
export const FOOD_RESPAWN_BATCH = 25;

/** Spawn weight probabilities for [small, medium, large] food */
export const FOOD_SPAWN_WEIGHTS: [number, number, number] = [0.93, 0.04, 0.03];

/** Point values for [small, medium, large] food */
export const FOOD_VALUES: [number, number, number] = [1, 2, 5];

/** Visual radii for [small, medium, large] food */
export const FOOD_RADII: [number, number, number] = [3, 5, 8];

/** Fill colors for [small, medium, large] food */
export const FOOD_COLORS: [string, string, string] = ['#34d399', '#38bdf8', '#f472b6'];

/** Glow colors for [small, medium, large] food */
export const FOOD_GLOW_COLORS: [string, string, string] = ['#10b981', '#0ea5e9', '#ec4899'];

/** Initial food spawn area radius (around origin at game start) */
export const INITIAL_SPAWN_RADIUS = 5000;

/** Maximum food array length (safety cap to prevent unbounded memory growth). */
export const FOOD_MAX_COUNT = 5000;

// ============================================================================
// 4. COLLISION — snake radius, protection zones, death rules
// ============================================================================

/** Collision/food-eat radius — stays constant regardless of score (fair gameplay).
 *  Bigger snakes LOOK fatter (visual radius grows) but hitbox stays the same. */
export const SNAKE_RADIUS = 6;

/** Minimum visual body radius (at score 0). Thin starting snake. */
export const SNAKE_RADIUS_MIN = 6;

/** Radius growth rate: how many px of width per √score.
 *  Formula: radius = MIN + RATE × √score
 *  No hard max — radius grows forever with score, just slower at higher scores.
 *  Score 0: 6px  |  Score 100: 9px  |  Score 500: 12.7px  |  Score 1K: 15.5px  |  Score 10K: 30px */
export const SNAKE_RADIUS_GROWTH_RATE = 0.3;

/** First N segments of a snake's body that cannot kill on collision */
export const NECK_PROTECTION = 5;

/** Spawn protection duration in milliseconds */
export const SPAWN_PROTECTION_MS = 4000;

/** Head-on-head: if true, the boosting snake always wins */
export const HEAD_ON_HEAD_BOOST_WINS = true;

/** Death food distribution: divisor for large food count (score ÷ this) */
export const DEATH_FOOD_LARGE_DIVISOR = 5;

/** Death food distribution: divisor for medium food count (remainder ÷ this) */
export const DEATH_FOOD_MEDIUM_DIVISOR = 3;

/** Spatial hash cell size in pixels for collision detection */
export const SPATIAL_CELL_SIZE = 100;

// ============================================================================
// 5. BOOST — drop interval, prerequisites, speed multiplier
// ============================================================================

/** Milliseconds between boost food drops (~3 per second) */
export const BOOST_DROP_INTERVAL = 333;

/** Minimum body segments required to boost */
export const BOOST_MIN_BODY = 8;

/** Minimum score required to boost — must have score to spend */
export const BOOST_MIN_SCORE = 1;

/** Score deducted each interval while boosting (integer — no decimals in score).
 *  Combined with BOOST_SCORE_COST_INTERVAL: 1 point every 12 ticks ≈ 5/sec at 60fps. */
export const BOOST_SCORE_COST_AMOUNT = 1;

/** Ticks between each score deduction while boosting.
 *  At 60fps: 1 point every 12 ticks = 5 points/sec.
 *  Replaces old float-based BOOST_SCORE_COST_PER_TICK (0.08) which caused decimal scores. */
export const BOOST_SCORE_COST_INTERVAL = 12;

/** Boost speed as a multiplier of base speed */
export const BOOST_SPEED_MULTIPLIER = BOOST_SPEED / BASE_SPEED; // = 2.0

// ============================================================================
// 6. BOT — AI count, starting stats, steering, behavior parameters
// ============================================================================

/** Number of AI bots in the arena */
export const BOT_COUNT = 0; // TODO: re-enable after snake + food are stable

/** Bot starting score minimum */
export const BOT_START_SCORE_MIN = 10;

/** Bot starting score maximum */
export const BOT_START_SCORE_MAX = 80;

/** Bot max turn rate (radians per tick, ~60% of player rate for natural feel).
 *  Player: π/15 ≈ 0.209, Bot: π*0.04 ≈ 0.126 (60% ratio preserved). */
export const BOT_MAX_TURN_RATE = Math.PI * 0.04;

/** Bot food scan radius (how far a bot looks for food) */
export const BOT_FOOD_SCAN_RADIUS = 300;

/** Bot evade radius (how far a bot detects player bodies) */
export const BOT_EVADE_RADIUS = 300;

/** Bot AI prediction ticks ahead for collision avoidance */
export const BOT_PREDICT_TICKS = 8;

/** Bot body avoidance range in pixels */
export const BOT_AVOID_RANGE = 150;

/** Bot wander angle change range (radians per tick) */
export const BOT_WANDER_RATE = 0.05;

/** Probability per tick that a bot decides to boost (0.0 = never) */
export const BOT_BOOST_CHANCE = 0.0;

/** Score threshold at which bots self-destruct near extraction zone */
export const BOT_SELF_DESTRUCT_SCORE = 100;

/** Distance from arena edge at which bots start turning inward */
export const BOT_BOUNDARY_AVOID_RADIUS = 200;

// ============================================================================
// 7. SPAWN — initial spawn radius, safe positioning, respawn timing
// ============================================================================

/** Radius used for placing new snakes safely (also see INITIAL_SPAWN_RADIUS in FOOD) */
export const SPAWN_RADIUS = 3000;

/** Minimum distance from all other snakes for safe spawn */
export const SAFE_SPAWN_DIST = 500;

/** Max attempts to find a safe spawn position before forcing placement */
export const SAFE_SPAWN_ATTEMPTS = 30;

/** Delay in milliseconds before a dead player can respawn */
export const RESPAWN_DELAY = 3000;

/** Milliseconds between spawn-protection blink toggle */
export const SPAWN_INVULN_BLINK_RATE = 200;

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
// 9. EXTRAPOLATION — server/client timing, interpolation, camera
// ============================================================================

/** Server simulation tick rate in Hz */
export const SERVER_TICK_RATE = 20;

/** Client target render frame rate in fps */
export const CLIENT_RENDER_FPS = 60;

/** Maximum time in ms to extrapolate beyond last server snapshot */
export const MAX_EXTRAPOLATION_MS = 200;

/** Angle interpolation speed (0–1, lower = smoother) */
export const ANGLE_LERP_SPEED = 0.3;

/** Fixed timestep in seconds for offline game loop (targeting 60fps) */
export const FIXED_DT = 1 / 60;

/** Camera position lerp factor (0–1, lower = smoother follow). Used in online mode. */
export const CAMERA_LERP = 0.08;

/** Base camera zoom — starts closer for better visibility */
export const CAMERA_BASE_ZOOM = 1.35;

/** Minimum camera zoom level (safety floor — rarely reached in normal gameplay) */
export const CAMERA_ZOOM_MIN = 0.45;

/** Camera zoom lerp factor (0–1, lower = smoother zoom transitions).
 *  0.015 → 90% convergence in ~153 frames (2.5s at 60fps).
 *  Combined with gradual target changes, the player barely notices zoom shifting. */
export const CAMERA_ZOOM_LERP = 0.015;

/** Position prediction factor for extrapolation (1.0 = full prediction) */
export const POSITION_PREDICT_FACTOR = 1.0;

// ============================================================================
// 10. CRAFTING — sacrifice, rarity upgrade, chest weights, set piece counts
// ============================================================================

/** Number of completed sets required to perform a sacrifice roll */
export const SACRIFICE_SET_COUNT = 1;

/** Percentage chance of rarity upgrade on sacrifice (0–100) */
export const RARITY_UPGRADE_CHANCE = 15;

/** Weighted drop rates per rarity when opening a chest */
export const CHEST_WEIGHTS = {
  common: 55,
  rare: 30,
  epic: 12,
  legendary: 3,
} as const;

/** Number of pieces required to complete a set, per rarity tier */
export const SET_PIECE_COUNTS = {
  common: 5,
  rare: 4,
  epic: 3,
  legendary: 2,
} as const;

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
// 12. SNAPSHOT_DOWNSAMPLING — network broadcast optimization
// ============================================================================

/** Server-to-client snapshot broadcast rate in Hz */
export const BROADCAST_RATE = 20;

/** Maximum number of snakes included in a single snapshot */
export const MAX_SNAKES_PER_SNAPSHOT = 100;

/** Send every Nth body segment in snapshots (1 = all, 3 = every 3rd) */
export const BODY_DOWNSAMPLE_INTERVAL = 3;

/** Only include food within this radius of any player in the snapshot */
export const FOOD_DOWNSAMPLE_RADIUS = 500;

// ============================================================================
// 13. EXTRACTION — zone, scoring, star chips, speed bonus
// ============================================================================

/** Extraction zone radius in pixels */
export const EXTRACTION_ZONE_RADIUS = 800;

// ZONE_SHRINK_RATE removed — was unused (no shrink logic implemented)

/** Minimum score required to enter the extraction zone */
export const EXTRACTION_SCORE_THRESHOLD = 50;

/** Speed multiplier applied while inside the extraction zone */
export const EXTRACTION_SPEED_BONUS = 1.5;

/** Point value of each star chip collected in extraction */
export const STAR_CHIP_VALUE = 10;

/** Interval in ms between star chip spawns inside the extraction zone */
export const STAR_CHIP_SPAWN_INTERVAL = 5000;

/** Visual radius of star chips in pixels */
export const STAR_CHIP_RADIUS = 12;

/** Glow color for star chips */
export const STAR_CHIP_GLOW = '#fbbf24';

// EXTRACTION_ZONE_DURATION, EXTRACTION_ZONE_SPAWN_INTERVAL removed — unused

/** Array of 5 golden/amber colors for star chip variety */
export const STAR_CHIP_COLORS: string[] = [
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#eab308', // yellow-500
  '#facc15', // yellow-400
];
