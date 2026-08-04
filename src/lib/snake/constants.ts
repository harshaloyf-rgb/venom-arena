// ============================================================================
// Snake Game Constants — Phase Zero (Offline Practice)
// ============================================================================

/** Base movement speed (pixels per tick at 60fps) */
export const BASE_SPEED = 4.5;

/** Speed while boosting */
export const BOOST_SPEED = 8.0;

/** Distance between consecutive segment positions in the path history */
export const SEGMENT_SPACING = 8;

/** Starting body segment count */
export const START_LENGTH = 20;

/** Total food orbs to maintain in the arena */
export const FOOD_COUNT_TARGET = 1200;

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

/** Milliseconds between boost food drops (~3 per second) */
export const BOOST_DROP_INTERVAL = 333;

/** Minimum body segments required to boost */
export const BOOST_MIN_BODY = 8;

/** Minimum score (starting score) required to boost — must have eaten food */
export const BOOST_MIN_SCORE = 20;

/** Growth rate: each food point adds this many segments (1/4 of value) */
export const GROWTH_RATE = 0.25;

/** First N segments of a snake's body that cannot kill on collision */
export const NECK_PROTECTION = 5;

/** Minimum distance from all other snakes for safe spawn */
export const SAFE_SPAWN_DIST = 500;

/** Max attempts to find a safe spawn position */
export const SAFE_SPAWN_ATTEMPTS = 30;

/** Spawn protection duration in milliseconds */
export const SPAWN_PROTECTION_MS = 4000;

/** Number of AI bots in offline mode */
export const BOT_COUNT = 1000;

/** Base visual radius of each snake segment */
export const SNAKE_RADIUS = 8;

/** Spatial hash cell size in pixels */
export const SPATIAL_CELL_SIZE = 100;

/** Bot food scan radius (how far a bot looks for food) */
export const BOT_FOOD_SCAN_RADIUS = 300;

/** Bot evade radius (how far a bot detects player bodies) */
export const BOT_EVADE_RADIUS = 300;

/** Bot starting score range [min, max] */
export const BOT_START_SCORE_MIN = 10;
export const BOT_START_SCORE_MAX = 80;

/** Bot AI prediction ticks ahead for collision avoidance */
export const BOT_PREDICT_TICKS = 8;

/** Bot body avoidance range in pixels */
export const BOT_AVOID_RANGE = 150;

/** Camera lerp factor (0-1, lower = smoother) */
export const CAMERA_LERP = 0.08;

/** Minimum camera zoom level */
export const CAMERA_ZOOM_MIN = 0.3;

/** Fixed timestep in seconds (targeting 60fps) */
export const FIXED_DT = 1 / 60;

/** Food spawn radius around random center */
export const FOOD_SPAWN_AREA_RADIUS = 3000;

/** Initial food spawn area radius (around origin) */
export const INITIAL_SPAWN_RADIUS = 3000;

/** Max angle change per tick for player steering (radians) */
export const MAX_TURN_RATE = Math.PI * 0.12;

/** Bot max turn rate (slightly slower than player for fairness) */
export const BOT_MAX_TURN_RATE = Math.PI * 0.08;

/** Bot wander angle change range (radians) */
export const BOT_WANDER_RATE = 0.05;
