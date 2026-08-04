// ============================================================================
// Snake Game Types — Pure TypeScript types, no logic.
// ============================================================================

/** 2D vector */
export interface Vec2 {
  x: number;
  y: number;
}

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

/** A snake (player or bot) */
export interface Snake {
  id: string;
  name: string;
  /** Path history: segments[0] is the HEAD position */
  segments: Vec2[];
  /** Current movement angle in radians */
  angle: number;
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
}

/** Full game state */
export interface GameState {
  snakes: Map<string, Snake>;
  foods: FoodOrb[];
  player: Snake | null;
  /** Monotonic food ID counter */
  nextFoodId: number;
  /** Whether the player has seen the controls hint */
  showControls: boolean;
}

/** Player input state per frame */
export interface InputState {
  /** Desired movement angle in radians */
  targetAngle: number;
  /** Whether boost is requested */
  boosting: boolean;
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
