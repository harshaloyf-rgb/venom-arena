'use client';

// ============================================================================
// offline-engine.ts — Pure client-side snake game engine for "Venom Arena".
// ----------------------------------------------------------------------------
// Infinite-map offline practice mode. No server connection, no chips, no stars,
// no wallet, no boundaries. Camera follows the player in an endless world.
//
// Key changes from the original:
//  * **Infinite map** — no boundaries, no wall death, no breathing radius.
//  * **Food orb system** — three sizes (Small/Medium/Large) with weighted spawn.
//  * **No chips / stars / wallet** — pure score-based gameplay.
//  * **Death food drop** — dead snakes drop orbs summing to their total score.
//  * **Head-on collision** — boost-aware resolution rules.
//  * **Bot AI** — no self-destruct, predictive evasion, food-seeking.
//  * **Opacity layering** — larger snakes fade when a smaller snake is near.
//  * **Score model** — INITIAL_SPAWN_SCORE + food eaten, body from score.
// ============================================================================

import {
  BOT_NAMES,
  BOT_SKINS,
  INITIAL_SPAWN_SCORE,
  type ArenaTier,
  getCosmeticById,
  type Skin,
  FOOD_COUNT_TARGET,
} from '@/lib/game-config';
import {
  DEFAULT_SNAKE_CONFIG,
  calcBodyLength,
  calcVisualRadius,
  calcCollisionRadius,
  calcTurnRate,
  calcSpeed,
  turnToward as engineTurnToward,
  moveHead,
  getFoodOrbs,
  randomFoodOrb,
  calcDeathFood,
  type SnakeConfig,
  type FoodOrbDef,
} from '@/lib/snake-engine';
import type { PlayerProfile } from '@/lib/types';
import {
  computeVisibleRect,
  drawParticles,
  drawSnake,
  type FrameRenderCtx,
  type Particle,
} from './render-helpers';
import { playFoodCollect, playDeath, playKill, playBoost, initGameAudio } from '@/lib/game-audio';

// Sub-modules
import type {
  Vec2,
  SnakeBase,
  BotSession,
  VirtualBot,
  Food,
  GridItem,
  OfflineState,
  OfflineExitResult,
  OfflineEngineRef,
} from './offline/offline-types';
import { SpatialHashGrid } from './offline/offline-types';
import {
  MAX_PARTICLES,
  MOUSE_DEADZONE_PX,
  JOYSTICK_DEADZONE,
  JOYSTICK_MAX_RADIUS_PX,
  JOYSTICK_BOOST_MAGNITUDE,
  BOT_THINK_INTERVAL_MS,
  BOT_THINK_JITTER_MS,
  BOT_THREAT_SCAN_RADIUS,
  BOT_MAX_TURN_PER_TICK,
  BOT_PREDICT_AHEAD_TICKS,
  BOT_PREDICT_SPEED,
  PERSONALITIES,
  QUICK_EMOTES,
  VIRTUAL_BOT_COUNT,
  ACTIVATION_RADIUS,
  DEACTIVATION_RADIUS,
  MAX_ACTIVE_BOTS,
  VIRTUAL_BOT_SPEED,
  VIRTUAL_WORLD_RADIUS,
  FOOD_SPAWN_RADIUS_NEAR,
  FOOD_SPAWN_RADIUS_FAR,
  FOOD_FAR_FRACTION,
  OPACITY_PROXIMITY_FACTOR,
  OPACITY_FADE_TO,
  TICK_MS,
  EXTRACT_DURATION_MS,
  MAX_SNAPSHOT_POINTS,
} from './offline/offline-constants';
import { buildHUD, teardownHUD, updateHUD, showEndScreen as showEndScreenFn } from './offline/offline-hud';
import {
  enterPostDeathRecording,
  captureReplaySnapshot,
  finishPostDeathRecording,
  enterReplayMode as enterReplayModeFn,
  exitReplayMode as exitReplayModeFn,
} from './offline/offline-replay';

// ============================================================================
// Main engine
// ============================================================================

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

  // Snake engine config
  private cfg: SnakeConfig = DEFAULT_SNAKE_CONFIG;

  // World state
  private player: SnakeBase | null = null;
  /** Active bots near the player (~50 max). Only these get full physics. */
  private bots: Map<string, BotSession> = new Map();
  /** Virtual bot pool: 1000 bot definitions with cheap position tracking. */
  private virtualBots: VirtualBot[] = [];
  private foods: Food[] = [];
  private boostDropQueue: { x: number; y: number }[] = [];
  private grid: SpatialHashGrid = new SpatialHashGrid(120);
  private tick: number = 0;
  private idCounter: number = 0;
  private startTime: number = 0;

  // rAF + sizing
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastFrameTime: number = 0;

  // Camera (follows player, no world bounds)
  private cam: { x: number; y: number; zoom: number } = {
    x: 0,
    y: 0,
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
  private wasPlayerBoosting: boolean = false;
  private extractHold: boolean = false;

  // HUD / overlays DOM
  private overlayRoot: HTMLDivElement | null = null;
  private hudEls: {
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
  } = { leaderboardOpen: true };

  // End screen DOM (death / extract)
  private endOverlay: HTMLDivElement | null = null;

  // State machine
  private state: OfflineState = 'playing';
  private finalScore: number = 0;
  private finalKills: number = 0;
  private finalDurationSeconds: number = 0;

  // Food drop debug
  private lastFoodDropInfo: string = '';
  private lastFoodDropTime: number = 0;
  private debugDeathsDetected: number = 0;

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

  // Replay recording
  private replayPreBuffer: import('./offline/offline-types').ReplayFrame[] = [];
  private replayPreWriteIdx: number = 0;
  private replayPostBuffer: import('./offline/offline-types').ReplayFrame[] = [];
  private isPostDeathRecording: boolean = false;
  private postDeathTicksRemaining: number = 0;
  private replayDeathFrameIdx: number = 0;
  private deathCamX: number = 0;
  private deathCamY: number = 0;

  // Replay playback mode
  private isReplayMode: boolean = false;
  private replayFrames: import('./offline/offline-types').ReplayFrame[] = [];
  private replayPlaybackIdx: number = 0;
  private replayPlaying: boolean = true;
  private replaySpeed: number = 1;
  private replayZoom: number = 0.8;
  private replayRafId: number | null = null;
  private replayLastTime: number = 0;
  private replayCanvas: HTMLCanvasElement | null = null;
  private replayCtx: CanvasRenderingContext2D | null = null;

  constructor(arena: ArenaTier, playerProfile: PlayerProfile, canvas: HTMLCanvasElement) {
    this.arena = arena;
    this.playerProfile = playerProfile;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Resolve the player's equipped skin.
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
    buildHUD(this);
    this.resetWorld();
    this.wasPlayerBoosting = false;
    initGameAudio(); // Initialize audio context on user interaction
    this.startTime = performance.now();
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.stopped = true;
    this.exitReplayMode();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.detachInput();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    teardownHUD(this);
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
    this.virtualBots = [];
    this.foods = [];
    this.grid.clear();
    this.tick = 0;
    this.idCounter = 0;
    this.particles = [];
    this.camInit = false;

    // Spawn player at origin (0,0), facing east.
    const angle = 0;
    const profile = this.playerProfile;
    this.player = {
      id: 'player-offline',
      name: profile.name,
      userTag: profile.userTag,
      country: profile.country,
      points: initialBody(0, 0, angle, this.cfg.initialBodyLength, this.cfg.segmentSpacing),
      angle,
      size: calcVisualRadius(0, this.cfg),
      collisionRadius: calcCollisionRadius(0, this.cfg),
      color: this.playerSkin?.color ?? '#22c55e',
      secondaryColor: this.playerSkin?.secondaryColor ?? '#15803d',
      isPlayer: true,
      isBot: false,
      score: 0,
      boostFrameCounter: 0,
      isExtracting: false,
      extractionProgress: 0,
      isDead: false,
      spawnProtectedUntil: performance.now() + this.cfg.spawnProtectionMs,
      kills: 0,
      desiredAngle: angle,
      wantsBoost: false,
      isBoosting: false,
    };

    // Create virtual bot pool: 1000 lightweight definitions spread across the world.
    this.createVirtualBotPool(0, 0);

    // Activate bots near the player (within ACTIVATION_RADIUS).
    this.activateNearbyBots();

    // Spawn food orbs around the origin.
    for (let i = 0; i < this.cfg.foodCountTarget; i++) {
      const far = Math.random() < FOOD_FAR_FRACTION;
      this.foods.push(createFoodOrb(this.arena.id, this.idCounterObj, 0, 0, far, getFoodOrbs(this.cfg)));
    }

    this.setState('playing');
    updateHUD(this);
  }

  // --------------------------------------------------------------------------
  // Virtual Bot Pool management
  // --------------------------------------------------------------------------

  /** Create 1000 virtual bot definitions with cheap positions spread around (cx, cy). */
  private createVirtualBotPool(cx: number, cy: number): void {
    this.virtualBots = [];
    for (let i = 0; i < VIRTUAL_BOT_COUNT; i++) {
      const baseName = BOT_NAMES[i % BOT_NAMES.length];
      const name = i < BOT_NAMES.length ? baseName : `${baseName}-${Math.floor(i / BOT_NAMES.length) + 1}`;
      const skin = BOT_SKINS[i % BOT_SKINS.length];
      const personality = PERSONALITIES[i % PERSONALITIES.length];
      const botId = `bot-${this.arena.id}-${i}`;
      const initialScore = Math.floor(Math.random() * 80);

      // Spread bots in a large ring. Use a mix of near and far positions.
      const spawn = randomPointInCircle(cx, cy, VIRTUAL_WORLD_RADIUS);
      const botAngle = Math.random() * Math.PI * 2;

      this.virtualBots.push({
        idx: i,
        id: botId,
        botId,
        name,
        personality,
        color: skin.color,
        secondaryColor: skin.secondaryColor,
        initialScore,
        x: spawn.x,
        y: spawn.y,
        angle: botAngle,
        score: initialScore,
        isActive: false,
      });
    }
  }

  /** Cheaply update all virtual bot positions (straight-line wander). Called every tick but is very lightweight. */
  private updateVirtualBotPositions(): void {
    for (let i = 0; i < this.virtualBots.length; i++) {
      const vb = this.virtualBots[i];
      if (vb.isActive) continue; // active bots are moved by full physics
      // Random angle tweak occasionally (use simple condition instead of Math.random for speed)
      if (((this.tick + i) * 7919) % 1000 < 20) { // deterministic pseudo-random
        vb.angle += (((this.tick + i) * 3571) % 1000 - 500) * 0.0016;
      }
      vb.x += Math.cos(vb.angle) * VIRTUAL_BOT_SPEED;
      vb.y += Math.sin(vb.angle) * VIRTUAL_BOT_SPEED;
    }
  }

  /** Activate virtual bots near the player, deactivate those far away. */
  private activateNearbyBots(): void {
    const p = this.player;
    if (!p || p.points.length === 0) return;
    const px = p.points[0].x;
    const py = p.points[0].y;

    // 1) Deactivate active bots that moved too far from the player.
    const toDeactivate: string[] = [];
    for (const [id, bot] of this.bots) {
      if (bot.points.length === 0) continue;
      const head = bot.points[0];
      const d = dist(head.x, head.y, px, py);
      if (d > DEACTIVATION_RADIUS) {
        // Save state back to virtual bot
        const vb = this.virtualBots[bot.virtualIdx];
        if (vb) {
          vb.x = head.x;
          vb.y = head.y;
          vb.angle = bot.angle;
          vb.score = bot.score;
          vb.isActive = false;
        }
        toDeactivate.push(id);
      }
    }
    for (const id of toDeactivate) {
      this.bots.delete(id);
    }

    // 2) Activate virtual bots within range (up to MAX_ACTIVE_BOTS).
    // Only scan virtual pool every 10 ticks to reduce overhead.
    if (this.tick % 10 !== 0) return;
    if (this.bots.size >= MAX_ACTIVE_BOTS) return;

    // Quick activation: scan virtual bots, find inactive ones within range.
    // No sorting needed — just activate up to the limit.
    for (let i = 0; i < this.virtualBots.length && this.bots.size < MAX_ACTIVE_BOTS; i++) {
      const vb = this.virtualBots[i];
      if (vb.isActive) continue;
      const d = dist(vb.x, vb.y, px, py);
      if (d < ACTIVATION_RADIUS) {
        const bot = this.createActiveBotFromVirtual(vb, px, py);
        this.bots.set(bot.id, bot);
        vb.isActive = true;
      }
    }
  }

  /** Create a full BotSession from a VirtualBot definition. */
  private createActiveBotFromVirtual(vb: VirtualBot, playerX: number, playerY: number): BotSession {
    const now = performance.now();
    const angle = vb.angle;
    const bodyLen = calcBodyLength(vb.score, this.cfg);
    return {
      id: vb.id,
      botId: vb.botId,
      name: vb.name,
      points: initialBody(vb.x, vb.y, angle, bodyLen, this.cfg.segmentSpacing),
      angle,
      size: calcVisualRadius(vb.score, this.cfg),
      collisionRadius: calcCollisionRadius(vb.score, this.cfg),
      color: vb.color,
      secondaryColor: vb.secondaryColor,
      isPlayer: false,
      isBot: true,
      score: vb.score,
      boostFrameCounter: 0,
      isExtracting: false,
      extractionProgress: 0,
      isDead: false,
      spawnProtectedUntil: now + this.cfg.spawnProtectionMs,
      kills: 0,
      desiredAngle: angle,
      wantsBoost: false,
      isBoosting: false,
      personality: vb.personality,
      nextThinkAt: 0,
      virtualIdx: vb.idx,
    };
  }

  /** Reset a dead virtual bot to a random position (for recycling). */
  private respawnVirtualBot(vb: VirtualBot, playerX: number, playerY: number): void {
    vb.isActive = false;
    const spawn = randomPointInCircle(playerX, playerY, VIRTUAL_WORLD_RADIUS);
    const d = dist(spawn.x, spawn.y, playerX, playerY);
    if (d < 1500) {
      const farAngle = Math.atan2(spawn.y - playerY, spawn.x - playerX);
      vb.x = playerX + Math.cos(farAngle) * (1500 + Math.random() * 2000);
      vb.y = playerY + Math.sin(farAngle) * (1500 + Math.random() * 2000);
    } else {
      vb.x = spawn.x;
      vb.y = spawn.y;
    }
    vb.angle = Math.random() * Math.PI * 2;
    vb.score = Math.floor(Math.random() * 80);
  }

  /** Helper so we can pass idCounter by reference to food-creation helpers. */
  private get idCounterObj(): { value: number } {
    return { value: this.idCounter };
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
    if (!p) return;

    if (p.isDead) return;
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
    this.finalScore = this.cfg.initialSpawnScore + p.score;
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

    // Physics ticks at ~TICK_MS (30 Hz) cadence.
    if (this.state === 'playing' || this.isPostDeathRecording) {
      this.accumulator += dt;
      let safety = 4;
      while (this.accumulator >= TICK_MS && safety > 0) {
        this.tickPhysics(now);
        this.accumulator -= TICK_MS;
        safety--;
      }
      if (safety === 0) this.accumulator = 0;
    }

    // Post-death recording: count down ticks
    if (this.isPostDeathRecording) {
      this.postDeathTicksRemaining--;
      if (this.postDeathTicksRemaining <= 0) {
        finishPostDeathRecording(this);
      }
    }

    this.render(now);
    updateHUD(this);
  };

  private accumulator: number = 0;

  // --------------------------------------------------------------------------
  // Physics tick (one server-tick equivalent)
  // --------------------------------------------------------------------------

  private tickPhysics(now: number): void {
    this.tick++;
    const p = this.player;
    if (!p) return;

    // During post-death recording, run simplified bot-only physics
    if (this.isPostDeathRecording) {
      this.tickPostDeathPhysics(now);
      captureReplaySnapshot(this);
      return;
    }

    if (p.isDead) return;

    // 1) Compute player desired angle + boost.
    const { angle, boost } = this.computePlayerInput();
    if (angle !== null) p.desiredAngle = angle;
    p.wantsBoost = boost;
    p.isBoosting = boost && p.points.length > this.cfg.boostMinLength && p.score > 0;
    // Boost activation sound
    if (p.isBoosting && !this.wasPlayerBoosting) {
      playBoost();
    }
    this.wasPlayerBoosting = p.isBoosting;

    // Extraction progress (3-second hold).
    if (p.isExtracting) {
      p.extractionProgress += TICK_MS;
      if (p.extractionProgress >= this.cfg.extractionDurationMs) {
        this.finishExtract();
        return;
      }
    }

    // 2) Move player.
    this.tickSnakeMovement(p, p.desiredAngle, p.wantsBoost);

    // 3) Update virtual bot positions cheaply + manage activation/deactivation.
    this.updateVirtualBotPositions();
    this.activateNearbyBots();

    // 4) Bots: think + move (only active bots).
    for (const bot of this.bots.values()) {
      this.tickBot(bot, now);
    }

    // Process boost food drops (from tail shedding)
    if (this.boostDropQueue.length > 0) {
      for (const drop of this.boostDropQueue) {
        this.foods.push({
          id: `food-${this.arena.id}-${this.idCounterObj.value++}`,
          x: drop.x,
          y: drop.y,
          size: 3,
          value: 1,
          isStarChip: false,
          color: '#34d399',
          glowColor: '#10b981',
          orbSize: 'small',
        });
      }
      this.boostDropQueue.length = 0;
    }

    // 4) Build spatial grid for collision + food queries.
    this.grid.clear();
    this.insertSnakeIntoGrid(p);
    for (const bot of this.bots.values()) {
      if (!bot.isDead) this.insertSnakeIntoGrid(bot);
    }
    for (const food of this.foods) {
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

    // 5) Eat food (player + bots).
    this.eatFood();

    // 6) Collision detection (body collision + head-on collision). NO wall death.
    const deaths = this.detectCollisions(now);
    this.debugDeathsDetected = deaths.length;

    // 7) Apply deaths + drop food.
    let playerDied = false;
    const newDropFoods: Food[] = [];
    for (const d of deaths) {
      const deadSnake = d.deadId === p.id
        ? p
        : this.bots.get(d.deadId);
      if (!deadSnake || deadSnake.points.length === 0) continue;

      const totalScore = deadSnake.score;
      const dropped = computeDeathFoodDrop(totalScore, deadSnake.points, this.arena.id, this.idCounterObj, getFoodOrbs(this.cfg));
      newDropFoods.push(...dropped);

      // Spawn visible food burst particles along the body so the drop is unmistakable.
      this.spawnFoodBurstParticles(deadSnake.points, deadSnake.color);

      if (d.deadId === p.id) {
        playerDied = true;
      } else {
        deadSnake.isDead = true;
        // Credit kill to the killer if it's the player.
        if (d.killerId === p.id) {
          p.kills++;
          playKill(); // Satisfying kill sound
        }
      }
    }

    // Add dropped food to the world.
    if (newDropFoods.length > 0) {
      this.foods.push(...newDropFoods);
      this.lastFoodDropInfo = `+${newDropFoods.length} food orbs (${deaths.length} deaths, foods now: ${this.foods.length})`;
      this.lastFoodDropTime = now;
    }

    // 8) Remove dead bots and recycle their virtual bots.
    if (deaths.length > 0) {
      const pHead = p.points[0];
      const toRemove: string[] = [];
      for (const [id, bot] of this.bots) {
        if (bot.isDead) {
          // Recycle the virtual bot to a new random position
          const vb = this.virtualBots[bot.virtualIdx];
          if (vb) {
            this.respawnVirtualBot(vb, pHead.x, pHead.y);
          }
          toRemove.push(id);
        }
      }
      for (const id of toRemove) {
        this.bots.delete(id);
      }
    }

    // 9) Player death → enter post-death recording (15s of continued simulation).
    if (playerDied && !this.isPostDeathRecording) {
      p.isDead = true;
      playDeath(); // Dramatic crash sound on death
      enterPostDeathRecording(this);
      // Don't return — continue to replenish food, expire chat, update camera
    }

    // 10) Replenish food toward target (spawn around player).
    this.replenishFood();

    // 11) Expire chat bubbles.
    this.expireChat(now);

    // 12) Update camera target.
    this.updateCamera();

    // 13) Capture replay snapshot.
    captureReplaySnapshot(this);
  }

  // --------------------------------------------------------------------------
  // Snake movement (server-authoritative formula)
  // --------------------------------------------------------------------------

  private tickSnakeMovement(snake: SnakeBase, desiredAngle: number, wantsBoost: boolean): void {
    if (snake.points.length === 0 || snake.isDead) return;

    // Turn rate from engine.
    const turnRate = calcTurnRate(snake.score, this.cfg);
    snake.angle = engineTurnToward(snake.angle, desiredAngle, turnRate);

    // Speed from engine.
    const isBoosting = wantsBoost && snake.points.length > this.cfg.boostMinLength && snake.score > 0;
    snake.isBoosting = isBoosting;
    const speed = calcSpeed(isBoosting, snake.isExtracting, this.cfg);

    if (isBoosting) {
      snake.boostFrameCounter++;
      if (snake.boostFrameCounter >= this.cfg.boostDropInterval) {
        snake.boostFrameCounter = 0;
        if (snake.points.length > this.cfg.boostMinLength + 1 && snake.score > 1) {
          const tail = snake.points[snake.points.length - 1];
          this.boostDropQueue.push({ x: tail.x, y: tail.y });
          snake.points.pop();
          snake.score = Math.max(0, snake.score - 1);
        }
      }
    }

    // Move head using engine.
    const head = snake.points[0];
    const newHead = moveHead(head, snake.angle, speed);
    snake.points.unshift(newHead);

    // Grow / shrink body to target length from engine.
    const targetLen = Math.max(
      this.cfg.boostMinLength + 1,
      calcBodyLength(snake.score, this.cfg),
    );
    while (snake.points.length > targetLen) snake.points.pop();

    // Update visual + collision radii from engine.
    snake.size = calcVisualRadius(snake.score, this.cfg);
    snake.collisionRadius = calcCollisionRadius(snake.score, this.cfg);
  }

  // --------------------------------------------------------------------------
  // Bot AI — no self-destruct, seek food, predictive evasion
  // --------------------------------------------------------------------------

  private tickBot(bot: BotSession, now: number): void {
    if (bot.points.length === 0 || bot.isDead) return;

    if (now >= bot.nextThinkAt) {
      bot.nextThinkAt = now + BOT_THINK_INTERVAL_MS + Math.floor(Math.random() * BOT_THINK_JITTER_MS);
      const head = bot.points[0];

      // --- Find nearest food ---
      let bestFood: GridItem | null = null;
      let bestFoodDist = Infinity;
      const foodQuery = this.grid.queryRadius(head.x, head.y, this.cfg.botFoodScanRadius);
      for (const item of foodQuery.values()) {
        if (item.kind !== 'food') continue;
        if ((item.value ?? 0) <= 0) continue;
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < bestFoodDist) {
          bestFoodDist = d;
          bestFood = item;
        }
      }

      // --- Find nearest threat (foreign body segment) ---
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
      const shouldFlee = threatDist < 150; // ALL bots dodge body segments when close

      // --- Predictive evasion against the human player ---
      const p = this.player;
      if (p && !p.isDead && p.points.length > 0 && now >= p.spawnProtectedUntil) {
        const playerHead = p.points[0];
        const playerDist = dist(head.x, head.y, playerHead.x, playerHead.y);
        if (playerDist < this.cfg.botEvadeRadius * 2) {
          // Predict where the player will be in N ticks.
          const predictedX = playerHead.x + Math.cos(p.angle) * BOT_PREDICT_SPEED * BOT_PREDICT_AHEAD_TICKS;
          const predictedY = playerHead.y + Math.sin(p.angle) * BOT_PREDICT_SPEED * BOT_PREDICT_AHEAD_TICKS;
          const distToPredicted = dist(head.x, head.y, predictedX, predictedY);

          // If the bot is on a collision course with the predicted position, evade.
          if (distToPredicted < (bot.size + p.size) * 3) {
            // Evade perpendicular to the player's heading.
            const evadeAngle = p.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
            desired = evadeAngle;
            bot.desiredAngle = desired;
            const wantsBoost = bot.personality === 'hunter' && bot.score > 10;
            this.tickSnakeMovement(bot, bot.desiredAngle, wantsBoost);
            return;
          }
        }
      }

      // Also check nearby bot heads for predictive evasion
      for (const other of this.bots.values()) {
        if (other.id === bot.id || other.isDead || other.points.length === 0) continue;
        const otherHead = other.points[0];
        const otherDist = dist(head.x, head.y, otherHead.x, otherHead.y);
        if (otherDist < 200) {
          const predictedX = otherHead.x + Math.cos(other.angle) * BOT_PREDICT_SPEED * BOT_PREDICT_AHEAD_TICKS;
          const predictedY = otherHead.y + Math.sin(other.angle) * BOT_PREDICT_SPEED * BOT_PREDICT_AHEAD_TICKS;
          const distToPredicted = dist(head.x, head.y, predictedX, predictedY);
          if (distToPredicted < (bot.size + other.size) * 3) {
            const evadeAngle = other.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
            desired = evadeAngle;
            bot.desiredAngle = desired;
            this.tickSnakeMovement(bot, bot.desiredAngle, false);
            return;
          }
        }
      }

      if (shouldFlee) {
        desired = Math.atan2(head.y - threatY, head.x - threatX);
      } else if (bestFood) {
        desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
      } else {
        desired = bot.angle + (Math.random() - 0.5) * 0.4;
      }

      // NO edge avoidance — infinite map, no boundaries.

      bot.desiredAngle = desired;
    }

    // Hunter personality occasionally boosts.
    const wantsBoost = bot.personality === 'hunter' && bot.score > 5 && Math.random() < 0.05;
    this.tickSnakeMovement(bot, bot.desiredAngle, wantsBoost);
  }

  // --------------------------------------------------------------------------
  // Spatial grid insertion
  // --------------------------------------------------------------------------

  private insertSnakeIntoGrid(snake: SnakeBase): void {
    const pts = snake.points;
    for (let i = 0; i < pts.length; i += 2) {
      this.grid.insert({
        id: `${snake.id}:${i}`,
        kind: 'segment',
        x: pts[i].x,
        y: pts[i].y,
        radius: snake.collisionRadius,
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
    const nearby = this.grid.queryRadius(head.x, head.y, snake.collisionRadius + 20);
    for (const item of nearby.values()) {
      if (item.kind !== 'food') continue;
      if ((item.value ?? 0) <= 0) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < snake.collisionRadius + (item.radius || 6) + 6) {
        // Eat food — add its value to the snake's food-score.
        const eatenValue = item.value ?? 0;
        snake.score += eatenValue;
        item.value = 0;
        if (item.foodRef) item.foodRef.value = 0;
        // Spawn small particle burst + sound for player only.
        if (snake.isPlayer) {
          const orbSize = eatenValue >= 5 ? 'large' : eatenValue >= 3 ? 'medium' : 'small';
          playFoodCollect(orbSize);
          this.spawnEatParticles(item.x, item.y, item.radius || 6, item.foodRef?.color ?? '#fbbf24');
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Collision detection (body + head-on) — NO wall death
  // --------------------------------------------------------------------------

  private detectCollisions(now: number): { deadId: string; killerId?: string; cause: 'body' | 'headon' }[] {
    const deaths: { deadId: string; killerId?: string; cause: 'body' | 'headon' }[] = [];
    const seenDead = new Set<string>();
    const all: SnakeBase[] = [];
    if (this.player && !this.player.isDead) all.push(this.player);
    for (const bot of this.bots.values()) {
      if (!bot.isDead) all.push(bot);
    }

    // --- Head-to-head collision (checked first, takes priority) ---
    const headOnChecked = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.isDead || b.isDead) continue;
        if (now < a.spawnProtectedUntil || now < b.spawnProtectedUntil) continue;
        const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (headOnChecked.has(pairKey)) continue;
        headOnChecked.add(pairKey);

        const ha = a.points[0];
        const hb = b.points[0];
        const d = dist(ha.x, ha.y, hb.x, hb.y);
        const hitDist = (a.size + b.size) * this.cfg.headOnHitFactor;
        if (d >= hitDist) continue;

        // Head-on collision! Determine winner based on rules.
        const aBoosting = a.isBoosting;
        const bBoosting = b.isBoosting;
        const aTotalScore = this.cfg.initialSpawnScore + a.score;
        const bTotalScore = this.cfg.initialSpawnScore + b.score;

        let aDies = false;
        let bDies = false;

        if (aTotalScore === bTotalScore) {
          // Tie — both die
          aDies = true;
          bDies = true;
        } else if (aBoosting && !bBoosting) {
          // A is boosting, B is not → A wins (boost advantage)
          bDies = true;
        } else if (bBoosting && !aBoosting) {
          // B is boosting, A is not → B wins (boost advantage)
          aDies = true;
        } else {
          // Both boosting or neither boosting → higher score wins
          if (aTotalScore > bTotalScore) {
            bDies = true;
          } else {
            aDies = true;
          }
        }

        if (aDies && !seenDead.has(a.id)) {
          deaths.push({ deadId: a.id, killerId: b.id, cause: 'headon' });
          seenDead.add(a.id);
        }
        if (bDies && !seenDead.has(b.id)) {
          deaths.push({ deadId: b.id, killerId: a.id, cause: 'headon' });
          seenDead.add(b.id);
        }
      }
    }

    // --- Body collision: head vs foreign non-head segment ---
    for (const snake of all) {
      if (snake.isDead) continue;
      if (snake.points.length === 0) continue;
      if (now < snake.spawnProtectedUntil) continue;
      if (seenDead.has(snake.id)) continue;
      const head = snake.points[0];

      // NO wall collision — infinite map.

      const queryR = snake.size + 30;
      const nearby = this.grid.queryRadius(head.x, head.y, queryR);
      for (const item of nearby.values()) {
        if (item.kind !== 'segment') continue;
        // Own-collision immunity — skip own segments.
        if (item.snakeId === snake.id) continue;
        // Skip head segments (handled by head-on collision above).
        if (item.segIdx === 0) continue;
        // Neck protection: angle-based — check if approach angle is shallow
        if (item.segIdx != null && item.segIdx <= 5) continue;
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < (snake.size + item.radius) * this.cfg.hitFactor) {
          deaths.push({ deadId: snake.id, killerId: item.snakeId, cause: 'body' });
          seenDead.add(snake.id);
          break;
        }
      }
    }
    return deaths;
  }

  // --------------------------------------------------------------------------
  // Post-death physics (bots-only simulation during recording)
  // --------------------------------------------------------------------------

  private tickPostDeathPhysics(now: number): void {
    // Move bots only (player is dead)
    for (const bot of this.bots.values()) {
      this.tickBot(bot, now);
    }

    // Process boost food drops
    if (this.boostDropQueue.length > 0) {
      for (const drop of this.boostDropQueue) {
        this.foods.push({
          id: `food-${this.arena.id}-${this.idCounterObj.value++}`,
          x: drop.x,
          y: drop.y,
          size: 3,
          value: 1,
          isStarChip: false,
          color: '#34d399',
          glowColor: '#10b981',
          orbSize: 'small',
        });
      }
      this.boostDropQueue.length = 0;
    }

    // Build spatial grid (bots + food only)
    this.grid.clear();
    for (const bot of this.bots.values()) {
      if (!bot.isDead) this.insertSnakeIntoGrid(bot);
    }
    for (const food of this.foods) {
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

    // Eat food (bots only)
    for (const bot of this.bots.values()) {
      if (!bot.isDead) this.eatFoodForSnake(bot);
    }

    // Collision detection (bots vs bots only - player already dead)
    const deaths = this.detectCollisions(now);

    // Apply bot deaths + drop food
    const newDropFoods: Food[] = [];
    for (const d of deaths) {
      const bot = this.bots.get(d.deadId);
      if (bot) {
        const botTotal = bot.score;
        newDropFoods.push(...computeDeathFoodDrop(botTotal, bot.points, this.arena.id, this.idCounterObj, getFoodOrbs(this.cfg)));
        // Spawn food burst particles for bot deaths during post-death too
        this.spawnFoodBurstParticles(bot.points, bot.color);
        bot.isDead = true;
      }
    }

    if (newDropFoods.length > 0) {
      this.foods.push(...newDropFoods);
      this.lastFoodDropInfo = `+${newDropFoods.length} food orbs (post-death bot kill, foods now: ${this.foods.length})`;
      this.lastFoodDropTime = performance.now();
    }

    // Remove dead bots and recycle virtual bots
    if (deaths.length > 0) {
      const toRemove: string[] = [];
      for (const [id, bot] of this.bots) {
        if (bot.isDead) {
          const vb = this.virtualBots[bot.virtualIdx];
          if (vb) {
            this.respawnVirtualBot(vb, this.deathCamX, this.deathCamY);
          }
          toRemove.push(id);
        }
      }
      for (const id of toRemove) {
        this.bots.delete(id);
      }
    }
    // Note: no respawn loop needed — virtual pool handles recycling.

    // Replenish food
    this.replenishFood();
  }

  // --------------------------------------------------------------------------
  // Food replenishment (spawn around the player's current position)
  // --------------------------------------------------------------------------

  private replenishFood(): void {
    // Remove eaten food (value <= 0).
    this.foods = this.foods.filter((f) => f.value > 0);

    // Replenish up to target, spawning around the player.
    const p = this.player;
    const cx = p ? p.points[0].x : 0;
    const cy = p ? p.points[0].y : 0;
    let guard = 0;
    while (this.foods.length < FOOD_COUNT_TARGET && guard < 50) {
      const far = Math.random() < FOOD_FAR_FRACTION;
      this.foods.push(createFoodOrb(this.arena.id, this.idCounterObj, cx, cy, far));
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
  // Camera (follows player, no world bounds)
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
      const lerpSpeed = 0.18;
      this.cam.x += (head.x - this.cam.x) * lerpSpeed;
      this.cam.y += (head.y - this.cam.y) * lerpSpeed;
    }
    // Zoom: mobile = 0.58, desktop = 0.9; zoom out slightly as body grows.
    const baseZoom = this.isMobile ? 0.58 : 0.85;
    const len = p.points.length;
    const targetZoom = Math.max(baseZoom * 0.65, baseZoom - (len - this.cfg.initialBodyLength) * 0.005);
    this.cam.zoom += (targetZoom - this.cam.zoom) * 0.05;
  }

  // --------------------------------------------------------------------------
  // Player input compute
  // --------------------------------------------------------------------------

  private computePlayerInput(): { angle: number | null; boost: boolean } {
    const spaceHeld = this.keys.has(' ') || this.boostHold;
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
    if (this.isReplayMode) return; // Replay has its own canvas
    const ctx = this.ctx;
    if (!ctx) return;
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    // Guard: if backing store doesn't match CSS size, re-resize immediately.
    const expectedW = Math.floor(cssW * dpr);
    const expectedH = Math.floor(cssH * dpr);
    if (canvas.width !== expectedW || canvas.height !== expectedH) {
      canvas.width = expectedW;
      canvas.height = expectedH;
      this.metallicCache.clear();
    }

    // Clear + background.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, cssW, cssH);

    if (!this.player) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }

    // Build render context.
    const input = this.computePlayerInput();
    const rc: FrameRenderCtx = {
      ctx,
      w: cssW,
      h: cssH,
      camX: this.cam.x,
      camY: this.cam.y,
      zoom: this.cam.zoom,
      worldSize: 1000000, // large placeholder (infinite map)
      lowQuality: this.lowQuality,
      myId: this.player.id,
      now,
      metallicCache: this.metallicCache,
      playerSkin: this.playerSkin,
      dpr,
      pointerAngle: input.angle ?? this.player.angle,
    };

    // World transform.
    ctx.translate(cssW / 2, cssH / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    // --- Infinite grid (no boundary circle) ---
    this.drawInfiniteGrid(ctx, rc);

    // --- Food orbs (custom rendering with glow per size) ---
    this.drawFoodOrbs(ctx, rc);

    // --- Snakes with opacity layering ---
    this.drawAllSnakes(ctx, rc, now);

    // --- Particles ---
    drawParticles(rc, this.particles);

    // Reset transform for screen-space overlays.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Debug: show food drop info + food count + collision info.
    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    const pState = this.player?.isDead ? 'DEAD' : (this.isPostDeathRecording ? 'POST-DEATH' : 'ALIVE');
    ctx.fillText(`Foods:${this.foods.length} Bots:${this.bots.size} Deaths:${this.debugDeathsDetected} ${pState}`, 10, cssH - 10);
    ctx.restore();
    // Flash food drop banner (fades after 4s).
    if (this.lastFoodDropInfo && now - this.lastFoodDropTime < 4000) {
      const alpha = Math.max(0, 1 - (now - this.lastFoodDropTime) / 4000);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(`FOOD DROP: ${this.lastFoodDropInfo}`, cssW / 2, 50);
      ctx.fillText(`FOOD DROP: ${this.lastFoodDropInfo}`, cssW / 2, 50);
      ctx.restore();
    }

    // Joystick (touch).
    this.drawJoystick(ctx);
  }

  // --------------------------------------------------------------------------
  // Infinite grid rendering (no circular boundary)
  // --------------------------------------------------------------------------

  private drawInfiniteGrid(ctx: CanvasRenderingContext2D, rc: FrameRenderCtx): void {
    const vis = computeVisibleRect(rc);
    const gridSize = 60;
    const zoom = rc.zoom;

    // Clamp to avoid drawing extreme ranges.
    const startX = Math.floor(vis.left / gridSize) * gridSize;
    const endX = Math.ceil(vis.right / gridSize) * gridSize;
    const startY = Math.floor(vis.top / gridSize) * gridSize;
    const endY = Math.ceil(vis.bottom / gridSize) * gridSize;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Origin crosshair (subtle).
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(endX, 0);
    ctx.moveTo(0, startY);
    ctx.lineTo(0, endY);
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Food orb rendering (three sizes with distinct glow)
  // --------------------------------------------------------------------------

  private drawFoodOrbs(ctx: CanvasRenderingContext2D, rc: FrameRenderCtx): void {
    const vis = computeVisibleRect(rc);
    const zoom = rc.zoom;
    const lowQ = rc.lowQuality;

    // Batch by orb size for efficient rendering.
    // Small: tiny glowing dot, green
    // Medium: medium circle, blue
    // Large: larger circle, pink with brighter glow
    const smalls: Food[] = [];
    const mediums: Food[] = [];
    const larges: Food[] = [];

    for (let i = 0; i < this.foods.length; i++) {
      const f = this.foods[i];
      if (f.value <= 0) continue;
      if (f.x < vis.left || f.x > vis.right || f.y < vis.top || f.y > vis.bottom) continue;

      if (f.orbSize === 'small') smalls.push(f);
      else if (f.orbSize === 'medium') mediums.push(f);
      else larges.push(f);
    }

    // --- Small orbs: batched simple circles ---
    if (smalls.length > 0) {
      if (!lowQ) {
        ctx.save();
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 4;
      }
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      for (let i = 0; i < smalls.length; i++) {
        const f = smalls[i];
        ctx.moveTo(f.x + f.size, f.y);
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      }
      ctx.fill();
      if (!lowQ) {
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // --- Medium orbs: batched circles with medium glow ---
    if (mediums.length > 0) {
      if (!lowQ) {
        ctx.save();
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      for (let i = 0; i < mediums.length; i++) {
        const f = mediums[i];
        ctx.moveTo(f.x + f.size, f.y);
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      }
      ctx.fill();
      if (!lowQ) {
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // --- Large orbs: individual rendering with brighter glow + outer ring ---
    if (larges.length > 0) {
      ctx.save();
      if (!lowQ) {
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      for (let i = 0; i < larges.length; i++) {
        const f = larges[i];
        ctx.moveTo(f.x + f.size, f.y);
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      }
      ctx.fill();
      if (!lowQ) {
        // Outer glow ring for large orbs
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        for (let i = 0; i < larges.length; i++) {
          const f = larges[i];
          ctx.moveTo(f.x + f.size + 3, f.y);
          ctx.arc(f.x, f.y, f.size + 3, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Snake rendering with opacity layering
  // --------------------------------------------------------------------------

  private drawAllSnakes(ctx: CanvasRenderingContext2D, rc: FrameRenderCtx, now: number): void {
    const p = this.player;
    if (!p) return;

    // Rendering culling: only process snakes within VIEW_RADIUS of camera center.
    // With 1000 bots, rendering all is prohibitively expensive.
    const VIEW_RADIUS = 1500;
    const camX = this.cam.x;
    const camY = this.cam.y;

    // Gather only visible snakes.
    const allSnakes: SnakeBase[] = [];
    for (const bot of this.bots.values()) {
      if (bot.isDead || bot.points.length === 0) continue;
      if (dist(bot.points[0].x, bot.points[0].y, camX, camY) > VIEW_RADIUS) continue;
      allSnakes.push(bot);
    }
    if (!p.isDead && p.points.length > 0) allSnakes.push(p);

    // Pre-compute opacity for each snake based on proximity to smaller snakes.
    const opacityMap = new Map<string, number>();
    for (const snake of allSnakes) {
      opacityMap.set(snake.id, 1.0);
    }

    for (let i = 0; i < allSnakes.length; i++) {
      const a = allSnakes[i];
      if (a.points.length === 0) continue;
      const aTotalScore = INITIAL_SPAWN_SCORE + a.score;

      for (let j = 0; j < allSnakes.length; j++) {
        if (i === j) continue;
        const b = allSnakes[j];
        if (b.points.length === 0) continue;
        const bTotalScore = this.cfg.initialSpawnScore + b.score;

        // Check if a is smaller and b is larger.
        if (aTotalScore < bTotalScore) {
          const d = dist(a.points[0].x, a.points[0].y, b.points[0].x, b.points[0].y);
          const proximityThreshold = (a.size + b.size) * OPACITY_PROXIMITY_FACTOR;
          if (d < proximityThreshold) {
            // The larger snake (b) fades.
            const current = opacityMap.get(b.id) ?? 1.0;
            opacityMap.set(b.id, Math.min(current, OPACITY_FADE_TO));
          }
        }
      }
    }

    // Render bots first, player last (on top).
    for (const snake of allSnakes) {
      if (snake.isPlayer) continue; // Player rendered last
      const opacity = opacityMap.get(snake.id) ?? 1.0;
      ctx.save();
      ctx.globalAlpha = opacity;
      this.drawSnakeSnapshot(rc, snake);
      ctx.restore();
    }
    if (!p.isDead && p.points.length > 0) {
      const opacity = opacityMap.get(p.id) ?? 1.0;
      ctx.save();
      ctx.globalAlpha = opacity;
      this.drawSnakeSnapshot(rc, p);
      ctx.restore();
    }
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
    const totalScore = this.cfg.initialSpawnScore + snake.score;
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
      score: totalScore,
      isExtracting: snake.isExtracting,
      extractionProgress: Math.min(1, snake.extractionProgress / EXTRACT_DURATION_MS),
      isDead: snake.isDead,
      spawnProtected: now < snake.spawnProtectedUntil,
      chatMessage: snake.chatMessage,
      country: snake.country,
      isBoosting: snake.isBoosting,
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

  private spawnEatParticles(x: number, y: number, size: number, color: string): void {
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
        color,
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

  /**
   * Spawn visible food-burst particles along a dead snake's body.
   * Samples every Nth body segment and emits 2-3 small glowing orbs that
   * fly outward briefly — makes the food drop impossible to miss.
   */
  private spawnFoodBurstParticles(bodyPoints: Vec2[], snakeColor: string): void {
    const step = Math.max(1, Math.floor(bodyPoints.length / 12));
    const foodColors = ['#34d399', '#38bdf8', '#f472b6', '#fbbf24']; // S/M/L/Star
    for (let i = 0; i < bodyPoints.length; i += step) {
      const pt = bodyPoints[i];
      const count = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < count; j++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 100;
        this.particles.push({
          x: pt.x,
          y: pt.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 500 + Math.random() * 400,
          maxLife: 900,
          color: foodColors[Math.floor(Math.random() * foodColors.length)],
          size: 2 + Math.random() * 3,
        });
      }
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
      if (measured < 40) {
        if (acc.lowSince === 0) acc.lowSince = now;
        if (acc.highSince !== 0) acc.highSince = 0;
        if (now - acc.lowSince >= 2000 && !this.lowQuality) {
          this.lowQuality = true;
        }
      } else if (measured > 55) {
        if (acc.highSince === 0) acc.highSince = now;
        if (acc.lowSince !== 0) acc.lowSince = 0;
        if (now - acc.highSince >= 5000 && this.lowQuality) {
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
  // OfflineEngineRef bridge methods — satisfy the interface for sub-modules.
  // --------------------------------------------------------------------------

  showEndScreen(outcome: 'death' | 'extract'): void {
    showEndScreenFn(this, outcome);
  }

  enterReplayMode(): void {
    enterReplayModeFn(this);
  }

  exitReplayMode(): void {
    exitReplayModeFn(this);
  }

  // --------------------------------------------------------------------------
  // End-screen actions
  // --------------------------------------------------------------------------

  private handlePlayAgain(): void {
    if (this.endOverlay && this.endOverlay.parentNode) {
      this.endOverlay.parentNode.removeChild(this.endOverlay);
    }
    this.endOverlay = null;
    // Clear replay state
    this.replayPreBuffer = [];
    this.replayPreWriteIdx = 0;
    this.replayPostBuffer = [];
    this.isPostDeathRecording = false;
    this.postDeathTicksRemaining = 0;
    this.replayFrames = [];
    this.replayDeathFrameIdx = 0;
    this.exitReplayMode();
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

// ============================================================================
// Math helpers (used by multiple methods in this module)
// ============================================================================

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Random point within a circle of maxR around center. */
function randomPointInCircle(cx: number, cy: number, maxR: number): Vec2 {
  const r = Math.sqrt(Math.random()) * maxR;
  const theta = Math.random() * Math.PI * 2;
  return {
    x: cx + Math.cos(theta) * r,
    y: cy + Math.sin(theta) * r,
  };
}

function initialBody(headX: number, headY: number, angle: number, length: number, spacing: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < length; i++) {
    pts.push({
      x: headX - Math.cos(angle) * i * spacing,
      y: headY - Math.sin(angle) * i * spacing,
    });
  }
  return pts;
}

// ============================================================================
// Food orb helpers
// ============================================================================

/** Create a Food object at a random position around the player. */
function createFoodOrb(idPrefix: string, idCounter: { value: number }, cx: number, cy: number, farSpawn: boolean, foodOrbs?: FoodOrbDef[]): Food {
  const orb = randomFoodOrb(foodOrbs ?? getFoodOrbs(DEFAULT_SNAKE_CONFIG));
  const radius = farSpawn ? FOOD_SPAWN_RADIUS_FAR : FOOD_SPAWN_RADIUS_NEAR;
  const pos = randomPointInCircle(cx, cy, radius);
  return {
    id: `${idPrefix}-food-${idCounter.value++}`,
    x: pos.x,
    y: pos.y,
    size: orb.radius,
    value: orb.value,
    orbSize: orb.size,
    color: orb.color,
    glowColor: orb.glowColor,
  };
}

// ----------------------------------------------------------------------------
// Death food drop — use engine calcDeathFood + distribute along body
// ----------------------------------------------------------------------------

function computeDeathFoodDrop(
  totalScore: number,
  bodyPoints: Vec2[],
  idPrefix: string,
  idCounter: { value: number },
  foodOrbs: FoodOrbDef[],
): Food[] {
  const result: Food[] = [];
  if (!bodyPoints || bodyPoints.length === 0 || totalScore <= 0) return result;

  const [smallCount, mediumCount, largeCount] = calcDeathFood(totalScore, false);

  // Build orb sequence from food definitions
  const largeOrb = foodOrbs.find(o => o.size === 'large') ?? foodOrbs[0];
  const mediumOrb = foodOrbs.find(o => o.size === 'medium') ?? foodOrbs[0];
  const smallOrb = foodOrbs.find(o => o.size === 'small') ?? foodOrbs[0];

  const orbSequence: FoodOrbDef[] = [];
  for (let i = 0; i < largeCount; i++) orbSequence.push(largeOrb);
  for (let i = 0; i < mediumCount; i++) orbSequence.push(mediumOrb);
  for (let i = 0; i < smallCount; i++) orbSequence.push(smallOrb);

  // Shuffle
  for (let i = orbSequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orbSequence[i], orbSequence[j]] = [orbSequence[j], orbSequence[i]];
  }

  // Distribute orbs evenly along the body
  const totalOrbs = orbSequence.length;
  if (totalOrbs === 0) return result;
  const scatter = 15;
  let orbIdx = 0;
  for (const orb of orbSequence) {
    const segIdx = Math.min(bodyPoints.length - 1, Math.floor((orbIdx / totalOrbs) * bodyPoints.length));
    const pt = bodyPoints[segIdx];
    result.push({
      id: `${idPrefix}-death-${idCounter.value++}`,
      x: pt.x + (Math.random() - 0.5) * scatter,
      y: pt.y + (Math.random() - 0.5) * scatter,
      size: orb.radius,
      value: orb.value,
      orbSize: orb.size,
      color: orb.color,
      glowColor: orb.glowColor,
    });
    orbIdx++;
  }

  return result;
}

// Re-export types needed by consumers (game-canvas.tsx)
export type { OfflineState, OfflineExitResult } from './offline/offline-types';
