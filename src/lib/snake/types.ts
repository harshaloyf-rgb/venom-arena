// ============================================================================
// Snake Game Types — Pure TypeScript types, no logic.
// ============================================================================

import type { IPathBuffer } from './pool';

/** Camera state for rendering */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Viewport bounds for culling off-screen rendering */
export interface Viewport {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

// ─── Food ───────────────────────────────────────────────────────────────────

/** Food orb size categories */
export type FoodSize = 'small' | 'medium' | 'large';

/** A food orb in the arena */
export interface FoodOrb {
  id: number;
  x: number;
  y: number;
  size: FoodSize;
  value: number;
  radius: number;
  color: string;
  glowColor: string;
  /** True when food is within the magnet pull zone and being attracted toward a head */
  magnetized: boolean;
}

// ─── Star Chip (Online Mode) ─────────────────────────────────────────────
// Dropped when a real player dies. Each star = carriedChips ÷ 10.
// Only real players can collect stars. Bots cannot see or collect them.

export interface StarOrb {
  id: number;
  x: number;
  y: number;
  /** Chip value of this star (carriedChips / 10) */
  value: number;
  /** Timestamp (ms) when spawned */
  spawnTime: number;
}


// ─── Skin & Rarity (Phase A types, used by Phases C/D) ─────────────────────

/** 4-tier skin rarity system */
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** A single skin asset definition */
export interface SkinAsset {
  id: string;
  name: string;
  rarity: SkinRarity;
  /** Body fill color (hex) */
  bodyColor: string;
  /** Head fill color (hex) */
  headColor: string;
  /** Accent/trim color */
  accentColor?: string;
  /** Pattern type for body segments */
  pattern?: 'solid' | 'striped' | 'spotted' | 'gradient' | 'spiral' | 'cyber' | 'lava' | 'pulse';
  /** Animation type for epic+ rarity */
  animation?: 'none' | 'pulse' | 'flow' | 'glow' | 'lava' | 'cyberpulse';
  /** Whether legendary particles are emitted */
  hasParticles?: boolean;
}

/** UV-like region in a texture atlas */
export interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Complete texture atlas for one skin */
export interface SkinAtlas {
  skinId: string;
  canvas: OffscreenCanvas;
  rarity: SkinRarity;
  /** Head sprite region */
  head: AtlasRegion;
  /** Body segment sprite regions (indexed by position) */
  body: AtlasRegion[];
  /** Tail sprite region */
  tail: AtlasRegion;
}

/** Particle emitter config for legendary skins */
export interface ParticleEmitterConfig {
  /** Particles per second */
  rate: number;
  /** Initial speed (px/s) */
  speed: number;
  /** Lifetime in seconds */
  lifetime: number;
  /** Particle radius */
  radius: number;
  /** Color (hex) */
  color: string;
  /** Spread angle in radians (0 = straight back) */
  spread: number;
  /** Gravity (negative = float up) */
  gravity: number;
}

// ─── Snake ──────────────────────────────────────────────────────────────────

/** A snake (player or bot) — uses PathBuffer for zero-alloc path history */
export interface Snake {
  id: string;
  name: string;
  /** Zero-alloc path buffer. Logical index 0 = HEAD. */
  path: IPathBuffer;
  /** Current movement angle in radians */
  angle: number;
  /** Previous tick's angle (for turn detection) */
  prevAngle: number;
  /** Current movement speed */
  speed: number;
  /** Accumulated score from eating food */
  score: number;
  /** Carried chips (online only): buy-in + star values collected. Independent of score. */
  carriedChips: number;
  /** Whether the snake is currently boosting */
  boosting: boolean;
  /** Whether the snake is alive */
  alive: boolean;
  /** Whether this is a bot */
  isBot: boolean;
  /** Whether this is the player-controlled snake */
  isPlayer: boolean;
  /** Timestamp (ms) when this snake spawned */
  spawnTime: number;
  /** Body fill color */
  color: string;
  /** Head fill color */
  headColor: string;
  /** Last time a boost food was dropped (ms) */
  lastBoostDrop: number;
  /** Current target angle (used for smooth turning) */
  targetAngle: number;

  // ── Fibonacci spiral fields (Phase A, logic in Phase B) ──
  /** Spiral turn state for this snake */
  spiral: {
    /** Whether spiral assist is active */
    active: boolean;
    /** Consecutive ticks turning in the same direction (for entry detection) */
    consecutiveTurns: number;
    /** Ticks elapsed since spiral activated (for ramp-up) */
    ticksElapsed: number;
    /** Direction of the turn: +1 = clockwise, -1 = counter-clockwise */
    direction: 1 | -1;
  };
  /** Cached body radius (avoids recalculation) */
  bodyRadius: number;
  /** Cached body length in segments (avoids Math.log per tick/frame) */
  cachedBodyLength: number;
  /** Score value that produced cachedBodyLength and bodyRadius — invalidates cache when score changes */
  cachedBodyScore: number;
  /** Cached visual tail path index (avoids sqrt-walk per tick in collision) */
  cachedVisualTailIdx: number;
  /** Tick accumulator for integer-based boost score cost */
  boostCostAccum?: number;

  // ── Interpolation fields (P0: render-time smoothing) ──
  /** Head X before the most recent tick (for render interpolation) */
  prevHeadX: number;
  /** Head Y before the most recent tick (for render interpolation) */
  prevHeadY: number;
  /** Smoothed brake factor (P1: eliminates instant SHARP_TURN_BRAKE speed jumps) */
  smoothBrakeFactor: number;

  // ── Skin fields (Phase A, rendering in Phase C) ──
  /** Current skin asset ID */
  skinId: string;
  /** Skin rarity */
  rarity: SkinRarity;
}

// ─── Arena Config ─────────────────────────────────────────────────────────

/** Per-arena configuration that controls map size, food, bots, and AI behavior */
export interface ArenaConfig {
  // ── Map ──
  /** Arena boundary radius (px) */
  spawnRadius: number;
  /** Food beyond this distance from origin gets despawned */
  foodDespawnRadius: number;
  /** Minimum distance from other snakes for safe spawn */
  safeSpawnDist: number;
  /** Max attempts to find safe spawn position */
  safeSpawnAttempts: number;

  // ── Food ──
  foodMaxCount: number;
  foodDensityTarget: number;
  foodVisibleRadius: number;
  foodRespawnBatch: number;
  /** Initial food spawn area radius */
  initialSpawnRadius: number;
  /** Target initial food count (seeded incrementally) */
  initialFoodTarget: number;
  mapFoodGridSize: number;
  mapFoodTargetPerCell: number;
  mapFoodSpawnPerCell: number;

  // ── Bots ──
  botMix: { predator: number; coiler: number; baiter: number; interceptor: number; grazer: number; trapper: number; ranked: number };
  /** Normal bot score range [min, max] */
  normalBotScoreMin: number;
  normalBotScoreMax: number;
  /** Power curve exponent for score distribution */
  normalBotScoreExp: number;
  /** Pre-set scores for ranked bots (index 0 = rank 1) */
  rankedScores: number[];

  // ── Bot Spawning ──
  /** Min radius from center for normal bot spawn */
  botSpawnInner: number;
  /** Factor × spawnRadius for max bot spawn distance */
  botSpawnOuterFactor: number;
  /** Ranked bot home radius range [min, max] */
  rankedHomeMin: number;
  rankedHomeMax: number;
  /** Jitter range for ranked home radius */
  rankedHomeJitter: number;

  // ── AI Performance ──
  /** AI runs every N ticks (lower = smarter but heavier) */
  aiTickThrottle: number;
  /** Distance threshold for lite AI (skip body scan) */
  aiDistanceTier: number;
  /** Distance threshold for ranked lite AI */
  rankedAiDistanceTier: number;
  /** Dead bots respawned per tick */
  respawnPerTick: number;
  /** Food hash rebuild interval (ticks) */
  foodHashRebuildInterval: number;
  /** Map food maintenance interval (ticks) */
  mapFoodInterval: number;
  /** Player food maintenance interval (ticks) */
  playerFoodInterval: number;
  /** Retarget interval for bot AI (ticks) */
  retargetInterval: number;

  // ── AI Behavior ──
  /** Bot sight range (px) */
  sightRange: number;
  /** Food seek range (px) */
  foodSeekRange: number;
  /** Body scan distance ahead (px) */
  bodyScanDist: number;
  /** Head-on threat detection range (px) */
  headOnRange: number;
  /** Range at which normal bots flee the player (0 = never flee) */
  playerFleeRange: number;
  /** Food aggression multiplier (1.0 = default) */
  foodAggressionMult: number;
  /** Fraction of aggressive bots that permanently hunt the player (0 = none, 0.4 = 40%) */
  hunterFraction: number;
  /** Offensive boost multiplier (0 = never boost offensively, 1 = always boost when AI wants) */
  botBoostMult: number;

  // ── Precomputed (set by buildArenaConfig) ──
  mapHalf: number;
  mapRadiusSq: number;
  despawnRadiusSq: number;
  visibleRadiusSq: number;
  mapGridCols: number;
  mapGridRows: number;
  sightRangeSq: number;
  foodSeekRangeSq: number;
  aiDistanceTierSq: number;
  rankedAiDistanceTierSq: number;
  playerFleeRangeSq: number;
}

// ─── Game State ─────────────────────────────────────────────────────────────

/** Full game state */
export interface GameState {
  snakes: Map<string, Snake>;
  foods: FoodOrb[];
  /** Star chips dropped by dead real players (online only) */
  stars: StarOrb[];
  /** Monotonic star ID counter */
  nextStarId: number;
  player: Snake | null;
  /** Monotonic food ID counter */
  nextFoodId: number;
  /** Whether the player has seen the controls hint */
  showControls: boolean;
  /** Current tick count (monotonic, for snapshot sync) */
  tickCount: number;
  /** Extraction zone: center x, center y, current radius */
  extractionZone: { x: number; y: number; radius: number; active: boolean };
  /** Whether offline bots are enabled (false in online mode) */
  botsEnabled: boolean;
  /** Per-arena configuration (map size, food, bots, AI) */
  arenaConfig: ArenaConfig;
  /** Current pulsing boundary radius (changes every tick — 30s shrink, 30s grow) */
  boundaryRadius: number;
}

// ─── Input ──────────────────────────────────────────────────────────────────

/** Player input state per frame */
export interface InputState {
  /** Desired movement angle in radians */
  targetAngle: number;
  /** Whether boost is requested */
  boosting: boolean;
}
