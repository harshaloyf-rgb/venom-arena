// ============================================================================
// Venom Arena — Core Game Types (Complete)
// Pure data structures. No side effects. No DOM. No canvas.
// Importable by both client (browser) and server (Bun/Node).
// ============================================================================

// ── Primitives ──────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ── Path Buffer Interface (implemented by pool.PathBuffer) ─────────────────
// Zero-allocation circular buffer for snake body path.
// Stored as Float32Array internally. No GC pressure.

export interface IPathBuffer {
  readonly length: number;
  getX(i: number): number;
  getY(i: number): number;
  getAngle(i: number): number;
  tailX(): number;
  tailY(): number;
  prepend(x: number, y: number, angle: number): void;
  trimTail(n: number): void;
  reset(): void;
  fillInitial(headX: number, headY: number, angle: number, count: number, spacing: number): void;
  downsample(outX: Float32Array, outY: Float32Array, maxPoints: number): number;
}

// ── Snake Appearance ─────────────────────────────────────────────────────────

export type SnakeShape = 'circle' | 'box' | 'triangle' | 'mix_ct' | 'mix_cb' | 'mix_bt' | 'mix_all';
export type BodyStyle = 'smooth' | 'dragon' | 'armored' | 'crystal' | 'obsidian' | 'basilisk';
export type TaperStyle = 'natural' | 'uniform' | 'wave' | 'heavy';
export type HatType = 'none' | 'tophat' | 'crown' | 'cap' | 'santa' | 'party' | 'horns';
export type SkinPattern = 'solid' | 'rainbow' | 'neon' | 'glow' | 'metallic' | 'pulse' | 'zebra' | 'camo' | 'cyber';

/** Base segment shape used in custom skin editor */
export type SegmentShape = 'circle' | 'square' | 'diamond' | 'spike';

// ── Fibonacci Spiral Turn System ────────────────────────────────────────────

/** Active spiral turn state on a snake */
export interface SpiralTurnState {
  active: boolean;
  /** Pivot point X where the spiral turn started */
  pivotX: number;
  /** Pivot point Y */
  pivotY: number;
  /** Snake's angle when spiral was triggered */
  entryAngle: number;
  /** Snake's speed when spiral was triggered */
  entrySpeed: number;
  /** Theta parameter at spiral start */
  startTheta: number;
  /** Current theta (advances each tick) */
  currentTheta: number;
  /** Spiral 'a' parameter: r = a * e^(b * theta). Distance from pivot to head at entry. */
  spiralA: number;
  /** Spiral 'b' parameter: controls tightness of loops */
  spiralB: number;
  /** Tick number when spiral started */
  startTick: number;
}

/** Turn metadata sent to client for local 60fps extrapolation */
export interface TurnMetadata {
  isInSpiral: boolean;
  pivotX: number;
  pivotY: number;
  spiralA: number;
  spiralB: number;
  currentTheta: number;
  entryAngle: number;
  entrySpeed: number;
  headX: number;
  headY: number;
  headAngle: number;
  isBoosting: boolean;
  visualRadius: number;
  score: number;
  tick: number;
}

// ── Skin Rarity System ─────────────────────────────────────────────────────

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** How a rarity tier renders */
export interface RarityRenderConfig {
  common:  { staticTexture: true; animated: false; particles: false; shaderType: 'none' };
  rare:    { staticTexture: true; animated: false; particles: false; shaderType: 'color_blend' };
  epic:    { staticTexture: true; animated: true;  particles: false; shaderType: 'uv_offset' };
  legendary: { staticTexture: true; animated: true;  particles: true;  shaderType: 'particle_emitter' };
}

export const RARITY_CONFIG: Record<SkinRarity, { animated: boolean; particles: boolean; label: string; color: string; glowIntensity: number }> = {
  common:    { animated: false, particles: false, label: 'Common',    color: '#9CA3AF', glowIntensity: 0 },
  rare:      { animated: false, particles: false, label: 'Rare',      color: '#3B82F6', glowIntensity: 0.15 },
  epic:      { animated: true,  particles: false, label: 'Epic',      color: '#A855F7', glowIntensity: 0.4 },
  legendary: { animated: true,  particles: true,  label: 'Legendary', color: '#F59E0B', glowIntensity: 0.7 },
};

// ── Texture Atlas System ────────────────────────────────────────────────────

/** A region within a texture atlas (pixel coordinates) */
export interface AtlasRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Modular skin asset regions in the atlas */
export interface SkinAtlas {
  head: AtlasRegion;
  bodyTile: AtlasRegion;
  tailCap: AtlasRegion;
  /** For epic: animation type */
  animType?: 'pulse' | 'flow' | 'glow' | 'lava' | 'cyberpulse';
  /** For epic: UV offset speed */
  animSpeed?: number;
  /** For legendary: head particle emitter config */
  headParticle?: ParticleEmitterConfig;
  /** For legendary: tail particle emitter config */
  tailParticle?: ParticleEmitterConfig;
}

/** Particle emitter config for legendary skins */
export interface ParticleEmitterConfig {
  type: 'glow' | 'bubbles' | 'sparkles' | 'fire' | 'void' | 'electric';
  color: string;
  secondaryColor?: string;
  rate: number;          // Particles per second
  speed: number;         // Initial velocity
  lifetime: number;      // Seconds
  size: number;          // Particle size in px
  spread: number;        // Spread angle in radians
  gravity?: number;      // Downward pull (0 = none)
  glow?: number;         // Shadow blur for glow effect
}

// ── Skin Asset (full skin definition with atlas + rarity) ───────────────────

export interface SkinAsset {
  id: string;
  name: string;
  rarity: SkinRarity;
  description?: string;
  /** Index into the global texture atlas */
  atlasIndex: number;
  /** Modular atlas regions */
  atlas: SkinAtlas;
  /** Base colors for pattern generation */
  primaryColor: string;
  secondaryColor: string;
  /** Pattern for color generation */
  pattern: SkinPattern;
  /** Body style this skin applies */
  bodyStyle: BodyStyle;
  /** Taper style */
  taperStyle: TaperStyle;
  /** Hat override (empty = use player's selected hat) */
  hatOverride?: HatType;
  /** Whether this is a premium/purchasable skin */
  isPremium: boolean;
  /** Chip cost to purchase */
  cost?: number;
  /** Collection set ID this skin belongs to (for crafting) */
  collectionSetId?: string;
}

// ── Crafting & Inventory System ────────────────────────────────────────────

/** A single skin piece (partial unlock) */
export interface SkinPiece {
  id: string;
  playerId: string;
  /** Which collection set this piece belongs to */
  skinSetId: string;
  /** Which piece in the set (0-based) */
  pieceIndex: number;
  /** Total pieces required to complete the set */
  totalPiecesInSet: number;
  /** Rarity of the resulting skin */
  rarity: SkinRarity;
  /** How the piece was obtained */
  source: 'level_chest' | 'challenge_reward' | 'trade' | 'event';
  obtainedAt: number;
}

/** A collection set that can be completed and sacrificed for a skin */
export interface CollectionSet {
  id: string;
  name: string;
  description: string;
  /** The skin you get from completing this set */
  rewardSkinId: string;
  /** Rarity of the reward skin */
  rewardRarity: SkinRarity;
  /** Total pieces needed to complete */
  totalPieces: number;
  /** Minimum player level to start receiving pieces */
  requiredLevel: number;
  /** Pieces per level chest drop (1-3) */
  piecesPerChest: number;
  /** Icon/emoji for the set */
  icon: string;
  /** Display color */
  color: string;
}

/** Crafting transaction record */
export interface CraftingTransaction {
  id: string;
  playerId: string;
  /** Which set was sacrificed */
  sacrificedSetId: string;
  /** Resulting skin ID (could be random roll) */
  resultSkinId: string;
  resultRarity: SkinRarity;
  resultSkinName: string;
  timestamp: number;
}

// ── Snake Identity ───────────────────────────────────────────────────────────

export interface SnakeIdentity {
  id: string;
  name: string;
  tag: string;
  isBot: boolean;
  skinId: string;
  skinPattern: SkinPattern;
  bodyStyle: BodyStyle;
  taperStyle: TaperStyle;
  hat: HatType;
  shape: SnakeShape;
  primaryColor: string;
  secondaryColor: string;
  trailId: string;
  deathBurstId: string;
  isPlayer: boolean;
  /** Skin rarity (from SkinAsset) */
  skinRarity?: SkinRarity;
  /** Atlas index for sprite batch rendering */
  atlasIndex?: number;
}

// ── Snake State (Full — used by engine for simulation) ──────────────────────

export interface SnakeState {
  identity: SnakeIdentity;
  /** Current head position */
  head: Vec2;
  /** Current head angle in radians */
  angle: number;
  /** Target angle (set by input, smoothly interpolated) */
  targetAngle: number;
  /** Body path stored in zero-alloc circular buffer */
  path: IPathBuffer;
  /** Score (body length = score × pointsPerSegment) */
  score: number;
  /** Whether snake is currently boosting */
  boosting: boolean;
  /** Whether snake is alive */
  alive: boolean;
  /** Whether snake has spawn protection (invulnerable) */
  spawnProtected: boolean;
  /** Frames remaining of spawn protection */
  spawnProtectionFrames: number;
  /** Online only: chips currently carried */
  carriedChips: number;
  /** Online only: number of star chips collected this match */
  starsCollected: number;
  /** Total kills this match */
  kills: number;
  /** Online only: extraction progress 0–1 */
  extractProgress: number;
  /** Whether extraction is in progress */
  isExtracting: boolean;
  /** Frames remaining until extract completes */
  extractFramesLeft: number;
  /** Angle when extraction started (resets on direction change) */
  extractStartAngle: number;
  /** Current emote being displayed, or null */
  activeEmote: EmoteType | null;
  /** Frames remaining for emote display */
  emoteFramesLeft: number;
  /** Ping in ms (client-only) */
  ping: number;
  /** Online only: commission rate for this arena */
  commissionRate: number;
  /** Fibonacci spiral turn state (null when not in spiral) */
  spiral: SpiralTurnState | null;
  /** Visual radius (cached, updated on score change) */
  _cachedVisualRadius: number;
  /** Collision radius (cached) */
  _cachedCollisionRadius: number;
}

// ── Food ────────────────────────────────────────────────────────────────────

export type FoodSize = 'small' | 'medium' | 'large';

export interface FoodOrb {
  id: string;
  x: number;
  y: number;
  size: FoodSize;
  value: number;
  radius: number;
  color: string;
  /** Whether this orb is in the object pool (internal) */
  _pooled?: boolean;
}

// ── Star Chips (Online Only) ────────────────────────────────────────────────

export interface StarChip {
  id: string;
  x: number;
  y: number;
  value: number;
  phaseOffset: number;
  _pooled?: boolean;
}

// ── Map ─────────────────────────────────────────────────────────────────────

export type MapType = 'circular_breathing' | 'infinite';

export interface MapState {
  type: MapType;
  center: Vec2;
  currentRadius: number;
  baseRadius: number;
  breathingAmplitude: number;
  breathingPeriod: number;
  breathingPhase: number;
}

// ── Emotes ──────────────────────────────────────────────────────────────────

export type EmoteType = 'gg' | 'target' | 'flee' | 'ripped' | 'extracting';

export const EMOTE_KEYS: Record<number, EmoteType> = {
  1: 'gg',
  2: 'target',
  3: 'flee',
  4: 'ripped',
  5: 'extracting',
};

export const EMOTE_DISPLAY: Record<EmoteType, { icon: string; label: string }> = {
  gg: { icon: '🏆', label: 'GG' },
  target: { icon: '🎯', label: 'Target' },
  flee: { icon: '🏃💨', label: 'Flee' },
  ripped: { icon: '💪', label: 'Ripped' },
  extracting: { icon: '⚡', label: 'Extracting' },
};

// ── Kill Feed ───────────────────────────────────────────────────────────────

export type KillCause = 'head_on' | 'wall' | 'boundary';

export interface KillFeedEntry {
  id: string;
  victimId: string;
  victimName: string;
  victimIsBot: boolean;
  killerId: string | null;
  killerName: string | null;
  killerIsBot: boolean;
  cause: KillCause;
  timestamp: number;
}

// ── Bot AI ──────────────────────────────────────────────────────────────────

export type BotBehavior = 'harvest' | 'self_destruct';

export interface BotAIState {
  behavior: BotBehavior;
  targetFoodId: string | null;
  dangerAngle: number | null;
  inDanger: boolean;
  decisionCooldown: number;
  /** 0=rookie, 1=scout, 2=hunter, 3=predator, 4=apex */
  level: number;
}

// ── Extraction ──────────────────────────────────────────────────────────────

export interface ExtractionState {
  inProgress: boolean;
  progress: number;
  framesLeft: number;
  startAngle: number;
  completed: boolean;
}

// ── Collision ───────────────────────────────────────────────────────────────

export type CollisionType = 'none' | 'head_on_body' | 'head_on_head' | 'wall' | 'boundary';

export interface CollisionResult {
  type: CollisionType;
  victimId: string | null;
  killerId: string | null;
  point: Vec2 | null;
}

// ── Death ───────────────────────────────────────────────────────────────────

export interface DeathEvent {
  snakeId: string;
  killerId: string | null;
  cause: KillCause;
  position: Vec2;
  droppedFood: FoodOrb[];
  droppedStars: StarChip[];
  timestamp: number;
}

// ── Game Snapshot (Server → Client) ─────────────────────────────────────────

/** Downsampled snake data sent over network */
export interface SnakeSnapshot {
  id: string;
  name: string;
  tag: string;
  isBot: boolean;
  isPlayer: boolean;
  /** Downsampled path points (max ~60 for performance) */
  path: Vec2[];
  score: number;
  alive: boolean;
  boosting: boolean;
  angle: number;
  skinId: string;
  skinPattern: SkinPattern;
  bodyStyle: BodyStyle;
  taperStyle: TaperStyle;
  hat: HatType;
  shape: SnakeShape;
  primaryColor: string;
  secondaryColor: string;
  carriedChips: number;
  kills: number;
  activeEmote: EmoteType | null;
  emoteFramesLeft: number;
  spawnProtected: boolean;
  commissionRate: number;
  /** Fibonacci spiral metadata for client extrapolation */
  turnMeta: TurnMetadata | null;
  /** Skin rarity for rendering tier effects */
  skinRarity?: SkinRarity;
  /** Visual radius (so client doesn't need to recalculate) */
  visualRadius: number;
}

/** Full world snapshot broadcast by server at 20Hz */
export interface GameSnapshot {
  snakes: SnakeSnapshot[];
  food: FoodOrb[];
  stars: StarChip[];
  killFeed: KillFeedEntry[];
  map: {
    center: Vec2;
    currentRadius: number;
  };
  playerExtractProgress: number | null;
  tick: number;
  playerRank: number;
  realPlayerCount: number;
  botCount: number;
  starsInArena: number;
}

// ── Match Result ────────────────────────────────────────────────────────────

export type MatchOutcome = 'extract' | 'death';

export interface MatchResult {
  outcome: MatchOutcome;
  arenaId: string;
  arenaName: string;
  chipsExtracted: number;
  commission: number;
  bankedAmount: number;
  kills: number;
  score: number;
  deaths: number;
  xpGained: number;
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
  killerName?: string;
  killerTag?: string;
  isOffline?: boolean;
}

// ── Game Phase (UI state machine) ──────────────────────────────────────────

export type GamePhase = 'connecting' | 'playing' | 'ended';

export interface EndScreenState {
  outcome: MatchOutcome;
  killerName?: string;
  killerTag?: string;
  killerIsBot?: boolean;
  chipsExtracted?: number;
  commission?: number;
  bankedAmount?: number;
  kills: number;
  score: number;
  xpGained: number;
  durationSeconds: number;
  isOffline: boolean;
  arenaName: string;
}

// ── Input ───────────────────────────────────────────────────────────────────

export interface InputState {
  targetAngle: number;
  boosting: boolean;
  extracting: boolean;
  emoteKey: number | null;
}

export interface JoystickState {
  active: boolean;
  dx: number;
  dy: number;
  magnitude: number;
}

// ── Camera ──────────────────────────────────────────────────────────────────

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
}

// ── HUD State ───────────────────────────────────────────────────────────────

export interface HUDState {
  fps: number;
  ping: number;
  lowQuality: boolean;
  showMinimap: boolean;
  showFullMap: boolean;
  score: number;
  kills: number;
  rank: number;
  carriedChips: number;
  starsEarned: number;
  starsInArena: number;
  bankedChips: number;
  realPlayerCount: number;
  botCount: number;
  commissionRate: number;
  rewardMultiplier: number;
  arenaName: string;
  isOffline: boolean;
}

// ── Replay ──────────────────────────────────────────────────────────────────

export interface ReplayFrame {
  player: SnakeSnapshot;
  snakes: SnakeSnapshot[];
  food: FoodOrb[];
  stars: StarChip[];
  killFeed: KillFeedEntry[];
  isDeathFrame: boolean;
  deathEvent?: DeathEvent;
}

export interface ReplayState {
  frames: ReplayFrame[];
  writeIndex: number;
  totalFrames: number;
  deathOccurred: boolean;
  deathFrameIndex: number;
  playing: boolean;
  currentFrame: number;
  speed: number;
  duration: number;
}

// ── Arena Config (from game-config.ts) ─────────────────────────────────────

export interface ArenaTierConfig {
  id: string;
  name: string;
  tier: number;
  buyIn: number;
  description: string;
  difficulty: string;
  color: string;
  accentColor: string;
  borderAccent: string;
  botsCount: number;
  rewardMultiplier: number;
  isPractice?: boolean;
  practiceDifficulty?: 'easy' | 'medium' | 'hard';
}

// ── Render Context (passed to all renderers) ───────────────────────────────

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  camera: CameraState;
  config: import('./config').SnakeConfig;
  time: number;
  lowQuality: boolean;
  hud: HUDState;
}

// ── Render Segment (resolved for drawing) ───────────────────────────────────

export interface RenderSegment {
  x: number;
  y: number;
  angle: number;
  visualRadius: number;
  /** Visual radius after head-to-tail taper */
  taperRadius: number;
  collisionRadius: number;
  color: string;
  shape: SegmentShape;
  glow: boolean;
  sizeScale: number;
  /** Rarity-based glow intensity */
  rarityGlow?: number;
  /** Whether this segment should trigger legendary particles */
  emitParticles?: boolean;
}

// ── Particle Effects ────────────────────────────────────────────────────────

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  /** For legendary skin particles */
  type?: 'normal' | 'glow' | 'bubbles' | 'sparkles' | 'fire' | 'void' | 'electric';
  glow?: number;
}

// ── Admin Slider Definitions ────────────────────────────────────────────────

export interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  category: SliderCategory;
}

export type SliderCategory =
  | 'MAP & GRID'
  | 'SNAKE BODY'
  | 'SPEED & TURN'
  | 'GROWTH & SCORE'
  | 'FOOD SPAWN'
  | 'BOOST DRAIN'
  | 'DEATH DROP'
  | 'CAMERA'
  | 'SKIN APPEARANCE'
  | 'BOTS'
  | 'COLLISION'
  | 'SPIRAL TURN'
  | 'EXTRAPOLATION';
