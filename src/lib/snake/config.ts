// ============================================================================
// Venom Arena — Snake Configuration
// Single source of truth for ALL game parameters.
// Admin sliders read/write these values.
// ============================================================================

import type { SliderCategory, SliderDef } from './types';

// ── Main Config Interface ───────────────────────────────────────────────────

export interface SnakeConfig {
  // MAP & GRID (2)
  mapRadius: number;
  gridSize: number;

  // SNAKE BODY (6)
  startLength: number;
  minLength: number;
  maxLength: number;
  minThick: number;
  maxThick: number;
  segSpacing: number;

  // SPEED & TURN (5)
  baseSpeed: number;
  boostSpeed: number;
  turnThin: number;
  turnFat: number;
  turnBoost: number;

  // GROWTH & SCORE (4)
  ptsPerSegment: number;
  growthMult: number;
  scorePerPt: number;
  maxScore: number;

  // FOOD SPAWN (12)
  foodCount: number;
  foodCapMult: number;
  eatRadius: number;
  foodSmallValue: number;
  foodMedValue: number;
  foodLargeValue: number;
  foodSmallChance: number;
  foodMedChance: number;
  foodLargeChance: number;
  foodSmallRadius: number;
  foodMedRadius: number;
  foodLargeRadius: number;

  // BOOST DRAIN (8)
  drainRate: number;
  dropValue: number;
  dropSpread: number;
  burstCount: number;
  burstValue: number;
  scoreDrainPerSec: number;
  boostMinScore: number;
  boostDropEveryNFrames: number;

  // DEATH DROP (3)
  deathDropLargeChance: number;
  deathDropMedChance: number;
  deathDropMaxOrbs: number;

  // CAMERA (3)
  camMinZoom: number;
  camZoomSmooth: number;
  camFollowSpeed: number;

  // SKIN APPEARANCE (8)
  headSize: number;
  lightOffset: number;
  brightBoost: number;
  shadowDark: number;
  baseSize: number;
  maxSize: number;
  growthCurve: number;
  skinSegSpacing: number;

  // BOTS (7)
  botCount: number;
  botFoodScanRadius: number;
  botEvadeRadius: number;
  botRespawnDelay: number;
  botMinStartLength: number;
  botMaxStartLength: number;
  botSelfDestructThreshold: number;

  // COLLISION (1)
  skipSegs: number;

  // SPAWNING (2)
  spawnProtectionSeconds: number;
  safeSpawnMinDist: number;

  // EXTRACTION (1)
  extractSeconds: number;

  // MAP BREATHING (2)
  breathingAmplitude: number;
  breathingPeriodSeconds: number;

  // MAP SCALING (2)
  mapMinRadius: number;
  mapMaxRadius: number;

  // STAR CHIPS (1)
  starsPerDeath: number;

  // ONLINE (3)
  tickRateHz: number;
  broadcastRateHz: number;
  maxArenaPlayers: number;

  // REPLAY (1)
  replaySecondsBeforeDeath: number;

  // NEON GLOW (2)
  neonGlowBlur: number;
  neonGlowIntensity: number;

  // PATTERN ANIMATION (1)
  patternAnimSpeed: number;

  // FIBONACCI SPIRAL TURN (4)
  /** Turn sharpness threshold to trigger spiral (0-1, fraction of max turn rate). Admin-adjustable. */
  tightTurnThreshold: number;
  /** Spiral 'b' parameter tightness (0.01=tight, 0.2=loose) */
  spiralTightness: number;
  /** Minimum ticks in spiral before allowing exit */
  spiralMinDuration: number;
  /** Max theta per tick advancement in spiral */
  spiralThetaStep: number;

  // CLIENT EXTRAPOLATION (3)
  /** Client render FPS target */
  clientRenderFPS: number;
  /** Max extrapolation time in ms before forcing resync */
  extrapolationMaxDrift: number;
  /** Smoothing factor for position interpolation (0-1, lower=smoother) */
  extrapolationSmoothing: number;

  // CRAFTING (4)
  /** Pieces per level chest drop */
  craftingPiecesPerChest: number;
  /** Max pieces per collection set */
  craftingMaxSetSize: number;
  /** Chance of rare+ piece from chest (0-1) */
  craftingRarePieceChance: number;
  /** Chance of epic+ piece from chest (0-1) */
  craftingEpicPieceChance: number;

  // TEXTURE ATLAS (3)
  /** Atlas tile size in pixels (each body segment tile) */
  atlasTileSize: number;
  /** Head sprite size in pixels */
  atlasHeadSize: number;
  /** Number of skins per atlas row */
  atlasSkinsPerRow: number;

  // SNAPSHOT DOWNSAMPLING (1)
  /** Max path points per snake in network snapshot */
  snapshotMaxPathPoints: number;
}

// ── Default Values ──────────────────────────────────────────────────────────

export const DEFAULT_SNAKE_CONFIG: SnakeConfig = {
  // MAP & GRID
  mapRadius: 4000,
  gridSize: 80,

  // SNAKE BODY
  startLength: 20,
  minLength: 8,
  maxLength: 5000,
  minThick: 6,
  maxThick: 28,
  segSpacing: 5,

  // SPEED & TURN
  baseSpeed: 3.0,
  boostSpeed: 5.0,
  turnThin: 0.08,
  turnFat: 0.03,
  turnBoost: 0.06,

  // GROWTH & SCORE
  ptsPerSegment: 5,
  growthMult: 1.0,
  scorePerPt: 1,
  maxScore: 10000,

  // FOOD SPAWN
  foodCount: 1200,
  foodCapMult: 1.5,
  eatRadius: 15,
  foodSmallValue: 1,
  foodMedValue: 3,
  foodLargeValue: 5,
  foodSmallChance: 0.93,
  foodMedChance: 0.04,
  foodLargeChance: 0.03,
  foodSmallRadius: 3,
  foodMedRadius: 5,
  foodLargeRadius: 8,

  // BOOST DRAIN
  drainRate: 0.3,
  dropValue: 1,
  dropSpread: 30,
  burstCount: 3,
  burstValue: 1,
  scoreDrainPerSec: 30,
  boostMinScore: 8,
  boostDropEveryNFrames: 40,

  // DEATH DROP
  deathDropLargeChance: 0.3,
  deathDropMedChance: 0.35,
  deathDropMaxOrbs: 60,

  // CAMERA
  camMinZoom: 0.3,
  camZoomSmooth: 0.05,
  camFollowSpeed: 0.1,

  // SKIN APPEARANCE
  headSize: 1.15,
  lightOffset: 0.35,
  brightBoost: 70,
  shadowDark: 55,
  baseSize: 10,
  maxSize: 28,
  growthCurve: 0.4,
  skinSegSpacing: 5,

  // BOTS
  botCount: 30,
  botFoodScanRadius: 300,
  botEvadeRadius: 300,
  botRespawnDelay: 180,
  botMinStartLength: 15,
  botMaxStartLength: 40,
  botSelfDestructThreshold: 100,

  // COLLISION
  skipSegs: 5,

  // SPAWNING
  spawnProtectionSeconds: 4,
  safeSpawnMinDist: 500,

  // EXTRACTION
  extractSeconds: 3,

  // MAP BREATHING
  breathingAmplitude: 40,
  breathingPeriodSeconds: 10,

  // MAP SCALING
  mapMinRadius: 3000,
  mapMaxRadius: 16000,

  // STAR CHIPS
  starsPerDeath: 10,

  // ONLINE
  tickRateHz: 30,
  broadcastRateHz: 20,
  maxArenaPlayers: 1000,

  // REPLAY
  replaySecondsBeforeDeath: 15,

  // NEON GLOW
  neonGlowBlur: 12,
  neonGlowIntensity: 0.6,

  // PATTERN ANIMATION
  patternAnimSpeed: 0.1,

  // FIBONACCI SPIRAL TURN
  tightTurnThreshold: 0.20,   // Trigger spiral when turn sharpness < 20% of max turn rate
  spiralTightness: 0.08,     // Controls how tight the spiral loops are
  spiralMinDuration: 10,     // Minimum 10 ticks in spiral
  spiralThetaStep: 0.15,     // Max theta advancement per tick

  // CLIENT EXTRAPOLATION
  clientRenderFPS: 60,
  extrapolationMaxDrift: 200,     // Max 200ms drift before forced resync
  extrapolationSmoothing: 0.15,  // Lower = smoother, higher = more responsive

  // CRAFTING
  craftingPiecesPerChest: 2,
  craftingMaxSetSize: 30,
  craftingRarePieceChance: 0.25,
  craftingEpicPieceChance: 0.05,

  // TEXTURE ATLAS
  atlasTileSize: 32,
  atlasHeadSize: 48,
  atlasSkinsPerRow: 16,

  // SNAPSHOT DOWNSAMPLING
  snapshotMaxPathPoints: 60,
};

// ── Admin Slider Definitions (65+ sliders, 13 categories) ──────────────────

export const ADMIN_SLIDERS: SliderDef[] = [
  // MAP & GRID
  { key: 'mapRadius', label: 'Map Radius', min: 1000, max: 10000, step: 100, category: 'MAP & GRID' },
  { key: 'gridSize', label: 'Grid Size', min: 20, max: 200, step: 10, category: 'MAP & GRID' },

  // SNAKE BODY
  { key: 'startLength', label: 'Start Length', min: 5, max: 100, step: 1, category: 'SNAKE BODY' },
  { key: 'minLength', label: 'Min Length', min: 3, max: 20, step: 1, category: 'SNAKE BODY' },
  { key: 'maxLength', label: 'Max Length', min: 500, max: 20000, step: 100, category: 'SNAKE BODY' },
  { key: 'minThick', label: 'Min Thickness', min: 2, max: 15, step: 1, category: 'SNAKE BODY' },
  { key: 'maxThick', label: 'Max Thickness', min: 15, max: 50, step: 1, category: 'SNAKE BODY' },
  { key: 'segSpacing', label: 'Segment Spacing', min: 2, max: 15, step: 1, category: 'SNAKE BODY' },

  // SPEED & TURN
  { key: 'baseSpeed', label: 'Base Speed', min: 1, max: 8, step: 0.1, category: 'SPEED & TURN' },
  { key: 'boostSpeed', label: 'Boost Speed', min: 2, max: 12, step: 0.1, category: 'SPEED & TURN' },
  { key: 'turnThin', label: 'Turn Rate (Thin)', min: 0.01, max: 0.2, step: 0.01, category: 'SPEED & TURN' },
  { key: 'turnFat', label: 'Turn Rate (Fat)', min: 0.01, max: 0.15, step: 0.01, category: 'SPEED & TURN' },
  { key: 'turnBoost', label: 'Turn Rate (Boost)', min: 0.01, max: 0.15, step: 0.01, category: 'SPEED & TURN' },

  // GROWTH & SCORE
  { key: 'ptsPerSegment', label: 'Points per Segment', min: 1, max: 20, step: 1, category: 'GROWTH & SCORE' },
  { key: 'growthMult', label: 'Growth Multiplier', min: 0.1, max: 3.0, step: 0.1, category: 'GROWTH & SCORE' },
  { key: 'scorePerPt', label: 'Score per Point', min: 0.5, max: 5.0, step: 0.5, category: 'GROWTH & SCORE' },
  { key: 'maxScore', label: 'Max Score', min: 1000, max: 50000, step: 500, category: 'GROWTH & SCORE' },

  // FOOD SPAWN
  { key: 'foodCount', label: 'Food Count', min: 100, max: 5000, step: 100, category: 'FOOD SPAWN' },
  { key: 'foodCapMult', label: 'Food Cap Mult', min: 1.0, max: 3.0, step: 0.1, category: 'FOOD SPAWN' },
  { key: 'eatRadius', label: 'Eat Radius', min: 5, max: 40, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodSmallValue', label: 'Small Food Value', min: 1, max: 5, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodMedValue', label: 'Medium Food Value', min: 1, max: 10, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodLargeValue', label: 'Large Food Value', min: 1, max: 15, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodSmallChance', label: 'Small Chance', min: 0.5, max: 1.0, step: 0.01, category: 'FOOD SPAWN' },
  { key: 'foodMedChance', label: 'Medium Chance', min: 0.0, max: 0.3, step: 0.01, category: 'FOOD SPAWN' },
  { key: 'foodLargeChance', label: 'Large Chance', min: 0.0, max: 0.2, step: 0.01, category: 'FOOD SPAWN' },
  { key: 'foodSmallRadius', label: 'Small Radius', min: 2, max: 8, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodMedRadius', label: 'Medium Radius', min: 3, max: 10, step: 1, category: 'FOOD SPAWN' },
  { key: 'foodLargeRadius', label: 'Large Radius', min: 5, max: 15, step: 1, category: 'FOOD SPAWN' },

  // BOOST DRAIN
  { key: 'drainRate', label: 'Drain Rate', min: 0.1, max: 1.0, step: 0.05, category: 'BOOST DRAIN' },
  { key: 'dropValue', label: 'Drop Value', min: 0.5, max: 5, step: 0.5, category: 'BOOST DRAIN' },
  { key: 'dropSpread', label: 'Drop Spread', min: 5, max: 80, step: 5, category: 'BOOST DRAIN' },
  { key: 'burstCount', label: 'Burst Count', min: 1, max: 10, step: 1, category: 'BOOST DRAIN' },
  { key: 'burstValue', label: 'Burst Value', min: 0.5, max: 5, step: 0.5, category: 'BOOST DRAIN' },
  { key: 'scoreDrainPerSec', label: 'Score Drain/sec', min: 5, max: 100, step: 5, category: 'BOOST DRAIN' },

  // DEATH DROP
  { key: 'deathDropLargeChance', label: 'Death Large %', min: 0.0, max: 1.0, step: 0.05, category: 'DEATH DROP' },
  { key: 'deathDropMedChance', label: 'Death Med %', min: 0.0, max: 1.0, step: 0.05, category: 'DEATH DROP' },
  { key: 'deathDropMaxOrbs', label: 'Max Death Orbs', min: 10, max: 200, step: 5, category: 'DEATH DROP' },

  // CAMERA
  { key: 'camMinZoom', label: 'Min Zoom', min: 0.1, max: 0.8, step: 0.05, category: 'CAMERA' },
  { key: 'camZoomSmooth', label: 'Zoom Smooth', min: 0.01, max: 0.2, step: 0.01, category: 'CAMERA' },
  { key: 'camFollowSpeed', label: 'Follow Speed', min: 0.02, max: 0.3, step: 0.01, category: 'CAMERA' },

  // SKIN APPEARANCE
  { key: 'headSize', label: 'Head Size Mult', min: 1.0, max: 1.5, step: 0.05, category: 'SKIN APPEARANCE' },
  { key: 'lightOffset', label: 'Light Offset', min: 0.1, max: 0.5, step: 0.05, category: 'SKIN APPEARANCE' },
  { key: 'brightBoost', label: 'Highlight Bright', min: 20, max: 120, step: 5, category: 'SKIN APPEARANCE' },
  { key: 'shadowDark', label: 'Shadow Dark', min: 20, max: 100, step: 5, category: 'SKIN APPEARANCE' },
  { key: 'baseSize', label: 'Base Size', min: 5, max: 20, step: 1, category: 'SKIN APPEARANCE' },
  { key: 'maxSize', label: 'Max Size', min: 15, max: 50, step: 1, category: 'SKIN APPEARANCE' },
  { key: 'growthCurve', label: 'Growth Curve', min: 0.1, max: 1.0, step: 0.05, category: 'SKIN APPEARANCE' },

  // BOTS
  { key: 'botCount', label: 'Bot Count', min: 0, max: 1000, step: 10, category: 'BOTS' },
  { key: 'botFoodScanRadius', label: 'Food Scan Range', min: 50, max: 800, step: 50, category: 'BOTS' },
  { key: 'botEvadeRadius', label: 'Evade Radius', min: 50, max: 800, step: 50, category: 'BOTS' },
  { key: 'botRespawnDelay', label: 'Respawn Delay', min: 60, max: 600, step: 30, category: 'BOTS' },
  { key: 'botMinStartLength', label: 'Min Bot Start', min: 5, max: 30, step: 1, category: 'BOTS' },
  { key: 'botMaxStartLength', label: 'Max Bot Start', min: 20, max: 100, step: 5, category: 'BOTS' },
  { key: 'botSelfDestructThreshold', label: 'Self-Destruct Score', min: 50, max: 500, step: 10, category: 'BOTS' },

  // COLLISION
  { key: 'skipSegs', label: 'Neck Protection Segs', min: 1, max: 15, step: 1, category: 'COLLISION' },

  // FIBONACCI SPIRAL TURN
  { key: 'tightTurnThreshold', label: 'Tight Turn Threshold', min: 0.05, max: 0.5, step: 0.01, category: 'SPIRAL TURN' },
  { key: 'spiralTightness', label: 'Spiral Tightness', min: 0.01, max: 0.3, step: 0.01, category: 'SPIRAL TURN' },
  { key: 'spiralMinDuration', label: 'Spiral Min Duration', min: 3, max: 30, step: 1, category: 'SPIRAL TURN' },
  { key: 'spiralThetaStep', label: 'Spiral Theta Step', min: 0.05, max: 0.3, step: 0.01, category: 'SPIRAL TURN' },

  // CLIENT EXTRAPOLATION
  { key: 'extrapolationSmoothing', label: 'Extrapolation Smooth', min: 0.05, max: 0.5, step: 0.01, category: 'EXTRAPOLATION' },
  { key: 'extrapolationMaxDrift', label: 'Max Drift (ms)', min: 50, max: 500, step: 10, category: 'EXTRAPOLATION' },
];

// ── Slider Category Order ───────────────────────────────────────────────────

export const SLIDER_CATEGORIES: SliderCategory[] = [
  'MAP & GRID',
  'SNAKE BODY',
  'SPEED & TURN',
  'GROWTH & SCORE',
  'FOOD SPAWN',
  'BOOST DRAIN',
  'DEATH DROP',
  'CAMERA',
  'SKIN APPEARANCE',
  'BOTS',
  'COLLISION',
  'SPIRAL TURN',
  'EXTRAPOLATION',
];

// ── Utility: Apply admin overrides to config ────────────────────────────────

export function applyConfigOverrides(
  base: SnakeConfig,
  overrides: Partial<SnakeConfig>,
): SnakeConfig {
  return { ...base, ...overrides };
}
