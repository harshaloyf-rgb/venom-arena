// ============================================================================
// Venom Arena — Core Game Types
// Pure data structures. No side effects. No DOM. No canvas.
// Importable by both client (browser) and server (Bun/Node).
// ============================================================================

// ── Primitives ──────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ── Snake ───────────────────────────────────────────────────────────────────

export type SnakeShape = 'circle' | 'box' | 'triangle' | 'mix_ct' | 'mix_cb' | 'mix_bt' | 'mix_all';
export type BodyStyle = 'smooth' | 'dragon' | 'armored' | 'crystal' | 'obsidian' | 'basilisk';
export type TaperStyle = 'natural' | 'uniform' | 'wave' | 'heavy';
export type HatType = 'none' | 'tophat' | 'crown' | 'cap' | 'santa' | 'party' | 'horns';
export type SkinPattern = 'solid' | 'rainbow' | 'neon' | 'glow' | 'metallic' | 'pulse' | 'zebra' | 'camo' | 'cyber';

/** Base segment shape used in custom skin editor */
export type SegmentShape = 'circle' | 'square' | 'diamond' | 'spike';

/** A single point in the snake's body path */
export interface PathPoint {
  x: number;
  y: number;
  angle: number;
}

/** A resolved segment ready for rendering */
export interface RenderSegment {
  x: number;
  y: number;
  angle: number;
  visualRadius: number;
  collisionRadius: number;
  color: string;
  shape: SegmentShape;
  glow: boolean;
  sizeScale: number;
}

/** Snake identity — shared by client and server */
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
  /** Primary color (hex) for solid patterns, or base hue */
  primaryColor: string;
  /** Secondary color for patterns like zebra */
  secondaryColor: string;
  trailId: string;
  deathBurstId: string;
  isPlayer: boolean;
}

/** Full snake state — used by engine for simulation */
export interface SnakeState {
  identity: SnakeIdentity;
  /** Current head position */
  head: Vec2;
  /** Current head angle in radians */
  angle: number;
  /** Target angle (set by input, smoothly interpolated) */
  targetAngle: number;
  /** Full body path (head at index 0) */
  path: PathPoint[];
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
  /** Frames remaining until extract completes (at 30fps = extractSeconds * 30) */
  extractFramesLeft: number;
  /** Timestamp when extraction started (for reset on direction change) */
  extractStartAngle: number;
  /** Current emote being displayed, or null */
  activeEmote: EmoteType | null;
  /** Frames remaining for emote display */
  emoteFramesLeft: number;
  /** Ping in ms (client-only) */
  ping: number;
  /** Online only: commission rate for this arena (0 or 0.35) */
  commissionRate: number;
}

// ── Food ────────────────────────────────────────────────────────────────────

export type FoodSize = 'small' | 'medium' | 'large';

export interface FoodOrb {
  id: string;
  x: number;
  y: number;
  size: FoodSize;
  /** Point value when eaten */
  value: number;
  /** Visual radius in px */
  radius: number;
  /** Color string */
  color: string;
}

// ── Star Chips (Online Only) ────────────────────────────────────────────────

export interface StarChip {
  id: string;
  x: number;
  y: number;
  /** Chip value of this star */
  value: number;
  /** Pulsing animation phase offset */
  phaseOffset: number;
}

// ── Map ─────────────────────────────────────────────────────────────────────

export type MapType = 'circular_breathing' | 'infinite';

export interface MapState {
  type: MapType;
  /** Center of the map */
  center: Vec2;
  /** Current radius (changes with breathing) */
  currentRadius: number;
  /** Base radius (before breathing oscillation) */
  baseRadius: number;
  /** Breathing amplitude in px (±40) */
  breathingAmplitude: number;
  /** Breathing period in seconds (10) */
  breathingPeriod: number;
  /** Current breathing phase */
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
  /** Target food ID the bot is pursuing */
  targetFoodId: string | null;
  /** Danger direction to flee from */
  dangerAngle: number | null;
  /** Whether bot detects nearby danger */
  inDanger: boolean;
  /** Frames until next decision */
  decisionCooldown: number;
}

// ── Extraction ──────────────────────────────────────────────────────────────

export interface ExtractionState {
  inProgress: boolean;
  progress: number; // 0–1
  framesLeft: number;
  startAngle: number;
  completed: boolean;
}

// ── Collision ───────────────────────────────────────────────────────────────

export type CollisionType = 'none' | 'head_on_body' | 'head_on_head' | 'wall' | 'boundary';

export interface CollisionResult {
  type: CollisionType;
  /** The snake that died (if any) */
  victimId: string | null;
  /** The snake that caused the kill (if any) */
  killerId: string | null;
  /** Where the collision happened */
  point: Vec2 | null;
}

// ── Death ───────────────────────────────────────────────────────────────────

export interface DeathEvent {
  snakeId: string;
  killerId: string | null;
  cause: KillCause;
  position: Vec2;
  /** Food orbs dropped from body */
  droppedFood: FoodOrb[];
  /** Star chips dropped (online only, 10 stars if had chips) */
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
  /** Server tick number */
  tick: number;
  /** Player rank among real players */
  playerRank: number;
  /** Total real players in arena */
  realPlayerCount: number;
  /** Total bots in arena */
  botCount: number;
  /** Stars remaining in arena */
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
  /** Target angle in radians (from mouse/touch/keyboard) */
  targetAngle: number;
  /** Whether boost is active */
  boosting: boolean;
  /** Whether extract key is held */
  extracting: boolean;
  /** Active emote key (1-5), or null */
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
  /** Player snake state at this frame */
  player: SnakeSnapshot;
  /** All other snakes at this frame */
  snakes: SnakeSnapshot[];
  /** Food at this frame */
  food: FoodOrb[];
  /** Stars at this frame */
  stars: StarChip[];
  /** Kill feed at this frame */
  killFeed: KillFeedEntry[];
  /** Whether this is the death frame */
  isDeathFrame: boolean;
  /** Death event data (only on death frame) */
  deathEvent?: DeathEvent;
}

export interface ReplayState {
  frames: ReplayFrame[];
  /** Circular buffer write index */
  writeIndex: number;
  /** Total frames captured */
  totalFrames: number;
  /** Whether death has occurred */
  deathOccurred: boolean;
  /** Index of the death frame */
  deathFrameIndex: number;
  /** Is replay currently playing */
  playing: boolean;
  /** Current playback frame */
  currentFrame: number;
  /** Playback speed multiplier */
  speed: number;
  /** Total replay duration in frames */
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
  | 'COLLISION';
