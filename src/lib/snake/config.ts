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
export const START_LENGTH = 4;

/** Logarithmic body length growth — same pattern as bodyRadius.
 *  Formula: length = START_LENGTH + RATE × ln(1 + score / OFFSET)
 *  No hard cap — naturally flattens but ALWAYS grows (different scores = different lengths).
 *  Fitted to checkpoints: 0→15 | 1K→100 | 10K→288 | 50K→451 | 100K→523 | 1M→764 */
export const LENGTH_GROWTH_RATE = 45;
export const LENGTH_GROWTH_OFFSET = 800;

/** Compute visual body length (segments) from score using logarithmic growth.
 *  Same structure as computeBodyRadius — fast early, flattens at high scores, no cap.
 *  Score 0→4 | 100→20 | 500→60 | 1K→93 | 5K→214 | 10K→276 | 50K→435 | 100K→507 | 1M→748 */
export function computeBodyLength(score: number): number {
  return Math.floor(START_LENGTH + LENGTH_GROWTH_RATE * Math.log(1 + score / LENGTH_GROWTH_OFFSET));
}

/** Dual-logarithmic radius growth — two logarithmic terms for balanced growth.
 *  Primary: fast early growth (RATE_1=2.36 / OFFSET_1=300)
 *  Secondary: slow continuous growth at high scores (RATE_2=0.65 / OFFSET_2=100K)
 *  Score 0→3  |  1K→6.5  |  5K→9.8  |  10K→11.4  |  25K→13.6  |  100K→17.2  |  1M→25.0 */
export function computeBodyRadius(score: number): number {
  return SNAKE_RADIUS_MIN
    + SNAKE_RADIUS_GROWTH_RATE_1 * Math.log(1 + score / SNAKE_RADIUS_GROWTH_OFFSET_1)
    + SNAKE_RADIUS_GROWTH_RATE_2 * Math.log(1 + score / SNAKE_RADIUS_GROWTH_OFFSET_2);
}


// ============================================================================
// 3. FOOD — orbs: weights, values, sizes, colors, spawn/despawn areas
// ============================================================================

/** Target food count within the player's visible radius (density-based spawning).
 *  1500 in a 4000px radius — reduced from 2500 to lower food count
 *  and reduce food iteration overhead. Still feels dense enough.
 */
export const FOOD_DENSITY_TARGET = 1500;

/** Radius around the player to count food for density checks and spawn food into. */
export const FOOD_VISIBLE_RADIUS = 4000;

/** Food beyond this distance from ORIGIN gets despawned (out of map bounds).
 *  Set to SPAWN_RADIUS + buffer so food persists across the whole map.
 *  29000px map radius + 1000px buffer = 30000px. */
export const FOOD_DESPAWN_RADIUS = 30000;

/** Number of food orbs to spawn per tick when density is below target.
 *  40 × 60fps = 2400 food/sec max respawn rate.
 *  Reduced from 80 to match lower FOOD_DENSITY_TARGET. */
export const FOOD_RESPAWN_BATCH = 40;

/** Spawn weight probabilities for [small, medium, large] food */
export const FOOD_SPAWN_WEIGHTS: [number, number, number] = [0.93, 0.04, 0.03];

/** Point values for [small, medium, large] food */
export const FOOD_VALUES: [number, number, number] = [5, 15, 50];

/** Visual radii for [small, medium, large] food — reduced for cleaner look */
export const FOOD_RADII: [number, number, number] = [1.5, 2, 3];

/** Fill colors for [small, medium, large] food */
export const FOOD_COLORS: [string, string, string] = ['#34d399', '#38bdf8', '#f472b6'];

/** Glow colors for [small, medium, large] food */
export const FOOD_GLOW_COLORS: [string, string, string] = ['#10b981', '#0ea5e9', '#ec4899'];

/** Initial food spawn area radius (around origin at game start).
 *  Set to map size so food covers the entire arena. */
export const INITIAL_SPAWN_RADIUS = 29000;

/** Maximum food array length (safety cap to prevent unbounded memory growth).
 *  50K is sufficient for 1000-bot arena — 150K was overkill causing
 *  O(30K) iteration in maintainFoodAroundPlayer every 10 ticks. */
export const FOOD_MAX_COUNT = 50000;

// ============================================================================
// 4. COLLISION — snake radius, protection zones, death rules
// ============================================================================

/** Collision/food-eat radius — stays constant regardless of score (fair gameplay).
 *  Bigger snakes LOOK fatter (visual radius grows) but hitbox stays the same. */
export const SNAKE_RADIUS = 3;

/** Minimum visual body radius (at score 0). Thin starting snake. */
export const SNAKE_RADIUS_MIN = 3;

/** Primary radius growth rate: dominant early-game growth.
 *  Formula term: RATE_1 × ln(1 + score / OFFSET_1)
 *  Reaches ~13.6 radius at score 25K. */
export const SNAKE_RADIUS_GROWTH_RATE_1 = 2.36;

/** Primary radius growth offset. */
export const SNAKE_RADIUS_GROWTH_OFFSET_1 = 300;

/** Secondary radius growth rate: slow continuous growth at high scores.
 *  Prevents radius from completely flattening. */
export const SNAKE_RADIUS_GROWTH_RATE_2 = 0.65;

/** Secondary radius growth offset. */
export const SNAKE_RADIUS_GROWTH_OFFSET_2 = 100000;

/** @deprecated Use SNAKE_RADIUS_GROWTH_RATE_1 and SNAKE_RADIUS_GROWTH_RATE_2 */
export const SNAKE_RADIUS_GROWTH_RATE = SNAKE_RADIUS_GROWTH_RATE_1;
/** @deprecated Use SNAKE_RADIUS_GROWTH_OFFSET_1 */
export const SNAKE_RADIUS_GROWTH_OFFSET = SNAKE_RADIUS_GROWTH_OFFSET_1;

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

/** Milliseconds between boost food drops (~12.5 per second). */
export const BOOST_DROP_INTERVAL = 80;

/** Number of food orbs to drop per boost interval.
 *  1 drop × 80ms ≈ 12.5 food/sec. */
export const BOOST_DROP_COUNT = 1;

/** Minimum body segments required to boost.
 *  Kept as config reference but NOT enforced — score check is sufficient. */
export const BOOST_MIN_BODY = 3;

/** Minimum score required to boost — must have score to spend.
 *  Score > 0 required. Boost drains 1 point every 5 ticks (~12/sec).
 *  When score hits 0, boost automatically stops. */
export const BOOST_MIN_SCORE = 1;

/** Score deducted each interval while boosting (integer — no decimals in score).
 *  Combined with BOOST_SCORE_COST_INTERVAL: 1 point every 5 ticks ≈ 12/sec at 60fps. */
export const BOOST_SCORE_COST_AMOUNT = 1;

/** Ticks between each score deduction while boosting.
 *  At 60fps: 1 point every 5 ticks ≈ 12 points/sec (matches 80ms drop interval).
 *  Replaces old float-based BOOST_SCORE_COST_PER_TICK (0.08) which caused decimal scores. */
export const BOOST_SCORE_COST_INTERVAL = 5;


// ============================================================================
// 7. SPAWN — initial spawn radius, safe positioning, respawn timing
// ============================================================================

/** Map boundary radius — the arena is a circle of this radius.
 *  29000px = 58000×58000px map. Calculated for 1000 entities:
 *  - 4000px radius for 20 bots → 2,513,274 sq px per bot
 *  - 1000 bots → √(800,000,000/π) ≈ 28,284px → rounded to 29,000px
 *  - Each bot gets ~2.6M sq px of roaming space
 *  - ~320 sec to cross at base speed — massive arena feel */
export const SPAWN_RADIUS = 29000;

/** Minimum distance from all other snakes for safe spawn.
 *  Lower for 1000-bot arena — bots are smaller (avg score ~250) and map is huge. */
export const SAFE_SPAWN_DIST = 300;

/** Max attempts to find a safe spawn position before forcing placement */
export const SAFE_SPAWN_ATTEMPTS = 50;

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
export const CAMERA_BASE_ZOOM = 1.6;

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

// ============================================================================
// 13. ARENA CONFIG — per-arena presets for easy/medium/hard practice arenas
// ============================================================================

import type { ArenaConfig } from './types';

/** Build an ArenaConfig with all precomputed derived values */
function buildArenaConfig(overrides: Omit<ArenaConfig,
  'mapHalf' | 'mapRadiusSq' | 'despawnRadiusSq' | 'visibleRadiusSq'
  | 'mapGridCols' | 'mapGridRows'
  | 'sightRangeSq' | 'foodSeekRangeSq'
  | 'aiDistanceTierSq' | 'rankedAiDistanceTierSq' | 'playerFleeRangeSq'
>): ArenaConfig {
  const mapHalf = overrides.spawnRadius;
  const mapGridCols = Math.ceil(mapHalf * 2 / overrides.mapFoodGridSize);
  return {
    ...overrides,
    mapHalf,
    mapRadiusSq: mapHalf * mapHalf,
    despawnRadiusSq: overrides.foodDespawnRadius * overrides.foodDespawnRadius,
    visibleRadiusSq: overrides.foodVisibleRadius * overrides.foodVisibleRadius,
    mapGridCols,
    mapGridRows: mapGridCols,
    sightRangeSq: overrides.sightRange * overrides.sightRange,
    foodSeekRangeSq: overrides.foodSeekRange * overrides.foodSeekRange,
    aiDistanceTierSq: overrides.aiDistanceTier * overrides.aiDistanceTier,
    rankedAiDistanceTierSq: overrides.rankedAiDistanceTier * overrides.rankedAiDistanceTier,
    playerFleeRangeSq: overrides.playerFleeRange * overrides.playerFleeRange,
  };
}

// ── Easy: Spacious map, passive bots, abundant food ─────────────────────

const ARENA_EASY = buildArenaConfig({
  // Map: 29000px radius (58000×58000) — 2.6M sq px per bot
  spawnRadius: 29000,
  foodDespawnRadius: 30000,
  safeSpawnDist: 300,
  safeSpawnAttempts: 50,

  // Food: moderate density — player shouldn't gain 400 score in 5 sec at spawn
  foodMaxCount: 20000,
  foodDensityTarget: 400,
  foodVisibleRadius: 4000,
  foodRespawnBatch: 12,
  initialSpawnRadius: 29000,
  initialFoodTarget: 8000,
  mapFoodGridSize: 5000,
  mapFoodTargetPerCell: 40,
  mapFoodSpawnPerCell: 8,

  // Bots: 989 normal + 10 ranked = 999
  botMix: { predator: 160, coiler: 80, baiter: 120, interceptor: 120, grazer: 270, trapper: 239, ranked: 10 },
  normalBotScoreMin: 500,
  normalBotScoreMax: 8000,
  normalBotScoreExp: 1.5,
  rankedScores: [50000, 42000, 35000, 28000, 22000, 17000, 13000, 10000, 8500, 8000],

  // Spawn: spread across 1000-26000px ring
  botSpawnInner: 1000,
  botSpawnOuterFactor: 0.9,
  rankedHomeMin: 15000,
  rankedHomeMax: 25000,
  rankedHomeJitter: 3000,

  // AI: slow reactions, narrow full-AI tier (only nearby bots run personality)
  aiTickThrottle: 6,
  aiDistanceTier: 2000,
  rankedAiDistanceTier: 4000,
  respawnPerTick: 8,
  foodHashRebuildInterval: 6,
  mapFoodInterval: 30,
  playerFoodInterval: 10,
  retargetInterval: 60,

  // Behavior: standard aggression, bots flee player
  sightRange: 900,
  foodSeekRange: 1200,
  bodyScanDist: 180,
  headOnRange: 250,
  playerFleeRange: 350,
  foodAggressionMult: 1.0,
  hunterFraction: 0,
  botBoostMult: 0.3,
});

// ── Medium: Smaller map, balanced bots, moderate food ───────────────────

const ARENA_MEDIUM = buildArenaConfig({
  // Map: 20000px radius (40000×40000) — 1.26M sq px per bot (2.1× denser)
  spawnRadius: 20000,
  foodDespawnRadius: 21000,
  safeSpawnDist: 250,
  safeSpawnAttempts: 50,

  // Food: moderate, less abundant
  foodMaxCount: 15000,
  foodDensityTarget: 350,
  foodVisibleRadius: 3500,
  foodRespawnBatch: 10,
  initialSpawnRadius: 20000,
  initialFoodTarget: 6000,
  mapFoodGridSize: 4000,
  mapFoodTargetPerCell: 30,
  mapFoodSpawnPerCell: 6,

  // Bots: more aggressive mix (more predators/coilers/interceptors, fewer grazers)
  botMix: { predator: 220, coiler: 120, baiter: 90, interceptor: 180, grazer: 159, trapper: 220, ranked: 10 },
  normalBotScoreMin: 1000,
  normalBotScoreMax: 15000,
  normalBotScoreExp: 1.5,
  rankedScores: [70000, 60000, 50000, 42000, 35000, 28000, 22000, 17000, 12000, 10000],

  // Spawn: tighter ring proportional to smaller map
  botSpawnInner: 800,
  botSpawnOuterFactor: 0.88,
  rankedHomeMin: 10000,
  rankedHomeMax: 16000,
  rankedHomeJitter: 2000,

  // AI: faster reactions (every 4 ticks), wider full-AI tier
  aiTickThrottle: 4,
  aiDistanceTier: 1500,
  rankedAiDistanceTier: 3500,
  respawnPerTick: 8,
  foodHashRebuildInterval: 4,
  mapFoodInterval: 20,
  playerFoodInterval: 8,
  retargetInterval: 45,

  // Behavior: more aggressive, less fearful of player
  sightRange: 1000,
  foodSeekRange: 1400,
  bodyScanDist: 220,
  headOnRange: 300,
  playerFleeRange: 200,
  foodAggressionMult: 1.3,
  hunterFraction: 0.15,
  botBoostMult: 0.6,
});

// ── Hard: Tight map, aggressive hunters, scarce food ─────────────────────

const ARENA_HARD = buildArenaConfig({
  // Map: 14000px radius (28000×28000) — 616K sq px per bot (4.3× denser than easy)
  spawnRadius: 14000,
  foodDespawnRadius: 15000,
  safeSpawnDist: 200,
  safeSpawnAttempts: 50,

  // Food: scarce — forces competition
  foodMaxCount: 10000,
  foodDensityTarget: 250,
  foodVisibleRadius: 3000,
  foodRespawnBatch: 8,
  initialSpawnRadius: 14000,
  initialFoodTarget: 4000,
  mapFoodGridSize: 3500,
  mapFoodTargetPerCell: 20,
  mapFoodSpawnPerCell: 4,

  // Bots: very aggressive mix (predators/coilers/interceptors dominate)
  botMix: { predator: 280, coiler: 180, baiter: 60, interceptor: 220, grazer: 49, trapper: 200, ranked: 10 },
  normalBotScoreMin: 2000,
  normalBotScoreMax: 30000,
  normalBotScoreExp: 1.3,
  rankedScores: [100000, 85000, 70000, 58000, 48000, 38000, 30000, 23000, 18000, 12000],

  // Spawn: tight ring on small map
  botSpawnInner: 600,
  botSpawnOuterFactor: 0.85,
  rankedHomeMin: 7000,
  rankedHomeMax: 11000,
  rankedHomeJitter: 1500,

  // AI: very fast reactions (every 2 ticks), widest full-AI tier
  aiTickThrottle: 2,
  aiDistanceTier: 1200,
  rankedAiDistanceTier: 3000,
  respawnPerTick: 10,
  foodHashRebuildInterval: 2,
  mapFoodInterval: 15,
  playerFoodInterval: 6,
  retargetInterval: 30,

  // Behavior: very aggressive, bots DON'T flee player — they're the predators
  sightRange: 1200,
  foodSeekRange: 1600,
  bodyScanDist: 280,
  headOnRange: 350,
  playerFleeRange: 0,
  foodAggressionMult: 1.6,
  hunterFraction: 0.40,
  botBoostMult: 1.0,
});

/** Map from arena ID to its configuration */
export const ARENA_CONFIGS: Record<string, ArenaConfig> = {
  'practice-easy': ARENA_EASY,
  'practice-medium': ARENA_MEDIUM,
  'practice-hard': ARENA_HARD,
};

/** Default config used when no arena ID is specified (matches easy) */
export const DEFAULT_ARENA_CONFIG: ArenaConfig = ARENA_EASY;

/** Resolve arena config from arena ID, fallback to default */
export function getArenaConfig(arenaId?: string): ArenaConfig {
  return ARENA_CONFIGS[arenaId ?? ''] ?? DEFAULT_ARENA_CONFIG;
}

// ============================================================================
// 14. BOT SKIN PALETTE — shared color pairs for bot snake appearance
// ============================================================================
// Used by both offline (engine.ts) and online (game-server) to assign
// visually diverse colors to bots. Each entry: [bodyColor, headColor].
// Extracted from SLITHER_PRESETS so the server (no client deps) can use them.
// ============================================================================

export const BOT_SKIN_PALETTES: [string, string][] = [
  // Classic / Nature
  ['#06b6d4', '#0ea5e9'],   // Fish — cyan/blue
  ['#f59e0b', '#fbbf24'],   // Lion — gold
  ['#3b82f6', '#64748b'],   // Motorbike — blue/slate
  ['#fbbf24', '#d97706'],   // Coin — gold/amber
  ['#f59e0b', '#090d16'],   // Bumblebee — yellow/black
  ['#ef4444', '#ffffff'],   // Patriot — red/white
  ['#22c55e', '#ec4899'],   // Watermelon — green/pink
  ['#f97316', '#090d16'],   // Tiger — orange/black
  ['#10b981', '#ffffff'],   // Mint — emerald/white
  ['#ef4444', '#f59e0b'],   // Solar — red/gold
  ['#6366f1', '#a855f7'],   // Cosmic — indigo/purple
  ['#ef4444', '#1e293b'],   // Lava — red/dark
  ['#06b6d4', '#090d16'],   // Tron — cyan/black
  ['#64748b', '#3b82f6'],   // Mech — slate/blue
  ['#f59e0b', '#dc2626'],   // Gold Dragon — gold/red
  // Extra variety
  ['#a855f7', '#ec4899'],   // Orchid — purple/pink
  ['#14b8a6', '#2dd4bf'],   // Teal duo
  ['#84cc16', '#22c55e'],   // Lime duo
  ['#f43f5e', '#fb7185'],   // Rose duo
];

/** Get a random bot skin palette entry */
export function getRandomBotPalette(): [string, string] {
  return BOT_SKIN_PALETTES[Math.floor(Math.random() * BOT_SKIN_PALETTES.length)];
}

// ============================================================================
// 15. BOT SKIN OVERRIDES — real skinId assignments for bots (server-safe)
// ============================================================================
// Mirrors SLITHER_PRESETS from cosmetics-types.ts so the server (which cannot
// import client-only modules) can assign real preset skins to bots.
// Each entry: { skinId, bodyColor, headColor }. The client's renderSnakeFallback
// will look up getPresetVisualProps(skinId) to get the full multi-color pattern.
// ============================================================================

export interface BotSkinOverride {
  skinId: string;
  bodyColor: string;
  headColor: string;
}

export const BOT_SKIN_OVERRIDES: BotSkinOverride[] = [
  { skinId: 'preset-fish',          bodyColor: '#06b6d4', headColor: '#06b6d4' },
  { skinId: 'preset-lion',          bodyColor: '#f59e0b', headColor: '#f59e0b' },
  { skinId: 'preset-motorbike',     bodyColor: '#3b82f6', headColor: '#3b82f6' },
  { skinId: 'preset-coin',          bodyColor: '#fbbf24', headColor: '#fbbf24' },
  { skinId: 'preset-bumblebee',     bodyColor: '#f59e0b', headColor: '#f59e0b' },
  { skinId: 'preset-patriot',       bodyColor: '#ef4444', headColor: '#ef4444' },
  { skinId: 'preset-watermelon',    bodyColor: '#22c55e', headColor: '#22c55e' },
  { skinId: 'preset-tiger',         bodyColor: '#f97316', headColor: '#f97316' },
  { skinId: 'preset-mint',          bodyColor: '#10b981', headColor: '#10b981' },
  { skinId: 'preset-rainbow-unicorn', bodyColor: '#ef4444', headColor: '#ef4444' },
  { skinId: 'preset-brazil',        bodyColor: '#22c55e', headColor: '#22c55e' },
  { skinId: 'preset-france',        bodyColor: '#3b82f6', headColor: '#3b82f6' },
  { skinId: 'preset-pride',         bodyColor: '#ef4444', headColor: '#ef4444' },
  { skinId: 'preset-solar',         bodyColor: '#f59e0b', headColor: '#f59e0b' },
  { skinId: 'preset-cosmic',        bodyColor: '#6366f1', headColor: '#6366f1' },
  { skinId: 'preset-lava',          bodyColor: '#ef4444', headColor: '#ef4444' },
  { skinId: 'preset-tron',          bodyColor: '#06b6d4', headColor: '#06b6d4' },
  { skinId: 'preset-mech',          bodyColor: '#64748b', headColor: '#64748b' },
  { skinId: 'preset-gold-dragon',   bodyColor: '#f59e0b', headColor: '#f59e0b' },
];

/** Get a random bot skin override (real skinId + matching colors) */
export function getRandomBotSkinOverride(): BotSkinOverride {
  return BOT_SKIN_OVERRIDES[Math.floor(Math.random() * BOT_SKIN_OVERRIDES.length)];
}
