// ============================================================================
// offline-types.ts — All types & interfaces for the offline game engine.
// ============================================================================

import type { SnakeConfig } from '@/lib/snake-engine';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type OfflineState = 'playing' | 'dead' | 'extracted';

export interface OfflineExitResult {
  score: number;
  kills: number;
  durationSeconds: number;
}

// ----------------------------------------------------------------------------
// Internal types
// ----------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export type BotPersonality = 'scavenger' | 'opportunist' | 'hunter' | 'extractor' | 'coward';

export interface SnakeBase {
  id: string;
  name: string;
  userTag?: string;
  country?: string;
  points: Vec2[];
  angle: number;
  size: number;
  collisionRadius: number;
  color: string;
  secondaryColor?: string;
  isPlayer: boolean;
  isBot: boolean;
  /** Food-mass score (starts at 0, grows with food, shrinks with boost).
   *  Display score = cfg.initialSpawnScore + this value. */
  score: number;
  boostFrameCounter: number;
  isExtracting: boolean;
  extractionProgress: number;
  isDead: boolean;
  spawnProtectedUntil: number;
  chatMessage?: string;
  chatExpiry?: number;
  kills: number;
  desiredAngle: number;
  wantsBoost: boolean;
  /** Whether the snake is actively boosting (for head-on collision + rendering). */
  isBoosting: boolean;
}

export interface BotSession extends SnakeBase {
  botId: string;
  personality: BotPersonality;
  nextThinkAt: number;
  /** Index into the virtualBots array this active bot came from. */
  virtualIdx: number;
}

/** Lightweight bot definition for the virtual pool (1000 total). Only stores identity + cheap position.
 *  Active bots (BotSession) are created from these when near the player. */
export interface VirtualBot {
  idx: number;
  id: string;
  botId: string;
  name: string;
  personality: BotPersonality;
  color: string;
  secondaryColor: string;
  initialScore: number;
  /** Cheap world position — updated each tick with straight-line wander. */
  x: number;
  y: number;
  angle: number;
  score: number;
  isActive: boolean;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  /** Visual radius in px. */
  size: number;
  /** Score value (1, 3, or 5). */
  value: number;
  orbSize: 'small' | 'medium' | 'large';
  color: string;
  glowColor: string;
  isStarChip?: boolean;
}

export interface GridItem {
  id: string;
  kind: 'segment' | 'food';
  x: number;
  y: number;
  radius: number;
  snakeId?: string;
  segIdx?: number;
  value?: number;
  foodRef?: Food;
}

export interface ReplaySnakeData {
  id: string;
  name: string;
  points: Vec2[];
  angle: number;
  size: number;
  color: string;
  secondaryColor?: string;
  isDead: boolean;
  score: number;
  isBoosting: boolean;
  isPlayer: boolean;
}

export interface ReplayFoodData {
  x: number;
  y: number;
  size: number;
  value: number;
  color: string;
  glowColor: string;
  orbSize: string;
}

export interface ReplayFrame {
  snakes: ReplaySnakeData[];
  foods: ReplayFoodData[];
  camX: number;
  camY: number;
  camZoom: number;
}

// ----------------------------------------------------------------------------
// HUD elements shape
// ----------------------------------------------------------------------------

export interface HudElements {
  score?: HTMLSpanElement;
  kills?: HTMLSpanElement;
  rank?: HTMLSpanElement;
  bots?: HTMLSpanElement;
  fps?: HTMLSpanElement;
  extractingBar?: HTMLDivElement;
  extractingPct?: HTMLSpanElement;
  extractingWrap?: HTMLDivElement;
  idleHint?: HTMLDivElement;
  leaderboardRows?: HTMLDivElement;
  leaderboardToggle?: HTMLButtonElement;
  leaderboardOpen: boolean;
}

// ----------------------------------------------------------------------------
// Spatial hash grid — slimmed-down client port of the server's grid.
// Items are bucketed into square cells; queries return a deduplicated Map.
// ----------------------------------------------------------------------------

export class SpatialHashGrid {
  private readonly cellSize: number;
  private readonly cells: Map<string, Map<string, GridItem>> = new Map();

  constructor(cellSize = 120) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): string {
    return cx + ':' + cy;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: GridItem): void {
    const minCx = Math.floor((item.x - item.radius) / this.cellSize);
    const maxCx = Math.floor((item.x + item.radius) / this.cellSize);
    const minCy = Math.floor((item.y - item.radius) / this.cellSize);
    const maxCy = Math.floor((item.y + item.radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const k = this.key(cx, cy);
        let bucket = this.cells.get(k);
        if (!bucket) {
          bucket = new Map();
          this.cells.set(k, bucket);
        }
        bucket.set(item.id, item);
      }
    }
  }

  queryRadius(x: number, y: number, r: number): Map<string, GridItem> {
    const out = new Map<string, GridItem>();
    const minCx = Math.floor((x - r) / this.cellSize);
    const maxCx = Math.floor((x + r) / this.cellSize);
    const minCy = Math.floor((y - r) / this.cellSize);
    const maxCy = Math.floor((y + r) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const [id, item] of bucket) {
          if (!out.has(id)) out.set(id, item);
        }
      }
    }
    return out;
  }
}

// ----------------------------------------------------------------------------
// Engine reference interface — what the HUD / Replay helpers need from the
// main OfflineGameEngine instance.  The engine satisfies this structurally
// by simply passing `this`.
// ----------------------------------------------------------------------------

export interface OfflineEngineRef {
  // World state
  canvas: HTMLCanvasElement;
  player: SnakeBase | null;
  bots: Map<string, BotSession>;
  foods: Food[];
  cfg: SnakeConfig;

  // HUD state
  hudEls: HudElements;
  overlayRoot: HTMLDivElement | null;
  endOverlay: HTMLDivElement | null;
  lastLeaderboardSig: string;
  fps: number;

  // Input state
  boostHold: boolean;
  keys: Set<string>;
  state: OfflineState;
  extractHold: boolean;

  // Camera
  cam: { x: number; y: number; zoom: number };

  // Results
  finalScore: number;
  finalKills: number;
  finalDurationSeconds: number;
  startTime: number;

  // Replay recording
  isPostDeathRecording: boolean;
  postDeathTicksRemaining: number;
  deathCamX: number;
  deathCamY: number;
  replayPreBuffer: ReplayFrame[];
  replayPreWriteIdx: number;
  replayPostBuffer: ReplayFrame[];

  // Replay playback
  replayFrames: ReplayFrame[];
  replayDeathFrameIdx: number;
  isReplayMode: boolean;
  replayPlaybackIdx: number;
  replayPlaying: boolean;
  replaySpeed: number;
  replayZoom: number;
  replayCanvas: HTMLCanvasElement | null;
  replayCtx: CanvasRenderingContext2D | null;
  replayRafId: number | null;
  replayLastTime: number;
  stopped: boolean;

  // Methods that helpers call back into
  setPlayerChat(msg: string): void;
  beginExtract(): void;
  cancelExtract(): void;
  handleExitToLobby(): void;
  handlePlayAgain(): void;
  enterReplayMode(): void;
  exitReplayMode(): void;
  setState(s: OfflineState): void;
  showEndScreen(outcome: 'death' | 'extract'): void;
  spawnDeathParticles(x: number, y: number, color: string): void;
}
