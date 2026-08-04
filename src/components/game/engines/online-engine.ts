'use client';

import { io, Socket } from 'socket.io-client';
import type {
  Vec2, SnakeSnapshot, FoodOrb, StarChip, MapState,
  KillFeedEntry, GameSnapshot, InputState, SnakeIdentity,
  EndScreenState, HUDState, DeathEvent, KillCause,
  ReplayFrame, ReplayState, Particle, SnakeState,
} from '@/lib/snake/types';
import { DEFAULT_SNAKE_CONFIG, type SnakeConfig } from '@/lib/snake/config';
import { PathBuffer } from '@/lib/snake/pool';
import { ExtrapolationEngine, type ExtrapolatedSnake } from './extrapolation';

// ── Online Engine ────────────────────────────────────────────────────────────
// Handles all communication with the game server.
// Receives GameSnapshot at 20Hz, sends player input.
// Manages: connection, auth, arena join, replay, ping, reconnection.
// ─────────────────────────────────────────────────────────────────────────────

export class OnlineEngine {
  // Socket
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Arena
  readonly arenaId: string;
  readonly arenaName: string;
  readonly isPractice: boolean;
  readonly rewardMultiplier: number;
  readonly config: SnakeConfig;

  // Player identity
  readonly playerId: string;
  readonly playerIdentity: SnakeIdentity;

  // Latest snapshot from server
  latestSnapshot: GameSnapshot | null = null;

  // Extrapolated player state for smooth rendering
  playerState: SnakeState | null = null;

  // Map state
  map: MapState;

  // Kill feed (accumulated from snapshots + server events)
  killFeed: KillFeedEntry[] = [];

  // Particles (client-side only)
  particles: Particle[] = [];

  // HUD data
  hud: HUDState;

  // Ping
  private lastPingTime = 0;
  private pingSmoothing = 0.3;

  // Phase
  phase: 'connecting' | 'playing' | 'ended' = 'connecting';
  endState: EndScreenState | null = null;
  deathEvent: DeathEvent | null = null;

  // Match timing
  matchStartTime = 0;
  matchDurationSeconds = 0;

  // Replay buffer (circular, 300 frames at 20Hz = 15s before + 15s after)
  private replayBuffer: ReplayFrame[] = [];
  private replayWriteIdx = 0;
  private replayTotalFrames = 0;
  private replayDeathOccurred = false;
  private replayDeathIdx = -1;
  private readonly REPLAY_BUFFER_SIZE = 600; // 30s at 20Hz

  // Reconnection
  private disconnectTime = 0;
  private wasPlayingBeforeDisconnect = false;

  // Commission
  commissionRate = 0;
  realPlayerCount = 0;
  starsInArena = 0;

  // Extrapolation engine (created on connect)
  extrapolation: ExtrapolationEngine | null = null;

  // Last snapshot timestamp
  private lastSnapshotTime: number = 0;

  // Callbacks
  onPhaseChange?: (phase: 'connecting' | 'playing' | 'ended') => void;
  onDeath?: (endState: EndScreenState) => void;
  onKillFeed?: (entry: KillFeedEntry) => void;
  onReconnect?: () => void;
  onError?: (msg: string) => void;

  // Input send throttle (don't send every frame, server doesn't need it)
  private lastInputSend = 0;
  private readonly INPUT_SEND_INTERVAL = 50; // 20Hz = 50ms

  constructor(
    playerIdentity: SnakeIdentity,
    arenaId: string,
    arenaName: string,
    isPractice: boolean,
    rewardMultiplier: number,
    configOverrides?: Partial<SnakeConfig>,
  ) {
    this.playerIdentity = playerIdentity;
    this.playerId = playerIdentity.id;
    this.arenaId = arenaId;
    this.arenaName = arenaName;
    this.isPractice = isPractice;
    this.rewardMultiplier = rewardMultiplier;
    this.config = { ...DEFAULT_SNAKE_CONFIG, ...configOverrides };

    this.map = {
      type: isPractice ? 'infinite' : 'circular_breathing',
      center: { x: 4000, y: 4000 },
      currentRadius: this.config.mapRadius,
      baseRadius: this.config.mapRadius,
      breathingAmplitude: this.config.breathingAmplitude,
      breathingPeriod: this.config.breathingPeriodSeconds,
      breathingPhase: 0,
    };

    this.hud = {
      fps: 60, ping: 0, lowQuality: false,
      showMinimap: false, showFullMap: false,
      score: 0, kills: 0, rank: 1,
      carriedChips: 0, starsEarned: 0, starsInArena: 0,
      bankedChips: 0, realPlayerCount: 0, botCount: 0,
      commissionRate: 0, rewardMultiplier, arenaName,
      isOffline: isPractice,
    };

    this.matchStartTime = Date.now();
  }

  // ── Connection Lifecycle ──────────────────────────────────────────────────

  /** Connect to the game server and join arena */
  async connect(authToken: string): Promise<void> {
    this.setPhase('connecting');

    // Create extrapolation engine on connect
    this.extrapolation = new ExtrapolationEngine(this.config);

    try {
      this.socket = io('/?XTransformPort=3001', {
        transports: ['websocket', 'polling'],
        auth: { token: authToken },
        reconnection: false, // We handle reconnection ourselves
        timeout: 10000,
      });

      this.setupSocketHandlers();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Join arena
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Arena join timeout'));
        }, 10000);

        this.socket!.emit('join_arena', {
          arenaId: this.arenaId,
          identity: this.playerIdentity,
        });

        this.socket!.once('arena_joined', (data: { mapRadius: number; commissionRate: number; playerCount: number }) => {
          clearTimeout(timeout);
          this.map.baseRadius = data.mapRadius;
          this.map.currentRadius = data.mapRadius;
          this.commissionRate = data.commissionRate;
          this.realPlayerCount = data.playerCount;
          this.hud.commissionRate = data.commissionRate;
          this.setPhase('playing');
          this.matchStartTime = Date.now();
          resolve();
        });

        this.socket!.once('arena_error', (data: { code: string; message: string }) => {
          clearTimeout(timeout);
          reject(new Error(data.message || data.code));
        });
      });

      // Start ping measurement
      this.startPingLoop();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.onError?.(msg);
      this.setPhase('ended');
      this.endState = {
        outcome: 'death',
        kills: 0, score: 0, xpGained: 0,
        durationSeconds: 0, isOffline: this.isPractice,
        arenaName: this.arenaName,
      };
      this.onDeath?.(this.endState!);
    }
  }

  private setupSocketHandlers() {
    if (!this.socket) return;
    const s = this.socket;

    // Main snapshot at 20Hz
    s.on('snapshot', (snapshot: GameSnapshot) => {
      this.latestSnapshot = snapshot;
      this.processSnapshot(snapshot);
    });

    // Kill feed events (real-time, not just in snapshots)
    s.on('kill_feed', (entry: KillFeedEntry) => {
      this.killFeed.push(entry);
      this.onKillFeed?.(entry);
    });

    // Player death
    s.on('player_died', (data: {
      killerId: string | null;
      killerName: string | null;
      killerTag: string | null;
      killerIsBot: boolean;
      cause: KillCause;
      score: number;
      kills: number;
      carriedChips: number;
    }) => {
      this.handlePlayerDeath(data);
    });

    // Extraction complete
    s.on('extraction_complete', (data: {
      chipsExtracted: number;
      commission: number;
      bankedAmount: number;
      xpGained: number;
      newLevel: number;
      newBankedChips: number;
      score: number;
      kills: number;
      durationSeconds: number;
    }) => {
      this.handleExtractionComplete(data);
    });

    // Emote from another player
    s.on('emote', (data: { playerId: string; emote: string; frames: number }) => {
      // Handled via snapshot — emote data is in SnakeSnapshot
    });

    // Disconnection
    s.on('disconnect', () => {
      if (this.phase === 'playing') {
        this.wasPlayingBeforeDisconnect = true;
        this.disconnectTime = Date.now();
        // Show reconnecting overlay
        this.onPhaseChange?.('connecting');
      }
    });
  }

  // ── Snapshot Processing ──────────────────────────────────────────────────

  private processSnapshot(snapshot: GameSnapshot) {
    const now = Date.now();
    this.lastSnapshotTime = now;

    // Update map
    this.map.currentRadius = snapshot.map.currentRadius;
    this.starsInArena = snapshot.starsInArena;
    this.realPlayerCount = snapshot.realPlayerCount;

    // Update HUD
    this.hud.ping = this.getLatestPing();
    this.hud.realPlayerCount = snapshot.realPlayerCount;
    this.hud.botCount = snapshot.botCount;
    this.hud.rank = snapshot.playerRank;
    this.hud.starsInArena = snapshot.starsInArena;

    // Feed all snakes into extrapolation engine
    if (this.extrapolation) {
      const snapIds = new Set<string>();
      for (const snap of snapshot.snakes) {
        snapIds.add(snap.id);
        this.extrapolation.processSnapshot(snap, now);
      }

      // Remove snakes that left the snapshot (clean up)
      // We check lazily — only remove if they existed before but not now
      // Since we don't iterate all extrapolated snakes every frame,
      // stale snakes will simply stop being extrapolated (alive=false in snapshot)
    }

    // Find player in snapshot
    const playerSnap = snapshot.snakes.find(s => s.isPlayer);
    if (playerSnap) {
      this.hud.score = playerSnap.score;
      this.hud.kills = playerSnap.kills;
      this.hud.carriedChips = playerSnap.carriedChips;

      // Extrapolate player state from snapshot for rendering
      this.playerState = this.snapshotToSnakeState(playerSnap);

      // Extraction progress
      if (snapshot.playerExtractProgress !== null) {
        this.hud.carriedChips = playerSnap.carriedChips;
      }
    }

    // Record replay frame
    this.recordReplayFrame(snapshot);

    // Clean old kill feed (older than 5s)
    this.killFeed = this.killFeed.filter(e => now - e.timestamp < 5000);
  }

  /** Advance extrapolation by dt seconds. Call from render loop. */
  extrapolate(dt: number): void {
    if (this.extrapolation && this.phase === 'playing') {
      this.extrapolation.tick(dt);
    }
  }

  /** Convert a SnakeSnapshot back to a minimal SnakeState for rendering */
  private snapshotToSnakeState(snap: SnakeSnapshot): SnakeState {
    const maxPts = Math.ceil((snap.score * this.config.ptsPerSegment) / this.config.segSpacing) + 200;
    const pathBuffer = new PathBuffer(maxPts);

    const pathLen = snap.path.length;
    for (let i = pathLen - 1; i >= 0; i--) {
      const p = snap.path[i];
      let angle = snap.angle;
      if (i < pathLen - 1) {
        const next = snap.path[i + 1];
        angle = Math.atan2(next.y - p.y, next.x - p.x);
      }
      pathBuffer.prepend(p.x, p.y, angle);
    }

    // If no path points, create a minimal one
    if (pathLen === 0) {
      pathBuffer.prepend(0, 0, snap.angle);
    }

    return {
      identity: {
        id: snap.id,
        name: snap.name,
        tag: snap.tag,
        isBot: snap.isBot,
        isPlayer: snap.isPlayer,
        skinId: snap.skinId,
        skinPattern: snap.skinPattern,
        bodyStyle: snap.bodyStyle,
        taperStyle: snap.taperStyle,
        hat: snap.hat,
        shape: snap.shape,
        primaryColor: snap.primaryColor,
        secondaryColor: snap.secondaryColor,
        trailId: '',
        deathBurstId: '',
        skinRarity: snap.skinRarity,
      },
      head: snap.path[0] || { x: 0, y: 0 },
      angle: snap.angle,
      targetAngle: snap.angle,
      path: pathBuffer,
      score: snap.score,
      boosting: snap.boosting,
      alive: snap.alive,
      spawnProtected: snap.spawnProtected,
      spawnProtectionFrames: 0,
      carriedChips: snap.carriedChips,
      starsCollected: 0,
      kills: snap.kills,
      extractProgress: 0,
      isExtracting: false,
      extractFramesLeft: 0,
      extractStartAngle: 0,
      activeEmote: snap.activeEmote,
      emoteFramesLeft: snap.emoteFramesLeft,
      ping: this.hud.ping,
      commissionRate: this.commissionRate,
      spiral: null,
      _cachedVisualRadius: snap.visualRadius,
      _cachedCollisionRadius: snap.visualRadius * 0.85,
    };
  }

  // ── Input Sending ────────────────────────────────────────────────────────

  /** Call every frame from render loop. Throttled to 20Hz internally. */
  sendInput(input: InputState) {
    if (!this.socket?.connected || this.phase !== 'playing') return;

    const now = performance.now();
    if (now - this.lastInputSend < this.INPUT_SEND_INTERVAL) return;
    this.lastInputSend = now;

    this.socket.emit('input', {
      angle: input.targetAngle,
      boosting: input.boosting,
      extracting: input.extracting,
    });
  }

  /** Send emote to server */
  sendEmote(emoteKey: number) {
    if (!this.socket?.connected || this.phase !== 'playing') return;
    const emoteMap: Record<number, string> = { 1: 'gg', 2: 'target', 3: 'flee', 4: 'ripped', 5: 'extracting' };
    const emote = emoteMap[emoteKey];
    if (emote) {
      this.socket.emit('emote', { emote });
    }
  }

  // ── Ping Measurement ─────────────────────────────────────────────────────

  private pingSamples: number[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private startPingLoop() {
    this.pingInterval = setInterval(() => {
      if (!this.socket?.connected) return;
      this.lastPingTime = performance.now();
      this.socket.emit('ping');
    }, 2000);
  }

  /** Call this when receiving 'pong' from server */
  handlePong() {
    const rtt = performance.now() - this.lastPingTime;
    if (rtt > 0 && rtt < 2000) {
      this.pingSamples.push(rtt);
      if (this.pingSamples.length > 5) this.pingSamples.shift();
      this.hud.ping = Math.round(
        this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length
      );
    }
  }

  getLatestPing(): number {
    return this.hud.ping;
  }

  // ── Death Handling ───────────────────────────────────────────────────────

  private handlePlayerDeath(data: {
    killerId: string | null;
    killerName: string | null;
    killerTag: string | null;
    killerIsBot: boolean;
    cause: KillCause;
    score: number;
    kills: number;
    carriedChips: number;
  }) {
    this.matchDurationSeconds = Math.floor((Date.now() - this.matchStartTime) / 1000);
    this.replayDeathOccurred = true;
    this.replayDeathIdx = this.replayWriteIdx;

    this.endState = {
      outcome: 'death',
      killerName: data.killerName ?? undefined,
      killerTag: data.killerTag ?? undefined,
      killerIsBot: data.killerIsBot,
      kills: data.kills,
      score: data.score,
      xpGained: 0, // No XP on death
      durationSeconds: this.matchDurationSeconds,
      isOffline: this.isPractice,
      arenaName: this.arenaName,
    };

    // Continue recording replay for 15s after death
    setTimeout(() => {
      this.setPhase('ended');
      this.onDeath?.(this.endState!);
    }, 3000); // 3s death vignette before showing end screen
  }

  // ── Extraction Handling ──────────────────────────────────────────────────

  private handleExtractionComplete(data: {
    chipsExtracted: number;
    commission: number;
    bankedAmount: number;
    xpGained: number;
    newLevel: number;
    newBankedChips: number;
    score: number;
    kills: number;
    durationSeconds: number;
  }) {
    this.matchDurationSeconds = data.durationSeconds;

    this.endState = {
      outcome: 'extract',
      chipsExtracted: data.chipsExtracted,
      commission: data.commission,
      bankedAmount: data.bankedAmount,
      kills: data.kills,
      score: data.score,
      xpGained: data.xpGained,
      durationSeconds: this.matchDurationSeconds,
      isOffline: this.isPractice,
      arenaName: this.arenaName,
    };

    this.setPhase('ended');
    this.onDeath?.(this.endState!);
  }

  // ── Replay Recording ─────────────────────────────────────────────────────

  private recordReplayFrame(snapshot: GameSnapshot) {
    const playerSnap = snapshot.snakes.find(s => s.isPlayer);
    const others = snapshot.snakes.filter(s => !s.isPlayer);

    const frame: ReplayFrame = {
      player: playerSnap!,
      snakes: others,
      food: snapshot.food,
      stars: snapshot.stars,
      killFeed: [...this.killFeed],
      isDeathFrame: false,
    };

    // Check if this is the death frame
    if (playerSnap && !playerSnap.alive && !this.replayDeathOccurred) {
      frame.isDeathFrame = true;
    }

    // Write to circular buffer
    if (this.replayBuffer.length < this.REPLAY_BUFFER_SIZE) {
      this.replayBuffer.push(frame);
    } else {
      this.replayBuffer[this.replayWriteIdx] = frame;
    }
    this.replayWriteIdx = (this.replayWriteIdx + 1) % this.REPLAY_BUFFER_SIZE;
    this.replayTotalFrames++;
  }

  /** Get replay state for playback */
  getReplayState(): ReplayState {
    return {
      frames: this.replayBuffer,
      writeIndex: this.replayWriteIdx,
      totalFrames: this.replayTotalFrames,
      deathOccurred: this.replayDeathOccurred,
      deathFrameIndex: this.replayDeathIdx,
      playing: false,
      currentFrame: 0,
      speed: 1,
      duration: this.REPLAY_BUFFER_SIZE,
    };
  }

  // ── Reconnection ─────────────────────────────────────────────────────────

  /** Attempt to reconnect. Returns true if reconnection was initiated. */
  async attemptReconnect(authToken: string): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return false;

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    await new Promise(r => setTimeout(r, delay));

    try {
      this.socket?.disconnect();
      await this.connect(authToken);
      this.reconnectAttempts = 0;
      this.onReconnect?.();
      return true;
    } catch {
      return false;
    }
  }

  // ── Kill Feed Access (for renderer) ──────────────────────────────────────

  getKillFeed(): KillFeedEntry[] {
    return this.killFeed;
  }

  // ── Leaderboard (from latest snapshot) ───────────────────────────────────

  getLeaderboard() {
    if (!this.latestSnapshot) return [];
    // Server sends top 10 real players by carriedChips
    return this.latestSnapshot.snakes
      .filter(s => !s.isBot && s.alive)
      .sort((a, b) => b.carriedChips - a.carriedChips)
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        name: s.name,
        tag: s.tag,
        isBot: false,
        score: s.score,
        kills: s.kills,
        isPlayer: s.isPlayer,
      }));
  }

  getPlayerRank(): number {
    if (!this.latestSnapshot) return 1;
    return this.latestSnapshot.playerRank;
  }

  // ── Phase Management ─────────────────────────────────────────────────────

  private setPhase(phase: 'connecting' | 'playing' | 'ended') {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }

  // ── Particles (client-side only) ─────────────────────────────────────────

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  addParticle(x: number, y: number, color: string, count: number = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 30 + Math.random() * 30,
        maxLife: 60,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  // ── Get snakes for rendering (from extrapolation or snapshot) ────────────

  /** Get all snake states for rendering. Uses extrapolation engine when available. */
  getRenderableSnakes(): SnakeState[] {
    // Prefer extrapolation engine for smooth 60fps rendering
    if (this.extrapolation) {
      const extrapolated = this.extrapolation.getAllSnakes();
      if (extrapolated.length > 0) {
        return extrapolated.map(es => this.extrapolatedToSnakeState(es));
      }
    }

    // Fallback: convert from latest snapshot
    if (!this.latestSnapshot) return [];
    return this.latestSnapshot.snakes.map(snap => this.snapshotToSnakeState(snap));
  }

  /** Convert an ExtrapolatedSnake to a renderable SnakeState */
  private extrapolatedToSnakeState(es: ExtrapolatedSnake): SnakeState {
    return {
      identity: es.identity,
      head: { x: es.headX, y: es.headY },
      angle: es.angle,
      targetAngle: es.targetAngle,
      path: es.path,
      score: es.score,
      boosting: es.boosting,
      alive: es.alive,
      spawnProtected: es.spawnProtected,
      spawnProtectionFrames: 0,
      carriedChips: es.carriedChips,
      starsCollected: 0,
      kills: es.kills,
      extractProgress: 0,
      isExtracting: false,
      extractFramesLeft: 0,
      extractStartAngle: 0,
      activeEmote: es.activeEmote as import('@/lib/snake/types').EmoteType | null,
      emoteFramesLeft: es.emoteFramesLeft,
      ping: 0,
      commissionRate: this.commissionRate,
      spiral: null,
      _cachedVisualRadius: es.visualRadius,
      _cachedCollisionRadius: es.visualRadius * 0.85,
    };
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.extrapolation?.clear();
    this.extrapolation = null;
    this.setPhase('ended');
    this.latestSnapshot = null;
    this.playerState = null;
    this.killFeed = [];
    this.particles = [];
    this.replayBuffer = [];
  }
}
