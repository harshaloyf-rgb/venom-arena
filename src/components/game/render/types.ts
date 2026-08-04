// ============================================================================
// Venom Arena — Renderer Types
// Render-only types used across all render modules.
// ============================================================================

import type {
  CameraState,
  HUDState,
  KillFeedEntry,
  Particle,
  SnakeState,
  SnakeSnapshot,
  RenderSegment,
  FoodOrb,
  StarChip,
  MapState,
  SnakeIdentity,
  HatType,
  SegmentShape,
  SnakeShape,
} from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';
import type { ResolvedSkin, ResolvedSegment } from '@/lib/snake/skin-types';

// Re-export everything needed by render consumers
export type {
  CameraState,
  HUDState,
  KillFeedEntry,
  Particle,
  SnakeState,
  SnakeSnapshot,
  RenderSegment,
  FoodOrb,
  StarChip,
  MapState,
  SnakeConfig,
  SnakeIdentity,
  ResolvedSkin,
  HatType,
  SegmentShape,
  SnakeShape,
  ResolvedSegment,
};

// ── Render-Only Types ───────────────────────────────────────────────────────

/** Unified snake input for rendering (works with both local and network snakes) */
export interface RenderSnake {
  id: string;
  name: string;
  tag: string;
  isBot: boolean;
  isPlayer: boolean;
  headX: number;
  headY: number;
  angle: number;
  score: number;
  alive: boolean;
  boosting: boolean;
  spawnProtected: boolean;
  skinId: string;
  skinPattern: string;
  bodyStyle: string;
  taperStyle: string;
  hat: HatType;
  shape: SnakeShape;
  primaryColor: string;
  secondaryColor: string;
  carriedChips: number;
  kills: number;
  starsCollected: number;
  activeEmote: string | null;
  emoteFramesLeft: number;
  identity: SnakeIdentity;
}

/** Particle array for the overlay system */
export interface ParticleSystem {
  particles: Particle[];
}

/** Arena leader entry for HUD display */
export interface ArenaLeader {
  name: string;
  score: number;
  isPlayer: boolean;
}
