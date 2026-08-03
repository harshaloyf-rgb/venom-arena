/**
 * Venom Arena — render type definitions.
 *
 * All public interfaces/types shared across render sub-modules.
 */

import type { Skin } from '@/lib/game-config';
import type { SnakeSnapshot } from '@/lib/types';
import type { HatType, SnakeShape } from './render-snake-visuals';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Per-frame render context. Built fresh each frame by the game loop. */
export interface FrameRenderCtx {
  ctx: CanvasRenderingContext2D;
  /** Canvas CSS-pixel width (already DPR-adjusted in the backing store). */
  w: number;
  /** Canvas CSS-pixel height. */
  h: number;
  /** World-space x at the centre of the viewport. */
  camX: number;
  /** World-space y at the centre of the viewport. */
  camY: number;
  /** Camera zoom factor. */
  zoom: number;
  /** World bounds (square). */
  worldSize: number;
  /** Low-quality mode disables glow, simplifies food, fewer particles. */
  lowQuality: boolean;
  /** The local player's snake id (for head-glow + label emphasis). */
  myId: string;
  /** High-resolution timestamp (ms) for animations. */
  now: number;
  /** Cached metallic gradients, keyed by `${color}:${sizeBucket}`. */
  metallicCache: Map<string, CanvasGradient>;
  /** The player's equipped skin cosmetic (for player-only rendering tweaks). */
  playerSkin: Skin | undefined;
  /** Pixel ratio (for sizing glow radii in device pixels). */
  dpr: number;
  /** The player's equipped hat cosmetic. */
  playerHat?: HatType;
  /** The player's equipped body shape. */
  playerShape?: SnakeShape;
  /** Mouse/pointer direction (radians) for player pupil tracking. */
  pointerAngle?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface VisibleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Orb type configuration for the three visual tiers. */
export interface OrbConfig {
  radius: number;
  color: string;
  glowColor: string;
  shadowBlur: number;
  label: 'small' | 'medium' | 'large';
}

export interface MinimapArgs {
  ctx: CanvasRenderingContext2D;
  /** Top-left of minimap in CSS pixels. */
  x: number;
  y: number;
  /** Minimap size (square). */
  size: number;
  worldSize: number;
  /** Current breathing arena radius (world units). */
  arenaRadius: number;
  snakes: SnakeSnapshot[];
  myId: string;
  /**
   * World-space radius around the player the radar should cover. Snakes
   * outside this range are NOT rendered on the small corner minimap.
   * Defaults to WORLD_SIZE/2 (legacy full-radar behaviour) when omitted.
   */
  range?: number;
}

export interface FullMapArgs {
  ctx: CanvasRenderingContext2D;
  /** Canvas CSS-pixel width. */
  w: number;
  /** Canvas CSS-pixel height. */
  h: number;
  worldSize: number;
  /** Current breathing arena radius (world units). */
  arenaRadius: number;
  snakes: SnakeSnapshot[];
  myId: string;
}
