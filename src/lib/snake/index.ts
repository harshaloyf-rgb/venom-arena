// ============================================================================
// Venom Arena — Snake Engine Barrel Export
// ============================================================================

// Types
export type {
  Vec2, SnakeShape, BodyStyle, TaperStyle, HatType, SkinPattern,
  SegmentShape, IPathBuffer, SpiralTurnState, TurnMetadata,
  SkinRarity, RarityRenderConfig, AtlasRegion, SkinAtlas,
  ParticleEmitterConfig, SkinAsset,
  SkinPiece, CollectionSet, CraftingTransaction,
  SnakeIdentity, SnakeState, FoodOrb, StarChip, MapState, MapType,
  EmoteType, KillFeedEntry, KillCause,
  BotBehavior, BotAIState, ExtractionState,
  CollisionType, CollisionResult, DeathEvent,
  SnakeSnapshot, GameSnapshot,
  MatchOutcome, MatchResult,
  GamePhase, EndScreenState,
  InputState, JoystickState,
  CameraState, HUDState,
  ReplayFrame, ReplayState,
  ArenaTierConfig, RenderContext, RenderSegment, Particle,
  SliderDef, SliderCategory, FoodSize,
} from './types';

export {
  EMOTE_KEYS, EMOTE_DISPLAY, RARITY_CONFIG,
} from './types';

// Config
export {
  DEFAULT_SNAKE_CONFIG, ADMIN_SLIDERS, SLIDER_CATEGORIES,
  applyConfigOverrides,
} from './config';
export type { SnakeConfig } from './config';

// Pool
export { PathBuffer, ObjectPool, SnapshotBufferPool, scratchVec2 } from './pool';

// Engine
export {
  vec2, vec2Add, vec2Sub, vec2Dist, vec2DistSq, vec2Length, vec2Normalize, vec2Dot,
  angleBetween, normalizeAngle, angleDelta,
  moveHead, turnToward,
  calcVisualRadius, calcCollisionRadius, calcSegmentCount,
  circlesOverlap, pointInCircle,
  checkHeadOnBody, checkHeadOnHead, checkBoundaryCollision, checkAllCollisions,
  createFoodOrb, checkFoodEat, calcDeathFood,
  createDeathStars, checkStarCollect,
  calcBaseMapRadius, calcBreathingRadius, updateMapState,
  calcCommissionRate, calcBankedAmount,
  processBoostDrain,
  tickSpawnProtection, setEmote, tickEmote,
  createDeathEvent,
  calcXP, calcNewLevel,
  updateCachedRadii,
  // Fibonacci spiral
  detectTightTurn, enterSpiralMode, advanceSpiral, exitSpiral, buildTurnMetadata,
  // Main hot path
  tickSnakeMovement,
} from './engine';

// Skin types
export type {
  CustomSegment, CustomSkinState, SkinColorSequence,
  ResolvedSkin, ResolvedSegment, TaperFn,
} from './skin-types';
export {
  GENETIC_PALETTE, getTaperFunction, resolveSegmentShape,
  hexToRgb, rgbToHex, lerpColor, brighten, darken, neonGlow,
} from './skin-types';

// Skin resolver
export { resolveSkin, resolveSkinFromSnapshot, readCustomSkinState } from './skin-resolver';
