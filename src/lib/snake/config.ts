// ============================================================================
// Snake Game Configuration — 85+ Admin-Tunable Parameters
// ============================================================================
// All values are plain named exports for admin slider binding.
// No imports required.
// ============================================================================

// ============================================================================
// 1. ARENA — arena geometry, boundaries, grid appearance
// ============================================================================

/** Radius of the playable arena in pixels (circular boundary) */
export const ARENA_RADIUS = 5000;

/** Distance from arena edge at which boundary warning begins */
export const ARENA_BOUNDARY_MARGIN = 200;

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
export const BASE_SPEED = 4.5;

/** Speed while boosting (pixels per tick at 60fps) */
export const BOOST_SPEED = 8.0;

/** Max angle change per tick for player steering (radians) */
export const MAX_TURN_RATE = Math.PI * 0.12;

/** Distance between consecutive segment positions in the path history */
export const SEGMENT_SPACING = 8;

/** Growth rate: each food point adds this many segments */
export const GROWTH_RATE = 0.25;

/** Starting body segment count for new snakes */
export const START_LENGTH = 20;

/** Maximum snake body length (segment count hard cap) */
export const MAX_SNAKE_LENGTH = 2000;

/** Segments lost per boost food drop */
export const BOOST_SHRINK_RATE = 1;

// ============================================================================
// 3. FOOD — orbs: count, weights, values, sizes, colors, spawn areas
// ============================================================================

/** Total food orbs to maintain in the arena */
export const FOOD_COUNT_TARGET = 100;

/** Spawn weight probabilities for [small, medium, large] food */
export const FOOD_SPAWN_WEIGHTS: [number, number, number] = [0.93, 0.04, 0.03];

/** Point values for [small, medium, large] food */
export const FOOD_VALUES: [number, number, number] = [1, 3, 5];

/** Visual radii for [small, medium, large] food */
export const FOOD_RADII: [number, number, number] = [3, 5, 8];

/** Fill colors for [small, medium, large] food */
export const FOOD_COLORS: [string, string, string] = ['#34d399', '#38bdf8', '#f472b6'];

/** Glow colors for [small, medium, large] food */
export const FOOD_GLOW_COLORS: [string, string, string] = ['#10b981', '#0ea5e9', '#ec4899'];

/** Food spawn radius around random center point */
export const FOOD_SPAWN_AREA_RADIUS = 3000;

/** Initial food spawn area radius (around origin at game start) */
export const INITIAL_SPAWN_RADIUS = 3000;

/** Number of food orbs to spawn per tick when below target */
export const FOOD_RESPAWN_BATCH = 5;

/** Food beyond this distance from any snake gets cleaned up */
export const FOOD_DESPAWN_RADIUS = 6000;

// ============================================================================
// 4. COLLISION — snake radius, protection zones, death rules
// ============================================================================

/** Base visual radius of each snake segment */
export const SNAKE_RADIUS = 8;

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

/** Minimum score (starting score) required to boost — must have eaten food */
export const BOOST_MIN_SCORE = 20;

/** Boost speed as a multiplier of base speed */
export const BOOST_SPEED_MULTIPLIER = BOOST_SPEED / BASE_SPEED; // ≈ 1.778

// ============================================================================
// 6. BOT — AI count, starting stats, steering, behavior parameters
// ============================================================================

/** Number of AI bots in the arena */
export const BOT_COUNT = 0; // TODO: re-enable after snake + food are stable

/** Bot starting score minimum */
export const BOT_START_SCORE_MIN = 10;

/** Bot starting score maximum */
export const BOT_START_SCORE_MAX = 80;

/** Bot max turn rate (radians per tick, slightly slower than player) */
export const BOT_MAX_TURN_RATE = Math.PI * 0.08;

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
// 8. SPIRAL_TURN — Fibonacci spiral detection & parameters
// ============================================================================

/** Angle delta threshold (radians) to classify a tick as a "tight turn" */
export const TIGHT_TURN_THRESHOLD = 0.5;

/** Number of recent ticks to inspect for spiral pattern detection */
export const SPIRAL_DETECT_WINDOW = 5;

/** Maximum angle delta within the window to confirm spiral entry */
export const MAX_SPIRAL_ANGLE_DELTA = 0.15;

/** Fibonacci spiral parameter: r = a * e^(b * theta) — base radius */
export const SPIRAL_A = 1.0;

/** Fibonacci spiral parameter: r = a * e^(b * theta) — growth rate */
export const SPIRAL_B = 0.05;

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

/** Camera lerp factor (0–1, lower = smoother follow) */
export const CAMERA_LERP = 0.08;

/** Minimum camera zoom level */
export const CAMERA_ZOOM_MIN = 0.3;

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

/** Rate at which extraction zone shrinks per second (0 = no shrink) */
export const ZONE_SHRINK_RATE = 0.5;

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

/** Duration in ms for each extraction zone phase */
export const EXTRACTION_ZONE_DURATION = 60000;

/** Interval in ms between extraction zone spawn events */
export const EXTRACTION_ZONE_SPAWN_INTERVAL = 120000;

/** Array of 5 golden/amber colors for star chip variety */
export const STAR_CHIP_COLORS: string[] = [
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#eab308', // yellow-500
  '#facc15', // yellow-400
];
