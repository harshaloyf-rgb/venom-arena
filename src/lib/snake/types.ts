// ============================================================================
// Snake Game Types — Pure TypeScript types, no logic.
// Phase A: Extended with Fibonacci, rarity, crafting, and atlas types.
// ============================================================================

import type { IPathBuffer } from './pool';

// ─── Geometry ───────────────────────────────────────────────────────────────

/** 2D vector (lightweight, for non-hot-path use) */
export interface Vec2 {
  x: number;
  y: number;
}

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

/** Spatial hash cell coordinates */
export interface CellCoord {
  cx: number;
  cy: number;
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
}

/** A star chip (extraction zone collectible) */
export interface StarChip {
  id: number;
  x: number;
  y: number;
  value: number;
  radius: number;
  glowColor: string;
  color: string;
  spawnTime: number;
}

// ─── Skin & Rarity (Phase A types, used by Phases C/D) ─────────────────────

/** 4-tier skin rarity system */
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Rarity weight for random drops */
export interface RarityWeights {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

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

// ─── Fibonacci Spiral (Phase A types, implemented in Phase B) ───────────────

/** Spiral turn state — tracks progressive turn enhancement for circular motion */
export interface SpiralTurnState {
  /** Whether spiral assist is active */
  active: boolean;
  /** Consecutive ticks turning in the same direction (for entry detection) */
  consecutiveTurns: number;
  /** Ticks elapsed since spiral activated (for ramp-up) */
  ticksElapsed: number;
  /** Direction of the turn: +1 = clockwise, -1 = counter-clockwise */
  direction: 1 | -1;
}

/** Turn metadata attached to snapshots for client extrapolation */
export interface TurnMetadata {
  /** Snapshot tick when the turn was detected */
  tick: number;
  /** Snake ID */
  snakeId: string;
  /** Whether this is a Fibonacci spiral turn */
  isSpiral: boolean;
  /** Turn start angle (radians) */
  startAngle: number;
  /** Turn direction */
  direction: 1 | -1;
  /** Spiral theta at the time of snapshot */
  theta: number;
  /** Expected number of ticks for the spiral turn to complete */
  expectedDuration: number;
}

// ─── Crafting (Phase A types, API in Phase D) ──────────────────────────────

/** A skin piece owned by a player */
export interface SkinPiece {
  id: string;
  playerId: string;
  skinAssetId: string;
  rarity: SkinRarity;
  setName: string;
  /** Slot within the set (0-based) */
  slotIndex: number;
  obtainedAt: string;
  source: 'chest' | 'sacrifice' | 'admin';
}

/** A collectible set that can be completed for sacrifice */
export interface CollectionSet {
  id: string;
  name: string;
  rarity: SkinRarity;
  /** Required skin asset IDs to complete the set */
  requiredPieces: string[];
  /** Total number of pieces needed */
  pieceCount: number;
  /** Reward: skin asset ID from next rarity tier */
  rewardSkinId?: string;
}

/** A crafting transaction record */
export interface CraftingTransaction {
  id: string;
  playerId: string;
  type: 'chest_open' | 'sacrifice' | 'trade';
  inputPieces: string[];
  outputPiece: string;
  rarity: SkinRarity;
  timestamp: string;
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
  spiral: SpiralTurnState;
  /** Cached body radius (avoids recalculation) */
  bodyRadius: number;
  /** Tick accumulator for integer-based boost score cost */
  boostCostAccum?: number;

  // ── Skin fields (Phase A, rendering in Phase C) ──
  /** Current skin asset ID */
  skinId: string;
  /** Skin rarity */
  rarity: SkinRarity;
}

// ─── Game State ─────────────────────────────────────────────────────────────

/** Full game state */
export interface GameState {
  snakes: Map<string, Snake>;
  foods: FoodOrb[];
  /** Star chips in the arena (extraction zone) */
  starChips: StarChip[];
  player: Snake | null;
  /** Monotonic food ID counter */
  nextFoodId: number;
  /** Monotonic star chip ID counter */
  nextStarChipId: number;
  /** Whether the player has seen the controls hint */
  showControls: boolean;
  /** Current tick count (monotonic, for snapshot sync) */
  tickCount: number;
  /** Extraction zone: center x, center y, current radius */
  extractionZone: { x: number; y: number; radius: number; active: boolean };
  /** Obstacle walls for collision testing — array of line segments [{x1,y1,x2,y2}] */
  obstacles: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

// ─── Input ──────────────────────────────────────────────────────────────────

/** Player input state per frame */
export interface InputState {
  /** Desired movement angle in radians */
  targetAngle: number;
  /** Whether boost is requested */
  boosting: boolean;
}

// ─── Snapshot (Phase A type, used by Phase E server + Phase B client) ──────

/** Downsampled snapshot of a single snake for network broadcast */
export interface SnakeSnapshot {
  id: string;
  name: string;
  /** Head x,y */
  hx: number;
  hy: number;
  /** Current angle */
  angle: number;
  /** Body length (segment count) */
  length: number;
  /** Score */
  score: number;
  /** Alive? */
  alive: boolean;
  /** Skin color (hex) */
  color: string;
  /** Head color (hex) */
  headColor: string;
  /** Body radius */
  bodyRadius: number;
  /** Boosting? */
  boosting: boolean;
  /** Skin ID */
  skinId: string;
  /** Skin rarity */
  rarity: SkinRarity;
  /** Body path x,y pairs (downsampled — every Nth segment) */
  bodyX: Float32Array;
  bodyY: Float32Array;
  bodyLen: number;
  /** Turn metadata if a spiral turn is active */
  turn?: TurnMetadata;
}

/** Full arena snapshot for network broadcast */
export interface ArenaSnapshot {
  /** Server tick when this snapshot was taken */
  tick: number;
  /** Server timestamp (ms) */
  timestamp: number;
  /** Snake snapshots */
  snakes: SnakeSnapshot[];
  /** Food positions (downsampled, only near players) */
  foods: Array<{ id: number; x: number; y: number; size: FoodSize; value: number }>;
  /** Star chip positions */
  starChips: Array<{ id: number; x: number; y: number; value: number }>;
  /** Extraction zone state */
  extraction: { x: number; y: number; radius: number; active: boolean };
  /** Obstacle wall segments */
  obstacles: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}
