'use client';

// ============================================================================
// offline-engine.ts — Pure client-side snake game engine for "Venom Arena".
// ----------------------------------------------------------------------------
// This module runs a complete slither.io-style game ENTIRELY in the browser.
// No Socket.IO connection, no server round-trips, no chips, no minimap. It is
// used by `game-canvas.tsx` whenever the active arena's id starts with
// `practice-` (the three free offline practice tiers).
//
// Design tenets (from the locked BUILD-14 spec):
//  * **No server connection** — runs purely on requestAnimationFrame.
//  * **No chips** — chip-less mode. No star chips, no carried chips, no
//    buy-in, no commission. Food only grows body (+1 score).
//  * **No map** — mapless. No minimap, no full-map overlay.
//  * **Ranking by score** (body length), not chips.
//  * **Leaderboard**: top 10 by score (you + bots), collapsible.
//  * **Extract any time** — hold 3 s → ends run, shows final score, ZERO XP.
//  * **Death**: body collision = die + restart. Wall hit = die + restart.
//    No drops (no food drop, no star drop — chips don't exist).
//  * **Boost**: costs body length (every 40 frames drops 1 tail segment).
//
// Performance:
//  * Spatial hash grid for collision + food queries (O(n)-ish, not O(n²)).
//  * Snake bodies capped at MAX_BODY_LENGTH (120); rendered via downsampled
//    stride-2 polylines (max 60 stroke points).
//  * Viewport culling (skip off-screen snakes/food).
//  * Adaptive quality: FPS < 40 for 2 s → low-quality mode (no glow / shadow).
//  * Particles capped at 200.
//
// The engine owns its own DOM HUD overlays (appended to `canvas.parentElement`)
// and tears them all down on `stop()`. The host React component just has to
// instantiate, start, and forward the `onExit` / `onStateChange` callbacks.
// ============================================================================

import {
  BASE_SPEED,
  BOOST_DROP_INTERVAL,
  BOOST_MIN_LENGTH,
  BOOST_SPEED,
  BOT_NAMES,
  BOT_SKINS,
  COLLISION_HIT_FACTOR,
  EXTRACT_DURATION_MS,
  EXTRACT_GLIDE_SPEED,
  FOOD_COUNT_TARGET,
  INITIAL_BODY_LENGTH,
  MAP_BASE_RADIUS,
  MAP_BREATH_AMPLITUDE,
  MAP_BREATH_CYCLE_MS,
  MAX_BODY_LENGTH,
  REGULAR_FOOD_GROW,
  REGULAR_FOOD_VALUE_MAX,
  REGULAR_FOOD_VALUE_MIN,
  RESPAWN_INVULN_MS,
  SEGMENT_SPACING,
  SIZE_BASE,
  SIZE_SCORE_FACTOR,
  TICK_MS,
  TURN_BASE,
  TURN_MIN,
  TURN_SCORE_FACTOR,
  WORLD_SIZE,
  WORLD_RADIUS,
  type ArenaTier,
  getCosmeticById,
  type Skin,
} from '@/lib/game-config';
import type { PlayerProfile } from '@/lib/types';
import {
  computeVisibleRect,
  drawFood,
  drawGrid,
  drawParticles,
  drawSnake,
  getArenaRadius,
  type FrameRenderCtx,
  type Particle,
} from './render-helpers';

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

interface Vec2 {
  x: number;
  y: number;
}

type BotPersonality = 'scavenger' | 'opportunist' | 'hunter' | 'extractor' | 'coward';

interface SnakeBase {
  id: string;
  name: string;
  userTag?: string;
  country?: string;
  points: Vec2[];
  angle: number;
  size: number;
  color: string;
  secondaryColor?: string;
  isPlayer: boolean;
  isBot: boolean;
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
}

interface BotSession extends SnakeBase {
  botId: string;
  personality: BotPersonality;
  nextThinkAt: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean; // always false in offline mode (chip-less)
  color: string;
}

interface GridItem {
  id: string;
  kind: 'segment' | 'food';
  x: number;
  y: number;
  radius: number;
  snakeId?: string;
  segIdx?: number;
  value?: number;
  foodRef?: { value: number };
}

// ----------------------------------------------------------------------------
// Spatial hash grid — slimmed-down client port of the server's grid.
// Items are bucketed into square cells; queries return a deduplicated Map.
// ----------------------------------------------------------------------------

class SpatialHashGrid {
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
// Constants
// ----------------------------------------------------------------------------

const MAX_PARTICLES = 200;
const FPS_LOW_THRESHOLD = 40;
const FPS_HIGH_THRESHOLD = 55;
const FPS_LOW_DURATION_MS = 2000;
const FPS_HIGH_DURATION_MS = 5000;
const MOUSE_DEADZONE_PX = 15;
const JOYSTICK_DEADZONE = 0.18;
const JOYSTICK_MAX_RADIUS_PX = 70;
const JOYSTICK_BOOST_MAGNITUDE = 0.6;
const MAX_SNAPSHOT_POINTS = 60;
const BOT_THINK_INTERVAL_MS = 120;
const BOT_THINK_JITTER_MS = 80;
const BOT_FOOD_SCAN_RADIUS = 260;
const BOT_THREAT_SCAN_RADIUS = 150;
const BOT_EDGE_AVOID_RADIUS = 250;
const BOT_MAX_TURN_PER_TICK = 0.22;
const PERSONALITIES: BotPersonality[] = [
  'scavenger',
  'opportunist',
  'hunter',
  'extractor',
  'coward',
];

const FOOD_COLORS = [
  '#38bdf8',
  '#818cf8',
  '#fb7185',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#22d3ee',
  '#f472b6',
];

const QUICK_EMOTES = [
  'GG! 🏆',
  'Target Spot! 🎯',
  'Fleeing! 🏃💨',
  'Get Ripped! 💪',
  'Extracting soon! ⚡',
];

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------

function angularDelta(current: number, desired: number): number {
  let diff = desired - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function turnToward(current: number, desired: number, maxStep: number): number {
  const diff = angularDelta(current, desired);
  if (Math.abs(diff) <= maxStep) return desired;
  return current + Math.sign(diff) * maxStep;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function randomSpawnPoint(maxR: number): Vec2 {
  const r = Math.sqrt(Math.random()) * maxR;
  const theta = Math.random() * Math.PI * 2;
  return {
    x: WORLD_RADIUS + Math.cos(theta) * r,
    y: WORLD_RADIUS + Math.sin(theta) * r,
  };
}

function initialBody(headX: number, headY: number, angle: number, length: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < length; i++) {
    pts.push({
      x: headX - Math.cos(angle) * i * SEGMENT_SPACING,
      y: headY - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  return pts;
}

// ----------------------------------------------------------------------------
// Main engine
// ----------------------------------------------------------------------------

export class OfflineGameEngine {
  // --- Public callbacks (set by the host) ---
  public onExit: (result: OfflineExitResult) => void = () => {};
  public onStateChange: (state: OfflineState) => void = () => {};

  // --- Engine-owned state ---
  private readonly arena: ArenaTier;
  private readonly playerProfile: PlayerProfile;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly playerSkin: Skin | undefined;

  // World state
  private player: SnakeBase | null = null;
  private bots: Map<string, BotSession> = new Map();
  private foods: Food[] = [];
  private grid: SpatialHashGrid = new SpatialHashGrid(120);
  private tick: number = 0;
  private foodIdCounter: number = 0;
  private botIdCounter: number = 0;
  private startTime: number = 0;

  // rAF + sizing
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastFrameTime: number = 0;

  // Camera
  private cam: { x: number; y: number; zoom: number } = {
    x: WORLD_RADIUS,
    y: WORLD_RADIUS,
    zoom: 0.9,
  };
  private camInit: boolean = false;

  // Input state
  private keys: Set<string> = new Set();
  private mousePos: { x: number; y: number } = { x: 0, y: 0 };
  private mouseActive: boolean = false;
  private touchAngle: number | null = null;
  private touchBoost: boolean = false;
  private joystick: {
    active: boolean;
    pointerId: number;
    originX: number;
    originY: number;
    curX: number;
    curY: number;
  } | null = null;
  private boostHold: boolean = false;
  private extractHold: boolean = false;

  // HUD / overlays DOM
  private overlayRoot: HTMLDivElement | null = null;
  private hudEls: {
    score?: HTMLSpanElement;
    kills?: HTMLSpanElement;
    rank?: HTMLSpanElement;
    bots?: HTMLSpanElement;
    banked?: HTMLDivElement;
    fps?: HTMLSpanElement;
    extractingBar?: HTMLDivElement;
    extractingPct?: HTMLSpanElement;
    extractingWrap?: HTMLDivElement;
    idleHint?: HTMLDivElement;
    leaderboardRows?: HTMLDivElement;
    leaderboardToggle?: HTMLButtonElement;
    leaderboardOpen: boolean;
  } = { leaderboardOpen: true };

  // End screen DOM (death / extract)
  private endOverlay: HTMLDivElement | null = null;

  // State machine
  private state: OfflineState = 'playing';
  private finalScore: number = 0;
  private finalKills: number = 0;
  private finalDurationSeconds: number = 0;

  // Particles
  private particles: Particle[] = [];
  private metallicCache: Map<string, CanvasGradient> = new Map();

  // FPS + adaptive quality
  private fps: number = 60;
  private fpsAccum: { frames: number; lastSecond: number; lowSince: number; highSince: number } = {
    frames: 0,
    lastSecond: 0,
    lowSince: 0,
    highSince: 0,
  };
  private lowQuality: boolean = false;

  // Mobile detection (for camera zoom)
  private isMobile: boolean = false;

  // Bound listeners (kept so we can remove them on stop)
  private boundMouseMove: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundResize: () => void;

  // Cleanup flag
  private stopped: boolean = false;

  constructor(arena: ArenaTier, playerProfile: PlayerProfile, canvas: HTMLCanvasElement) {
    this.arena = arena;
    this.playerProfile = playerProfile;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Resolve the player's equipped skin.
    // Priority: localStorage `venom_custom_skin_state` (set by CosmeticsShop)
    // overrides the server-saved `currentSkin` field. Falls back to whatever
    // `getCosmeticById` returns for the profile's currentSkin.
    this.playerSkin = this.resolvePlayerSkin();

    // Pre-bind listeners so removeEventListener works.
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundBlur = this.onBlur.bind(this);
    this.boundResize = this.handleResize.bind(this);
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  start(): void {
    if (this.stopped) return;
    this.isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
    this.setupCanvas();
    this.attachInput();
    this.buildHUD();
    this.resetWorld();
    this.startTime = performance.now();
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.stopped = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.detachInput();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.teardownHUD();
  }

  // --------------------------------------------------------------------------
  // Skin resolution
  // --------------------------------------------------------------------------

  private resolvePlayerSkin(): Skin | undefined {
    try {
      const raw = localStorage.getItem('venom_custom_skin_state');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          useCustomSkin?: boolean;
          currentSkin?: string;
        };
        if (parsed.useCustomSkin && parsed.currentSkin && parsed.currentSkin !== 'custom-lab-skin') {
          const s = getCosmeticById(parsed.currentSkin);
          if (s) return s;
        }
      }
    } catch {
      /* ignore */
    }
    return getCosmeticById(this.playerProfile.currentSkin);
  }

  // --------------------------------------------------------------------------
  // Canvas setup
  // --------------------------------------------------------------------------

  private setupCanvas(): void {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    canvas.style.outline = 'none';
    this.handleResize();
    this.resizeObserver = new ResizeObserver(this.boundResize);
    this.resizeObserver.observe(canvas);
  }

  private handleResize(): void {
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    this.metallicCache.clear();
  }

  // --------------------------------------------------------------------------
  // World init / reset
  // --------------------------------------------------------------------------

  private resetWorld(): void {
    this.bots.clear();
    this.foods = [];
    this.grid.clear();
    this.tick = 0;
    this.foodIdCounter = 0;
    this.botIdCounter = 0;
    this.particles = [];
    this.camInit = false;

    // Spawn player at world center, facing east.
    const cx = WORLD_RADIUS;
    const cy = WORLD_RADIUS;
    const angle = 0;
    const profile = this.playerProfile;
    this.player = {
      id: 'player-offline',
      name: profile.name,
      userTag: profile.userTag,
      country: profile.country,
      points: initialBody(cx, cy, angle, INITIAL_BODY_LENGTH),
      angle,
      size: SIZE_BASE,
      color: this.playerSkin?.color ?? '#22c55e',
      secondaryColor: this.playerSkin?.secondaryColor ?? '#15803d',
      isPlayer: true,
      isBot: false,
      score: 0,
      boostFrameCounter: 0,
      isExtracting: false,
      extractionProgress: 0,
      isDead: false,
      spawnProtectedUntil: performance.now() + RESPAWN_INVULN_MS,
      kills: 0,
      desiredAngle: angle,
      wantsBoost: false,
    };

    // Spawn bots — capped at 1000 (engine supports up to 1000 even though
    // the highest practice tier only spawns 75).
    const botCount = Math.min(1000, this.arena.botsCount);
    for (let i = 0; i < botCount; i++) {
      const bot = this.spawnBot();
      this.bots.set(bot.id, bot);
    }

    // Spawn food pellets.
    for (let i = 0; i < FOOD_COUNT_TARGET; i++) {
      this.foods.push(this.spawnRandomFood());
    }

    this.setState('playing');
    this.updateHUD();
  }

  private spawnBot(): BotSession {
    const idx = this.botIdCounter++;
    const baseName = BOT_NAMES[idx % BOT_NAMES.length];
    const name =
      idx < BOT_NAMES.length ? baseName : `${baseName}-${Math.floor(idx / BOT_NAMES.length) + 1}`;
    const skin = BOT_SKINS[idx % BOT_SKINS.length];
    const personality = PERSONALITIES[idx % PERSONALITIES.length];
    const spawn = randomSpawnPoint(WORLD_RADIUS - 200);
    const angle = Math.random() * Math.PI * 2;
    const botId = `bot-${this.arena.id}-${idx}`;
    return {
      id: botId,
      botId,
      name,
      points: initialBody(spawn.x, spawn.y, angle, INITIAL_BODY_LENGTH),
      angle,
      size: SIZE_BASE,
      color: skin.color,
      secondaryColor: skin.secondaryColor,
      isPlayer: false,
      isBot: true,
      score: 0,
      boostFrameCounter: 0,
      isExtracting: false,
      extractionProgress: 0,
      isDead: false,
      spawnProtectedUntil: performance.now() + RESPAWN_INVULN_MS,
      kills: 0,
      desiredAngle: angle,
      wantsBoost: false,
      personality,
      nextThinkAt: 0,
    };
  }

  private spawnRandomFood(): Food {
    const id = `food-${this.arena.id}-${this.foodIdCounter++}`;
    const pos = randomSpawnPoint(MAP_BASE_RADIUS - 20);
    return {
      id,
      x: pos.x,
      y: pos.y,
      size: 4 + Math.random() * 3,
      value:
        Math.floor(Math.random() * (REGULAR_FOOD_VALUE_MAX - REGULAR_FOOD_VALUE_MIN + 1)) +
        REGULAR_FOOD_VALUE_MIN,
      isStarChip: false, // offline mode is chip-less — never star chips
      color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
    };
  }

  // --------------------------------------------------------------------------
  // Input listeners
  // --------------------------------------------------------------------------

  private attachInput(): void {
    const canvas = this.canvas;
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.boundTouchEnd);
    canvas.addEventListener('touchcancel', this.boundTouchEnd);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
  }

  private detachInput(): void {
    const canvas = this.canvas;
    canvas.removeEventListener('mousemove', this.boundMouseMove);
    canvas.removeEventListener('touchstart', this.boundTouchStart);
    canvas.removeEventListener('touchmove', this.boundTouchMove);
    canvas.removeEventListener('touchend', this.boundTouchEnd);
    canvas.removeEventListener('touchcancel', this.boundTouchEnd);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.mouseActive = true;
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.joystick) return;
    const t = this.findJoystickTouch(e.touches);
    if (!t) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.joystick = {
      active: true,
      pointerId: t.identifier,
      originX: t.clientX - rect.left,
      originY: t.clientY - rect.top,
      curX: t.clientX - rect.left,
      curY: t.clientY - rect.top,
    };
  }

  private onTouchMove(e: TouchEvent): void {
    const js = this.joystick;
    if (!js) return;
    let t: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === js.pointerId) {
        t = e.touches[i];
        break;
      }
    }
    if (!t) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    js.curX = t.clientX - rect.left;
    js.curY = t.clientY - rect.top;
    const dx = js.curX - js.originX;
    const dy = js.curY - js.originY;
    const d = Math.hypot(dx, dy);
    const mag = Math.min(1, d / JOYSTICK_MAX_RADIUS_PX);
    if (mag > JOYSTICK_DEADZONE) {
      this.touchAngle = Math.atan2(dy, dx);
      this.touchBoost = mag > JOYSTICK_BOOST_MAGNITUDE;
    } else {
      this.touchAngle = null;
      this.touchBoost = false;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    const js = this.joystick;
    if (!js) return;
    let stillActive = false;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === js.pointerId) {
        stillActive = true;
        break;
      }
    }
    if (!stillActive) {
      this.joystick = null;
      this.touchAngle = null;
      this.touchBoost = false;
    }
  }

  private findJoystickTouch(touches: TouchList): Touch | null {
    const rect = this.canvas.getBoundingClientRect();
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      if (x < rect.width / 2 && y > rect.height / 2) {
        return t;
      }
    }
    return null;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (
      k === 'arrowup' ||
      k === 'arrowdown' ||
      k === 'arrowleft' ||
      k === 'arrowright' ||
      k === ' ' ||
      k === 'spacebar'
    ) {
      e.preventDefault();
    }
    if (k === 'escape' && this.state !== 'playing') {
      this.handleExitToLobby();
      return;
    }
    if (k === 'e' && this.state === 'playing' && !this.extractHold) {
      this.extractHold = true;
      this.beginExtract();
    }
    if (this.state === 'playing' && ['1', '2', '3', '4', '5'].includes(k)) {
      const idx = parseInt(k, 10) - 1;
      if (idx >= 0 && idx < QUICK_EMOTES.length) {
        this.setPlayerChat(QUICK_EMOTES[idx]);
      }
    }
    const normalized = k === 'spacebar' ? ' ' : k;
    this.keys.add(normalized);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k === 'e' && this.extractHold) {
      this.extractHold = false;
      this.cancelExtract();
    }
    const normalized = k === 'spacebar' ? ' ' : k;
    this.keys.delete(normalized);
  }

  private onBlur(): void {
    this.keys.clear();
    this.mouseActive = false;
    this.boostHold = false;
    if (this.extractHold) {
      this.extractHold = false;
      this.cancelExtract();
    }
  }

  // --------------------------------------------------------------------------
  // Extraction
  // --------------------------------------------------------------------------

  private beginExtract(): void {
    const p = this.player;
    if (!p || p.isDead) return;
    if (p.isExtracting) return;
    p.isExtracting = true;
    p.extractionProgress = 0;
    if (this.hudEls.extractingWrap) this.hudEls.extractingWrap.style.display = 'block';
    if (this.hudEls.idleHint) this.hudEls.idleHint.style.display = 'none';
  }

  private cancelExtract(): void {
    const p = this.player;
    if (!p) return;
    p.isExtracting = false;
    p.extractionProgress = 0;
    if (this.hudEls.extractingWrap) this.hudEls.extractingWrap.style.display = 'none';
    if (this.hudEls.idleHint) this.hudEls.idleHint.style.display = 'block';
    if (this.hudEls.extractingBar) this.hudEls.extractingBar.style.width = '0%';
    if (this.hudEls.extractingPct) this.hudEls.extractingPct.textContent = '0%';
  }

  private finishExtract(): void {
    if (this.state !== 'playing') return;
    const p = this.player;
    if (!p) return;
    this.finalScore = p.score;
    this.finalKills = p.kills;
    this.finalDurationSeconds = Math.floor((performance.now() - this.startTime) / 1000);
    this.setState('extracted');
    this.showEndScreen('extract');
  }

  // --------------------------------------------------------------------------
  // Chat bubble
  // --------------------------------------------------------------------------

  private setPlayerChat(msg: string): void {
    const p = this.player;
    if (!p) return;
    p.chatMessage = msg;
    p.chatExpiry = performance.now() + 4000;
  }

  // --------------------------------------------------------------------------
  // Main rAF loop
  // --------------------------------------------------------------------------

  private frame = (now: number): void => {
    if (this.stopped) return;
    this.rafId = requestAnimationFrame(this.frame);
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.updateFps(now);
    this.updateParticles(dt);

    // Physics ticks at ~TICK_MS (30 Hz) cadence — we run the sim in fixed
    // steps but render every rAF. Accumulator pattern prevents spiral-of-death.
    if (this.state === 'playing') {
      this.accumulator += dt;
      let safety = 4;
      while (this.accumulator >= TICK_MS && safety > 0) {
        this.tickPhysics(now);
        this.accumulator -= TICK_MS;
        safety--;
      }
      if (safety === 0) this.accumulator = 0;
    }

    this.render(now);
    this.updateHUD();
  };

  private accumulator: number = 0;

  // --------------------------------------------------------------------------
  // Physics tick (one server-tick equivalent)
  // --------------------------------------------------------------------------

  private tickPhysics(now: number): void {
    this.tick++;
    const p = this.player;
    if (!p || p.isDead) return;

    // 1) Compute player desired angle + boost.
    const { angle, boost } = this.computePlayerInput();
    if (angle !== null) p.desiredAngle = angle;
    p.wantsBoost = boost;

    // Extraction progress (3-second hold).
    if (p.isExtracting) {
      p.extractionProgress += TICK_MS;
      if (p.extractionProgress >= EXTRACT_DURATION_MS) {
        this.finishExtract();
        return;
      }
    }

    // 2) Move player.
    this.tickSnakeMovement(p, p.desiredAngle, p.wantsBoost);

    // 3) Bots: think + move.
    for (const bot of this.bots.values()) {
      this.tickBot(bot, now);
    }

    // 4) Build spatial grid for collision + food queries.
    this.grid.clear();
    this.insertSnakeIntoGrid(p);
    for (const bot of this.bots.values()) {
      if (!bot.isDead) this.insertSnakeIntoGrid(bot);
    }
    for (const food of this.foods) {
      if (food.value > 0) {
        this.grid.insert({
          id: food.id,
          kind: 'food',
          x: food.x,
          y: food.y,
          radius: food.size,
          value: food.value,
          foodRef: food,
        });
      }
    }

    // 5) Eat food (player + bots). No star chips — only regular food (+1 score).
    this.eatFood();

    // 6) Collision detection (head-to-body = death; wall = death).
    const deaths = this.detectCollisions(now);

    // 7) Apply deaths.
    let playerDied = false;
    for (const d of deaths) {
      if (d.deadId === p.id) {
        playerDied = true;
        continue;
      }
      const bot = this.bots.get(d.deadId);
      if (bot) {
        // No drops (chip-less mode) — just mark dead + respawn.
        bot.isDead = true;
        // Credit kill to the killer if it's the player.
        if (d.killerId === p.id) {
          p.kills++;
        }
      }
    }

    // 8) Remove dead bots and respawn to maintain count.
    if (deaths.length > 0) {
      const toRemove: string[] = [];
      for (const [id, bot] of this.bots) {
        if (bot.isDead) toRemove.push(id);
      }
      for (const id of toRemove) {
        this.bots.delete(id);
      }
    }
    // Respawn bots to maintain count.
    while (this.bots.size < this.arena.botsCount) {
      const bot = this.spawnBot();
      this.bots.set(bot.id, bot);
    }

    // 9) Player death → death screen.
    if (playerDied) {
      p.isDead = true;
      this.handlePlayerDeath();
      return;
    }

    // 10) Replenish food toward target.
    this.replenishFood();

    // 11) Expire chat bubbles.
    this.expireChat(now);

    // 12) Update camera target.
    this.updateCamera();
  }

  // --------------------------------------------------------------------------
  // Snake movement (server-authoritative formula)
  // --------------------------------------------------------------------------

  private tickSnakeMovement(snake: SnakeBase, desiredAngle: number, wantsBoost: boolean): void {
    if (snake.points.length === 0 || snake.isDead) return;

    // Turn rate: max(0.045, 0.15 - score*0.0006).
    const turnRate = Math.max(TURN_MIN, TURN_BASE - snake.score * TURN_SCORE_FACTOR);
    snake.angle = turnToward(snake.angle, desiredAngle, turnRate);

    // Speed.
    let speed = BASE_SPEED;
    if (snake.isExtracting) {
      speed = EXTRACT_GLIDE_SPEED;
    } else if (wantsBoost && snake.points.length > BOOST_MIN_LENGTH) {
      speed = BOOST_SPEED;
      snake.boostFrameCounter++;
      if (snake.boostFrameCounter >= BOOST_DROP_INTERVAL) {
        snake.boostFrameCounter = 0;
        if (snake.points.length > BOOST_MIN_LENGTH) {
          snake.points.pop();
          snake.score = Math.max(0, snake.score - 1);
        }
      }
    }

    // Move head.
    const head = snake.points[0];
    const nx = head.x + Math.cos(snake.angle) * speed;
    const ny = head.y + Math.sin(snake.angle) * speed;
    snake.points.unshift({ x: nx, y: ny });

    // Grow / shrink body to target length based on SCORE.
    const targetLen = Math.min(MAX_BODY_LENGTH, INITIAL_BODY_LENGTH + snake.score);
    while (snake.points.length > targetLen) snake.points.pop();

    // Size: 8 + sqrt(score) * 0.4.
    snake.size = SIZE_BASE + Math.sqrt(snake.score) * SIZE_SCORE_FACTOR;
  }

  // --------------------------------------------------------------------------
  // Bot AI (scavenger / opportunist / hunter / extractor / coward)
  // --------------------------------------------------------------------------

  private tickBot(bot: BotSession, now: number): void {
    if (bot.points.length === 0 || bot.isDead) return;

    if (now >= bot.nextThinkAt) {
      bot.nextThinkAt = now + BOT_THINK_INTERVAL_MS + Math.floor(Math.random() * BOT_THINK_JITTER_MS);
      const head = bot.points[0];

      // Find nearest food.
      let bestFood: GridItem | null = null;
      let bestFoodDist = Infinity;
      const foodQuery = this.grid.queryRadius(head.x, head.y, BOT_FOOD_SCAN_RADIUS);
      for (const item of foodQuery.values()) {
        if (item.kind !== 'food') continue;
        if ((item.value ?? 0) <= 0) continue;
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < bestFoodDist) {
          bestFoodDist = d;
          bestFood = item;
        }
      }

      // Find nearest threat (foreign body segment within threat scan radius).
      let threatX = 0;
      let threatY = 0;
      let threatDist = Infinity;
      const threatQuery = this.grid.queryRadius(head.x, head.y, BOT_THREAT_SCAN_RADIUS);
      for (const item of threatQuery.values()) {
        if (item.kind !== 'segment') continue;
        if (item.snakeId === bot.id) continue;
        if (item.segIdx === 0) continue;
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < threatDist) {
          threatDist = d;
          threatX = item.x;
          threatY = item.y;
        }
      }

      let desired: number;
      const shouldFlee =
        threatDist < 140 &&
        (bot.personality === 'coward' ||
          bot.personality === 'extractor' ||
          (bot.personality === 'opportunist' && threatDist < 90));

      if (shouldFlee) {
        desired = Math.atan2(head.y - threatY, head.x - threatX);
      } else if (bestFood) {
        desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
      } else {
        desired = bot.angle + (Math.random() - 0.5) * 0.4;
      }

      // Edge avoidance: turn back toward center if near the wall.
      const headR = Math.hypot(head.x - WORLD_RADIUS, head.y - WORLD_RADIUS);
      if (headR > MAP_BASE_RADIUS - BOT_EDGE_AVOID_RADIUS) {
        const toCenter = Math.atan2(WORLD_RADIUS - head.y, WORLD_RADIUS - head.x);
        desired = turnToward(desired, toCenter, BOT_MAX_TURN_PER_TICK * 2);
      }

      bot.desiredAngle = desired;
    }

    // Hunter personality occasionally boosts (no chips required, just body length).
    const wantsBoost = bot.personality === 'hunter' && bot.score > 5 && Math.random() < 0.05;
    this.tickSnakeMovement(bot, bot.desiredAngle, wantsBoost);
  }

  // --------------------------------------------------------------------------
  // Spatial grid insertion
  // --------------------------------------------------------------------------

  private insertSnakeIntoGrid(snake: SnakeBase): void {
    const pts = snake.points;
    // Insert every 2nd segment for performance (collision still resolves fine).
    for (let i = 0; i < pts.length; i += 2) {
      this.grid.insert({
        id: `${snake.id}:${i}`,
        kind: 'segment',
        x: pts[i].x,
        y: pts[i].y,
        radius: snake.size,
        snakeId: snake.id,
        segIdx: i,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Food eating
  // --------------------------------------------------------------------------

  private eatFood(): void {
    const p = this.player;
    if (p && !p.isDead) this.eatFoodForSnake(p);
    for (const bot of this.bots.values()) {
      if (!bot.isDead) this.eatFoodForSnake(bot);
    }
  }

  private eatFoodForSnake(snake: SnakeBase): void {
    if (snake.points.length === 0) return;
    const head = snake.points[0];
    const nearby = this.grid.queryRadius(head.x, head.y, snake.size + 20);
    for (const item of nearby.values()) {
      if (item.kind !== 'food') continue;
      if ((item.value ?? 0) <= 0) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < snake.size + (item.radius || 6) + 6) {
        // Regular food only (+1 score, no chips). No star chips in offline mode.
        snake.score += REGULAR_FOOD_GROW;
        item.value = 0;
        if (item.foodRef) item.foodRef.value = 0;
        // Spawn small particle burst for player only.
        if (snake.isPlayer) {
          this.spawnEatParticles(item.x, item.y, item.radius || 6);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Collision detection
  // --------------------------------------------------------------------------

  private detectCollisions(now: number): { deadId: string; killerId?: string; cause: 'body' | 'wall' }[] {
    const deaths: { deadId: string; killerId?: string; cause: 'body' | 'wall' }[] = [];
    const seenDead = new Set<string>();
    const all: SnakeBase[] = [];
    if (this.player && !this.player.isDead) all.push(this.player);
    for (const bot of this.bots.values()) {
      if (!bot.isDead) all.push(bot);
    }

    const mapRadius = getArenaRadius(now);

    for (const snake of all) {
      if (snake.isDead) continue;
      if (snake.points.length === 0) continue;
      if (now < snake.spawnProtectedUntil) continue;
      if (seenDead.has(snake.id)) continue;
      const head = snake.points[0];

      // Wall collision: outside breathing map radius.
      const distFromCenter = Math.hypot(head.x - WORLD_RADIUS, head.y - WORLD_RADIUS);
      if (distFromCenter > mapRadius) {
        deaths.push({ deadId: snake.id, killerId: 'wall', cause: 'wall' });
        seenDead.add(snake.id);
        continue;
      }

      // Body collision: head vs foreign non-head segment.
      const queryR = snake.size + 30;
      const nearby = this.grid.queryRadius(head.x, head.y, queryR);
      for (const item of nearby.values()) {
        if (item.kind !== 'segment') continue;
        if (item.snakeId === snake.id) continue;
        if (item.segIdx === 0) continue; // head-to-head ignored (no self-collision; head-to-head doesn't kill either)
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < (snake.size + item.radius) * COLLISION_HIT_FACTOR) {
          deaths.push({ deadId: snake.id, killerId: item.snakeId, cause: 'body' });
          seenDead.add(snake.id);
          break;
        }
      }
    }
    return deaths;
  }

  // --------------------------------------------------------------------------
  // Player death
  // --------------------------------------------------------------------------

  private handlePlayerDeath(): void {
    const p = this.player;
    if (!p) return;
    this.finalScore = p.score;
    this.finalKills = p.kills;
    this.finalDurationSeconds = Math.floor((performance.now() - this.startTime) / 1000);
    // Spawn death particles at the head.
    this.spawnDeathParticles(p.points[0].x, p.points[0].y, p.color);
    this.setState('dead');
    this.showEndScreen('death');
  }

  // --------------------------------------------------------------------------
  // Food replenishment
  // --------------------------------------------------------------------------

  private replenishFood(): void {
    if (this.foods.some((f) => f.value <= 0)) {
      this.foods = this.foods.filter((f) => f.value > 0);
    }
    let guard = 0;
    while (this.foods.length < FOOD_COUNT_TARGET && guard < 50) {
      this.foods.push(this.spawnRandomFood());
      guard++;
    }
  }

  // --------------------------------------------------------------------------
  // Chat expiry
  // --------------------------------------------------------------------------

  private expireChat(now: number): void {
    if (this.player && this.player.chatExpiry && now > this.player.chatExpiry) {
      this.player.chatMessage = undefined;
      this.player.chatExpiry = undefined;
    }
    for (const bot of this.bots.values()) {
      if (bot.chatExpiry && now > bot.chatExpiry) {
        bot.chatMessage = undefined;
        bot.chatExpiry = undefined;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Camera
  // --------------------------------------------------------------------------

  private updateCamera(): void {
    const p = this.player;
    if (!p || p.points.length === 0) return;
    const head = p.points[0];
    if (!this.camInit) {
      this.cam.x = head.x;
      this.cam.y = head.y;
      this.camInit = true;
    } else {
      this.cam.x += (head.x - this.cam.x) * 0.18;
      this.cam.y += (head.y - this.cam.y) * 0.18;
    }
    // Zoom: mobile = 0.58, desktop = 0.9; zoom out slightly as body grows.
    const baseZoom = this.isMobile ? 0.58 : 0.9;
    const len = p.points.length;
    const targetZoom = Math.max(baseZoom * 0.65, baseZoom - (len - INITIAL_BODY_LENGTH) * 0.005);
    this.cam.zoom += (targetZoom - this.cam.zoom) * 0.05;
  }

  // --------------------------------------------------------------------------
  // Player input compute
  // --------------------------------------------------------------------------

  private computePlayerInput(): { angle: number | null; boost: boolean } {
    const spaceHeld = this.keys.has(' ') || this.keys.has('space') || this.boostHold;
    // Touch joystick
    if (this.touchAngle !== null) {
      return { angle: this.touchAngle, boost: this.touchBoost || spaceHeld };
    }
    // Keyboard
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.has('w') || k.has('arrowup')) ky -= 1;
    if (k.has('s') || k.has('arrowdown')) ky += 1;
    if (k.has('a') || k.has('arrowleft')) kx -= 1;
    if (k.has('d') || k.has('arrowright')) kx += 1;
    if (kx !== 0 || ky !== 0) {
      return { angle: Math.atan2(ky, kx), boost: spaceHeld };
    }
    // Mouse
    if (this.mouseActive) {
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = this.mousePos.x - cx;
      const dy = this.mousePos.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > MOUSE_DEADZONE_PX) {
        return { angle: Math.atan2(dy, dx), boost: spaceHeld };
      }
    }
    return { angle: null, boost: false };
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  private render(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    // Clear + background.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, cssW, cssH);

    // If no player (rare — between reset and first tick), bail after bg.
    if (!this.player) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }

    // Build render context.
    const rc: FrameRenderCtx = {
      ctx,
      w: cssW,
      h: cssH,
      camX: this.cam.x,
      camY: this.cam.y,
      zoom: this.cam.zoom,
      worldSize: WORLD_SIZE,
      lowQuality: this.lowQuality,
      myId: this.player.id,
      now,
      metallicCache: this.metallicCache,
      playerSkin: this.playerSkin,
      dpr,
    };

    // World transform.
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    // Grid + boundary.
    drawGrid(rc);

    // Food.
    drawFood(rc, this.foods);

    // Snakes (bots first, player last on top).
    for (const bot of this.bots.values()) {
      this.drawSnakeSnapshot(rc, bot);
    }
    this.drawSnakeSnapshot(rc, this.player);

    // Particles.
    drawParticles(rc, this.particles);

    // Reset transform for screen-space overlays.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Joystick (touch).
    this.drawJoystick(ctx);
  }

  private drawSnakeSnapshot(rc: FrameRenderCtx, snake: SnakeBase): void {
    // Downsample long snakes for the snapshot (cap rendered points at 60).
    let pts = snake.points;
    if (pts.length > MAX_SNAPSHOT_POINTS) {
      const step = pts.length / MAX_SNAPSHOT_POINTS;
      const down: Vec2[] = [];
      for (let i = 0; i < MAX_SNAPSHOT_POINTS; i++) {
        down.push(pts[Math.floor(i * step)]);
      }
      pts = down;
    }
    const now = rc.now;
    drawSnake(rc, {
      id: snake.id,
      name: snake.name,
      userTag: snake.userTag,
      points: pts,
      angle: snake.angle,
      size: snake.size,
      color: snake.color,
      secondaryColor: snake.secondaryColor,
      isPlayer: snake.isPlayer,
      isBot: snake.isBot,
      carriedChips: 0,
      score: snake.score,
      isExtracting: snake.isExtracting,
      extractionProgress: Math.min(1, snake.extractionProgress / EXTRACT_DURATION_MS),
      isDead: snake.isDead,
      spawnProtected: now < snake.spawnProtectedUntil,
      chatMessage: snake.chatMessage,
      country: snake.country,
    });
  }

  private drawJoystick(ctx: CanvasRenderingContext2D): void {
    const js = this.joystick;
    if (!js || !js.active) return;
    const dx = js.curX - js.originX;
    const dy = js.curY - js.originY;
    const d = Math.min(JOYSTICK_MAX_RADIUS_PX, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const stickX = js.originX + Math.cos(a) * d;
    const stickY = js.originY + Math.sin(a) * d;
    ctx.beginPath();
    ctx.arc(js.originX, js.originY, JOYSTICK_MAX_RADIUS_PX, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(129, 140, 248, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(stickX, stickY, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(129, 140, 248, 0.85)';
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // Particles
  // --------------------------------------------------------------------------

  private updateParticles(dtMs: number): void {
    const arr = this.particles;
    if (arr.length === 0) return;
    const dt = dtMs / 1000;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dtMs;
      if (p.life <= 0) {
        arr.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    if (arr.length > MAX_PARTICLES) {
      arr.splice(0, arr.length - MAX_PARTICLES);
    }
  }

  private spawnEatParticles(x: number, y: number, size: number): void {
    if (this.lowQuality) return;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 350 + Math.random() * 150,
        maxLife: 500,
        color: '#fbbf24',
        size: Math.max(1, size * 0.6),
      });
    }
  }

  private spawnDeathParticles(x: number, y: number, color: string): void {
    const count = this.lowQuality ? 8 : 24;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 700 + Math.random() * 400,
        maxLife: 1100,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  // --------------------------------------------------------------------------
  // FPS / adaptive quality
  // --------------------------------------------------------------------------

  private updateFps(now: number): void {
    const acc = this.fpsAccum;
    acc.frames += 1;
    if (acc.lastSecond === 0) acc.lastSecond = now;
    const dt = now - acc.lastSecond;
    if (dt >= 1000) {
      const measured = (acc.frames * 1000) / dt;
      this.fps = Math.round(measured);
      if (measured < FPS_LOW_THRESHOLD) {
        if (acc.lowSince === 0) acc.lowSince = now;
        if (acc.highSince !== 0) acc.highSince = 0;
        if (now - acc.lowSince >= FPS_LOW_DURATION_MS && !this.lowQuality) {
          this.lowQuality = true;
        }
      } else if (measured > FPS_HIGH_THRESHOLD) {
        if (acc.highSince === 0) acc.highSince = now;
        if (acc.lowSince !== 0) acc.lowSince = 0;
        if (now - acc.highSince >= FPS_HIGH_DURATION_MS && this.lowQuality) {
          this.lowQuality = false;
        }
      } else {
        acc.lowSince = 0;
        acc.highSince = 0;
      }
      acc.frames = 0;
      acc.lastSecond = now;
    }
  }

  // --------------------------------------------------------------------------
  // State machine
  // --------------------------------------------------------------------------

  private setState(s: OfflineState): void {
    if (this.state === s) return;
    this.state = s;
    try {
      this.onStateChange(s);
    } catch {
      /* ignore */
    }
  }

  // --------------------------------------------------------------------------
  // HUD construction
  // --------------------------------------------------------------------------

  private buildHUD(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    // The parent must be positioned (relative/absolute/fixed). Force it.
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const root = document.createElement('div');
    root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:30;font-family:ui-monospace,monospace;';
    this.overlayRoot = root;

    // --- Top-left HUD stack (Score / Kills / Rank / Boost / Bots) ---
    const leftStack = document.createElement('div');
    leftStack.style.cssText =
      'position:absolute;left:12px;top:12px;display:flex;flex-direction:column;gap:8px;max-width:240px;';
    leftStack.appendChild(this.makeHudCard([
      this.makeHudRow('shield', '#ffffff', 'Score:', () => this.hudEls.score = this.makeSpan('', 'font-weight:bold;color:#fff;')),
    ]));
    leftStack.appendChild(this.makeHudCard([
      this.makeHudRow('skull', '#f43f5e', 'Kills:', () => this.hudEls.kills = this.makeSpan('', 'font-weight:bold;color:#f43f5e;')),
      this.makeHudRow('trophy', '#eab308', 'Rank:', () => this.hudEls.rank = this.makeSpan('', 'font-weight:bold;color:#eab308;')),
      this.makeHudRow('zap', '#f59e0b', 'Boost:', () => {
        const s = this.makeSpan('SPACE', 'font-weight:bold;color:#f59e0b;');
        return s;
      }),
      this.makeHudRow('users', '#cbd5e1', 'Bots:', () => this.hudEls.bots = this.makeSpan('', 'font-weight:bold;color:#cbd5e1;')),
    ]));
    root.appendChild(leftStack);

    // --- Top-right HUD stack (BANKED + FPS + ping) ---
    const rightStack = document.createElement('div');
    rightStack.style.cssText =
      'position:absolute;right:12px;top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;';
    const banked = document.createElement('div');
    banked.style.cssText =
      'border:1px solid rgba(245,158,11,0.3);background:rgba(2,6,23,0.8);padding:4px 10px;border-radius:6px;backdrop-filter:blur(4px);text-align:right;';
    banked.innerHTML =
      '<div style="font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:#64748b;">BANKED</div>' +
      `<div style="font-size:14px;font-weight:bold;color:#fbbf24;">${this.playerProfile.bankedChips.toLocaleString()}c</div>`;
    this.hudEls.banked = banked;
    rightStack.appendChild(banked);

    const fpsRow = document.createElement('div');
    fpsRow.style.cssText =
      'display:flex;gap:8px;align-items:center;border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.8);padding:4px 8px;border-radius:6px;font-size:11px;backdrop-filter:blur(4px);';
    this.hudEls.fps = this.makeSpan('60 fps', 'color:#94a3b8;');
    const ping = this.makeSpan('— ms', 'color:#64748b;');
    fpsRow.appendChild(this.hudEls.fps);
    fpsRow.appendChild(ping);
    rightStack.appendChild(fpsRow);
    root.appendChild(rightStack);

    // --- Leaderboard panel (top-right, below BANKED) ---
    root.appendChild(this.buildLeaderboard());

    // --- Top-center extract hint ---
    const hint = document.createElement('div');
    hint.style.cssText =
      'position:absolute;left:50%;top:56px;transform:translateX(-50%);text-align:center;font-size:11px;color:#94a3b8;pointer-events:none;';
    hint.innerHTML =
      'Hold <kbd style="border:1px solid #475569;background:#1e293b;padding:1px 4px;border-radius:3px;font-size:10px;color:#e2e8f0;">E</kbd> or tap EXTRACT to end your practice run.';
    this.hudEls.idleHint = hint;
    root.appendChild(hint);

    // --- Extract progress bar (hidden by default) ---
    const exWrap = document.createElement('div');
    exWrap.style.cssText =
      'position:absolute;left:50%;top:80px;transform:translateX(-50%);display:none;border:1px solid rgba(245,158,11,0.4);background:rgba(2,6,23,0.85);padding:8px 16px;border-radius:8px;backdrop-filter:blur(4px);text-align:center;';
    const exPct = this.makeSpan('0%', 'font-size:12px;font-weight:bold;color:#fbbf24;');
    const exBarWrap = document.createElement('div');
    exBarWrap.style.cssText =
      'margin-top:6px;width:200px;height:8px;border-radius:4px;background:#1e293b;overflow:hidden;';
    const exBar = document.createElement('div');
    exBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(to right,#eab308,#f59e0b);transition:width 80ms linear;';
    exBarWrap.appendChild(exBar);
    exWrap.appendChild(exPct);
    exWrap.appendChild(exBarWrap);
    this.hudEls.extractingWrap = exWrap;
    this.hudEls.extractingBar = exBar;
    this.hudEls.extractingPct = exPct;
    root.appendChild(exWrap);

    // --- Quick chat emotes bar (bottom-left) ---
    root.appendChild(this.buildEmoteBar());

    // --- Mobile controls: BOOST + EXTRACT (bottom-right) ---
    root.appendChild(this.buildMobileControls());

    // --- Leave button (bottom-left edge) ---
    root.appendChild(this.buildLeaveButton());

    parent.appendChild(root);
  }

  private makeHudCard(rows: HTMLDivElement[]): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText =
      'border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.8);padding:8px 12px;border-radius:8px;backdrop-filter:blur(4px);font-size:12px;display:flex;flex-direction:column;gap:4px;';
    for (const r of rows) card.appendChild(r);
    return card;
  }

  private makeHudRow(
    _icon: string,
    color: string,
    label: string,
    makeValue: () => HTMLSpanElement,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';
    // Use a unicode dot instead of an SVG icon to keep the file lean.
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};`;
    row.appendChild(dot);
    const lab = document.createElement('span');
    lab.textContent = label;
    lab.style.cssText = 'color:#94a3b8;';
    row.appendChild(lab);
    row.appendChild(makeValue());
    return row;
  }

  private makeSpan(text: string, style: string): HTMLSpanElement {
    const s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = style;
    return s;
  }

  private buildLeaderboard(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:absolute;right:12px;top:108px;width:220px;border:1px solid rgba(51,65,85,0.6);background:rgba(2,6,23,0.85);border-radius:8px;backdrop-filter:blur(4px);overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;cursor:pointer;background:rgba(15,23,42,0.8);';
    const title = document.createElement('span');
    title.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;';
    title.textContent = 'Arena Leaderboard';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '▾';
    toggle.style.cssText =
      'background:transparent;border:none;color:#cbd5e1;font-size:14px;cursor:pointer;pointer-events:auto;';
    header.appendChild(title);
    header.appendChild(toggle);
    wrap.appendChild(header);

    const rows = document.createElement('div');
    rows.style.cssText =
      'max-height:240px;overflow-y:auto;padding:4px 6px;display:flex;flex-direction:column;gap:2px;';
    wrap.appendChild(rows);

    this.hudEls.leaderboardRows = rows;
    this.hudEls.leaderboardToggle = toggle;

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      this.hudEls.leaderboardOpen = !this.hudEls.leaderboardOpen;
      rows.style.display = this.hudEls.leaderboardOpen ? 'flex' : 'none';
      toggle.textContent = this.hudEls.leaderboardOpen ? '▾' : '▸';
    };
    header.addEventListener('click', onClick);
    header.style.pointerEvents = 'auto';

    return wrap;
  }

  private buildEmoteBar(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:absolute;left:8px;bottom:8px;width:min(60vw,260px);border:1px solid rgba(30,41,59,0.9);background:rgba(2,6,23,0.9);padding:8px 10px;border-radius:12px;backdrop-filter:blur(6px);pointer-events:auto;';
    const title = document.createElement('div');
    title.style.cssText =
      'font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;';
    title.textContent = 'Emotes (Keys 1-5)';
    wrap.appendChild(title);
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
    const labels = ['GG! 🏆', 'Target! 🎯', 'Flee! 🏃💨', 'Ripped! 💪', 'Extracting! ⚡'];
    for (let i = 0; i < labels.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = labels[i];
      b.style.cssText =
        'border:1px solid #1e293b;background:#0f172a;color:#cbd5e1;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:500;cursor:pointer;';
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.setPlayerChat(QUICK_EMOTES[i]);
      });
      btnRow.appendChild(b);
    }
    wrap.appendChild(btnRow);
    return wrap;
  }

  private buildMobileControls(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:absolute;right:24px;bottom:24px;display:flex;align-items:flex-end;gap:12px;pointer-events:auto;';

    // BOOST button
    const boost = document.createElement('button');
    boost.type = 'button';
    boost.setAttribute('aria-label', 'Boost');
    boost.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
      '<div style="font-size:24px;line-height:1;">⚡</div>' +
      '<div style="font-size:10px;font-weight:bold;">BOOST</div></div>';
    boost.style.cssText =
      'width:64px;height:64px;border-radius:50%;border:1px solid rgba(245,158,11,0.5);background:rgba(245,158,11,0.2);color:#fcd34d;cursor:pointer;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;';
    const boostDown = (e: Event) => {
      e.preventDefault();
      this.boostHold = true;
      this.keys.add(' ');
    };
    const boostUp = (e: Event) => {
      e.preventDefault();
      this.boostHold = false;
      this.keys.delete(' ');
    };
    boost.addEventListener('pointerdown', boostDown);
    boost.addEventListener('pointerup', boostUp);
    boost.addEventListener('pointercancel', boostUp);
    boost.addEventListener('contextmenu', (e) => e.preventDefault());
    wrap.appendChild(boost);

    // EXTRACT button
    const extract = document.createElement('button');
    extract.type = 'button';
    extract.setAttribute('aria-label', 'Extract');
    extract.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
      '<div style="font-size:22px;line-height:1;">🏆</div>' +
      '<div style="font-size:10px;font-weight:bold;">EXTRACT</div></div>';
    extract.style.cssText =
      'width:80px;height:80px;border-radius:50%;border:1px solid rgba(16,185,129,0.6);background:rgba(16,185,129,0.15);color:#6ee7b7;cursor:pointer;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;';
    const exDown = (e: Event) => {
      e.preventDefault();
      if (this.state !== 'playing') return;
      this.extractHold = true;
      this.beginExtract();
    };
    const exUp = (e: Event) => {
      e.preventDefault();
      if (!this.extractHold) return;
      this.extractHold = false;
      this.cancelExtract();
    };
    extract.addEventListener('pointerdown', exDown);
    extract.addEventListener('pointerup', exUp);
    extract.addEventListener('pointercancel', exUp);
    extract.addEventListener('contextmenu', (e) => e.preventDefault());
    wrap.appendChild(extract);

    return wrap;
  }

  private buildLeaveButton(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '⨯ Leave';
    btn.style.cssText =
      'position:absolute;left:12px;bottom:96px;height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(51,65,85,0.8);background:rgba(2,6,23,0.8);color:#94a3b8;font-size:12px;cursor:pointer;backdrop-filter:blur(4px);pointer-events:auto;';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleExitToLobby();
    });
    return btn;
  }

  private teardownHUD(): void {
    if (this.endOverlay && this.endOverlay.parentNode) {
      this.endOverlay.parentNode.removeChild(this.endOverlay);
    }
    this.endOverlay = null;
    if (this.overlayRoot && this.overlayRoot.parentNode) {
      this.overlayRoot.parentNode.removeChild(this.overlayRoot);
    }
    this.overlayRoot = null;
    this.hudEls = { leaderboardOpen: true };
  }

  // --------------------------------------------------------------------------
  // HUD update (per-frame)
  // --------------------------------------------------------------------------

  private updateHUD(): void {
    const p = this.player;
    if (!p) return;
    if (this.hudEls.score) this.hudEls.score.textContent = p.score.toLocaleString();
    if (this.hudEls.kills) this.hudEls.kills.textContent = String(p.kills);
    if (this.hudEls.bots) this.hudEls.bots.textContent = String(this.bots.size);
    if (this.hudEls.fps) this.hudEls.fps.textContent = `${this.fps} fps`;

    // Rank by score (player + bots).
    const all: { id: string; name: string; score: number; isPlayer: boolean }[] = [
      { id: p.id, name: p.name, score: p.score, isPlayer: true },
    ];
    for (const b of this.bots.values()) {
      all.push({ id: b.id, name: b.name, score: b.score, isPlayer: false });
    }
    all.sort((a, b) => b.score - a.score);
    const rank = all.findIndex((s) => s.isPlayer);
    if (this.hudEls.rank) this.hudEls.rank.textContent = `#${rank >= 0 ? rank + 1 : 1}`;

    // Leaderboard (top 10).
    if (this.hudEls.leaderboardRows) {
      const top = all.slice(0, 10);
      const rows = this.hudEls.leaderboardRows;
      // Rebuild only when the order or scores changed (cheap heuristic: compare a
      // joined string).
      const sig = top.map((s) => `${s.id}:${s.score}`).join('|');
      if (sig !== this.lastLeaderboardSig) {
        this.lastLeaderboardSig = sig;
        rows.innerHTML = '';
        for (let i = 0; i < top.length; i++) {
          const s = top[i];
          const row = document.createElement('div');
          row.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:3px 6px;border-radius:4px;font-size:11px;${
            s.isPlayer ? 'background:rgba(34,197,94,0.15);color:#86efac;' : 'color:#cbd5e1;'
          }`;
          const left = document.createElement('span');
          left.style.cssText = 'display:flex;gap:6px;align-items:center;min-width:0;';
          const r = document.createElement('span');
          r.style.cssText = 'color:#64748b;font-weight:bold;min-width:20px;';
          r.textContent = `${i + 1}.`;
          const nm = document.createElement('span');
          nm.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          nm.textContent = s.name;
          left.appendChild(r);
          left.appendChild(nm);
          const sc = document.createElement('span');
          sc.style.cssText = 'font-weight:bold;';
          sc.textContent = String(s.score);
          row.appendChild(left);
          row.appendChild(sc);
          rows.appendChild(row);
        }
      }
    }

    // Extract progress bar.
    if (p.isExtracting && this.hudEls.extractingBar && this.hudEls.extractingPct) {
      const pct = Math.min(100, Math.round((p.extractionProgress / EXTRACT_DURATION_MS) * 100));
      this.hudEls.extractingBar.style.width = `${pct}%`;
      this.hudEls.extractingPct.textContent = `${pct}%`;
    }
  }

  private lastLeaderboardSig: string = '';

  // --------------------------------------------------------------------------
  // End screen (death / extract)
  // --------------------------------------------------------------------------

  private showEndScreen(outcome: 'death' | 'extract'): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    if (this.endOverlay) {
      if (this.endOverlay.parentNode) this.endOverlay.parentNode.removeChild(this.endOverlay);
      this.endOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.85);backdrop-filter:blur(8px);pointer-events:auto;';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const isExtract = outcome === 'extract';
    const mins = Math.floor(this.finalDurationSeconds / 60);
    const secs = this.finalDurationSeconds % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    const title = isExtract ? 'Practice Run Completed!' : 'Arena Disintegration!';
    const titleColor = isExtract ? '#fbbf24' : '#ef4444';
    const accent = isExtract
      ? 'linear-gradient(to right,#eab308,#f59e0b)'
      : '#dc2626';
    const subtitle = isExtract
      ? `Practice run finished! You eliminated ${this.finalKills} training bots, reached a max size of ${this.finalScore}, and survived for ${mins}m ${secs}s.`
      : 'Offline Training — No chips lost.';

    overlay.innerHTML = `
      <div style="width:min(94vw,520px);border:1px solid #1e293b;background:#020617;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.6);overflow:hidden;">
        <div style="height:6px;background:${accent};"></div>
        <div style="padding:24px;">
          <div style="margin:0 auto 12px;width:64px;height:64px;border-radius:16px;border:1px solid ${
            isExtract ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
          };background:${isExtract ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'};display:flex;align-items:center;justify-content:center;font-size:32px;">
            ${isExtract ? '🧭' : '💀'}
          </div>
          <h3 style="text-align:center;font-size:24px;font-weight:bold;color:${titleColor};margin:0;">${title}</h3>
          <p style="text-align:center;font-size:12px;color:#94a3b8;margin:6px 0 0;">${subtitle}</p>

          <div style="margin-top:16px;border:1px solid #1e293b;background:rgba(15,23,42,0.6);border-radius:8px;padding:12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#94a3b8;">Opponents Eliminated:</span>
              <span style="color:#fff;">${this.finalKills} Kills</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="color:#94a3b8;">Max Length:</span>
              <span style="color:#fff;">${this.finalScore}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="color:#94a3b8;">Survival Time:</span>
              <span style="color:#fff;">${durationStr}</span>
            </div>
          </div>

          ${
            isExtract
              ? `<div style="margin-top:12px;border:1px solid #1e293b;background:rgba(15,23,42,0.6);border-radius:8px;padding:12px;text-align:center;">
                   <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#fbbf24;">Offline Training Complete</div>
                   <div style="margin-top:4px;font-size:11px;color:#94a3b8;">No buy-in or banking fees. Great job sharpening your skills and maneuvers!</div>
                 </div>`
              : `<div style="margin-top:12px;border:1px solid rgba(15,23,42,0.6);background:rgba(15,23,42,0.4);border-radius:8px;padding:10px;text-align:center;font-size:11px;color:#94a3b8;">
                   No chips were wagered or lost — offline practice only.
                 </div>`
          }

          <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px;">
            <button id="oe-play-again" type="button" style="width:100%;padding:12px;border-radius:12px;border:none;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;background:${
              isExtract ? 'linear-gradient(to right,#10b981,#14b8a6)' : 'linear-gradient(to right,#dc2626,#e11d48)'
            };display:flex;align-items:center;justify-content:center;gap:8px;">
              ${isExtract ? '🧭' : '💀'} PLAY AGAIN
            </button>
            <button id="oe-exit" type="button" style="width:100%;padding:10px;border-radius:12px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.1);color:#fcd34d;font-weight:bold;font-size:12px;cursor:pointer;">
              RETURN TO LOBBY
            </button>
          </div>
          <p style="margin-top:12px;text-align:center;font-size:10px;color:#64748b;">Press ESC to exit</p>
        </div>
      </div>
    `;
    parent.appendChild(overlay);
    this.endOverlay = overlay;

    const playAgainBtn = overlay.querySelector('#oe-play-again') as HTMLButtonElement | null;
    const exitBtn = overlay.querySelector('#oe-exit') as HTMLButtonElement | null;
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handlePlayAgain();
      });
    }
    if (exitBtn) {
      exitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleExitToLobby();
      });
    }
  }

  // --------------------------------------------------------------------------
  // End-screen actions
  // --------------------------------------------------------------------------

  private handlePlayAgain(): void {
    if (this.endOverlay && this.endOverlay.parentNode) {
      this.endOverlay.parentNode.removeChild(this.endOverlay);
    }
    this.endOverlay = null;
    this.resetWorld();
    this.startTime = performance.now();
    this.accumulator = 0;
    if (this.hudEls.extractingWrap) this.hudEls.extractingWrap.style.display = 'none';
    if (this.hudEls.idleHint) this.hudEls.idleHint.style.display = 'block';
  }

  private handleExitToLobby(): void {
    const result: OfflineExitResult = {
      score: this.finalScore,
      kills: this.finalKills,
      durationSeconds: this.finalDurationSeconds,
    };
    try {
      this.onExit(result);
    } catch {
      /* ignore */
    }
  }
}
