// ============================================================================
// Snake Game Types — Pure TypeScript types, no logic.
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
  player: Snake | null;
  /** Monotonic food ID counter */
  nextFoodId: number;
  /** Whether the player has seen the controls hint */
  showControls: boolean;
  /** Current tick count (monotonic, for snapshot sync) */
  tickCount: number;
  /** Extraction zone: center x, center y, current radius */
  extractionZone: { x: number; y: number; radius: number; active: boolean };
}

// ─── Input ──────────────────────────────────────────────────────────────────

/** Player input state per frame */
export interface InputState {
  /** Desired movement angle in radians */
  targetAngle: number;
  /** Whether boost is requested */
  boosting: boolean;
}
