'use client';

import type { GameSnapshot } from '@/lib/types';

// ---------------------------------------------------------------------------
// Shared types used by game-canvas.tsx and its extracted hooks.
// ---------------------------------------------------------------------------

export type Phase = 'connecting' | 'playing' | 'ended';

export interface KillerInfo {
  name?: string;
  tag?: string;
  color?: string;
  isBot?: boolean;
}

export interface JoystickState {
  active: boolean;
  pointerId: number;
  originX: number;
  originY: number;
  curX: number;
  curY: number;
}

export interface EndScreenState {
  outcome: 'extract' | 'death';
  killer?: KillerInfo;
  result?: import('@/lib/types').MatchResult;
  durationSeconds: number;
  carriedChips: number;
  score: number;
  /** Combined replay frames: 15s pre-death + 15s post-death. */
  replayFrames?: GameSnapshot[];
  /** The player's snake id — used to follow them in replay. */
  replayMyId?: string;
  /** Index in replayFrames array where the death occurs. */
  replayDeathFrameIdx?: number;
}
