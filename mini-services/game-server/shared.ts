// ============================================================================
// Shared Types, Config, and Utilities for the Venom Game Server
// Now imports from the unified core engine instead of copy-pasting.
// ============================================================================

// Re-export types from types.ts (core imports them but doesn't re-export)
export type {
  FoodOrb, StarChip, SkinRarity, FoodSize,
  SnakeSnapshot, ArenaSnapshot, TurnMetadata,
} from '../../src/lib/snake/types';

// Re-export everything from the core engine
export {
  // Core engine functions
  createSnake, findSafeSpawn, moveSnake,
  makeFood, spawnFoodBatch,
  checkFoodEating, checkCollisions, killSnake, respawnBots,
  checkStarChips, spawnStarChip,
  buildSnakeSnapshot, buildArenaSnapshot,
  // Types from core
  type SnakeLike, type SkinOverride, type MoveContext,
  type KillEvent, type CollisionResult,
  // Constants
  BOT_NAMES, SNAKE_PALETTES, FOOD_SIZES,
  SPACING_RATIO, BOOST_MIN_BODY_SCALED,
  COLLISION_DIST_SQ, EAT_DIST_SQ, STAR_CHIP_DIST_SQ,
} from '../../src/lib/snake/core';

// Re-export config (needed by index.ts and game-state.ts)
export {
  BASE_SPEED, BOOST_SPEED, SEGMENT_SPACING,
  START_LENGTH, computeBodyLength, computeBodyRadius,
  INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH, FOOD_DOWNSAMPLE_RADIUS, MAX_SNAKES_PER_SNAPSHOT,
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  BOOST_DROP_INTERVAL, BOOST_MIN_BODY, BOOST_MIN_SCORE,
  BOOST_DROP_COUNT, BOT_COUNT, BOT_MAX_TURN_RATE,
  BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  SAFE_SPAWN_DIST, SAFE_SPAWN_ATTEMPTS,
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD,
  EXTRACTION_SPEED_BONUS, STAR_CHIP_SPAWN_INTERVAL,
} from '../../src/lib/snake/config';

// Server-specific config constants (not in shared config.ts — online-only concepts)

/** Arena radius in pixels — circular boundary for the server arena */
export const ARENA_RADIUS = 5000;

/** Target food count maintained by count-based spawning (offline uses density-based) */
export const FOOD_COUNT_TARGET = 3000;

/** Radius around a position to spawn food into */
export const FOOD_SPAWN_AREA_RADIUS = 4000;

/** How long the extraction zone stays active (ms) */
export const EXTRACTION_ZONE_DURATION = 60000;

/** How often a new extraction zone spawns (ms) */
export const EXTRACTION_ZONE_SPAWN_INTERVAL = 120000;

/** Server bot count — overrides config.ts BOT_COUNT (which is 0 for offline) */
export const SERVER_BOT_COUNT = 1000;

// Re-export utilities
export { distSq, angleDirect } from '../../src/lib/snake/vec2';

// Re-export bot AI (generic interface)
export { getBotTarget, type BotSnakeInput } from '../../src/lib/snake/bot-ai';

// Re-export PathBuffer and SpatialHash
export { PathBuffer, type IPathBuffer } from '../../src/lib/snake/pool';
export { SpatialHash, type SpatialEntity } from '../../src/lib/snake/spatial-hash';
