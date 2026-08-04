// ============================================================================
// offline-constants.ts — All module-level constants for the offline engine.
// ============================================================================

// ----------------------------------------------------------------------------
// ⚠️  PHASE GATING — DO NOT MODIFY WITHOUT PROJECT LEAD APPROVAL ⚠️
// ----------------------------------------------------------------------------
// Current active phase: Pre-Phase-A
//
// Phase A features (DISABLED — set to true ONLY when Phase A begins):
//   - Self-collision (head hits own body)
//   - Head-on-head collision (two heads collide, boost-aware resolution)
//   - Boost drain (boosting costs score, shrinks body, drops food from tail)
//   - WASD-exclusive steering mode
//   - Growth multiplier ×0.25
//   - Boost config changes (speed/duration tuning)
//
// Any agent adding a feature tagged "Phase A" MUST check this flag first.
// If PHASE_A_ENABLED is false, the code MUST be commented out or guarded.
// ----------------------------------------------------------------------------

/** Set to `true` ONLY when Phase A development officially begins. */
export const PHASE_A_ENABLED = false;

import {
  DEFAULT_SNAKE_CONFIG,
} from '@/lib/snake-engine';
import type { BotPersonality } from './offline-types';

/** Duration in ms for the extraction mechanic (matches snake-engine default) */
export const EXTRACT_DURATION_MS = 3000;

// ----------------------------------------------------------------------------
// Particles & rendering
// ----------------------------------------------------------------------------

export const MAX_PARTICLES = 200;
export const MAX_SNAPSHOT_POINTS = 60;

// ----------------------------------------------------------------------------
// FPS / adaptive quality thresholds
// ----------------------------------------------------------------------------

export const FPS_LOW_THRESHOLD = 40;
export const FPS_HIGH_THRESHOLD = 55;
export const FPS_LOW_DURATION_MS = 2000;
export const FPS_HIGH_DURATION_MS = 5000;

// ----------------------------------------------------------------------------
// Input thresholds
// ----------------------------------------------------------------------------

export const MOUSE_DEADZONE_PX = 15;
export const JOYSTICK_DEADZONE = 0.18;
export const JOYSTICK_MAX_RADIUS_PX = 70;
export const JOYSTICK_BOOST_MAGNITUDE = 0.6;

// ----------------------------------------------------------------------------
// Bot AI
// ----------------------------------------------------------------------------

export const BOT_THINK_INTERVAL_MS = 120;
export const BOT_THINK_JITTER_MS = 80;
export const BOT_THREAT_SCAN_RADIUS = 250;
export const BOT_MAX_TURN_PER_TICK = 0.22;
export const BOT_PREDICT_AHEAD_TICKS = 8;
export const BOT_PREDICT_SPEED = DEFAULT_SNAKE_CONFIG.baseSpeed * 1.5;
export const PERSONALITIES: BotPersonality[] = [
  'scavenger',
  'opportunist',
  'hunter',
  'extractor',
  'coward',
];

export const QUICK_EMOTES = [
  'GG! 🏆',
  'Target Spot! 🎯',
  'Fleeing! 🏃💨',
  'Get Ripped! 💪',
  'Extracting soon! ⚡',
];

// ----------------------------------------------------------------------------
// Virtual bot pool
// ----------------------------------------------------------------------------

export const VIRTUAL_BOT_COUNT = 1000;
/** activate virtual bots within this distance of player */
export const ACTIVATION_RADIUS = 2500;
/** deactivate active bots beyond this distance (hysteresis) */
export const DEACTIVATION_RADIUS = 3500;
/** max active bots at any time */
export const MAX_ACTIVE_BOTS = 60;
/** cheap movement speed for inactive virtual bots */
export const VIRTUAL_BOT_SPEED = 2.5;
/** virtual bots are spread within this radius of player */
export const VIRTUAL_WORLD_RADIUS = 8000;

// ----------------------------------------------------------------------------
// Food spawning
// ----------------------------------------------------------------------------

/** Food spawn radius around player (primary cluster). */
export const FOOD_SPAWN_RADIUS_NEAR = 1500;
/** Some food scattered further out. */
export const FOOD_SPAWN_RADIUS_FAR = 2500;
/** Fraction of replenishment food that spawns far. */
export const FOOD_FAR_FRACTION = 0.15;

// ----------------------------------------------------------------------------
// Opacity layering
// ----------------------------------------------------------------------------

/** Opacity layering proximity factor (multiplied by sum of sizes). */
export const OPACITY_PROXIMITY_FACTOR = 3;
/** Opacity to which the larger snake fades. */
export const OPACITY_FADE_TO = 0.75;

// ----------------------------------------------------------------------------
// Physics tick
// ----------------------------------------------------------------------------

/** Physics tick interval (ms) — 30 Hz. */
export const TICK_MS = 33;

// ----------------------------------------------------------------------------
// Replay recording
// ----------------------------------------------------------------------------

/** 15s at 30Hz before death (circular) */
export const REPLAY_PRE_MAX = 450;
/** 15s at 30Hz after death (linear) */
export const REPLAY_POST_MAX = 450;
/** only record snakes within this radius of camera */
export const REPLAY_VISIBLE_RADIUS = 2500;
/** downsample snake points for replay */
export const REPLAY_MAX_SNAKE_POINTS = 30;
