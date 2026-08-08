/**
 * OnlineEngine — manages Socket.IO connection to game server,
 * receives 20Hz snapshots, forwards player input.
 *
 * Connection uses the gateway relay: io('/?XTransformPort=3001').
 * Auth token and arenaId are sent via Socket.IO handshake auth.
 * Server events use raw event names (snapshot, init, kill, respawned).
 * Client sends raw event names (input, respawn, setSkin).
 */

import { io, type Socket } from 'socket.io-client';
import type { ArenaSnapshot } from '@/lib/snake/types';

// ─── Connection states ──────────────────────────────────────────────────────

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'reconnecting';

// ─── Kill feed entry ─────────────────────────────────────────────────────────

export interface KillFeedEntry {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  score: number;
  timestamp: number;
}

// ─── OnlineEngine ────────────────────────────────────────────────────────────

export class OnlineEngine {
  private socket: Socket | null = null;
  private _lastSnapshot: ArenaSnapshot | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private inputBuffer: { targetAngle: number; boosting: boolean } = {
    targetAngle: 0,
    boosting: false,
  };
  private inputDirty = false;
  private lastInputSend = 0;
  private readonly INPUT_SEND_INTERVAL_MS = 33; // ~30Hz input rate (matches server tick)

  // Callbacks (set by consumer)
  public onSnapshot: ((snapshot: ArenaSnapshot) => void) | null = null;
  public onKill: ((entry: KillFeedEntry) => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public onConnectionChange: ((state: ConnectionState) => void) | null = null;
  public onPlayerDied: (() => void) | null = null;
  public onInit: ((data: { snakeId: string; arenaId: string }) => void) | null = null;

  // Track our snake ID (sent by server in 'init' event)
  private _mySnakeId: string | null = null;

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /** Connect to the game server for a specific arena. */
  connect(
    arenaId: string,
    token: string,
    skinId: string,
    playerName: string = 'Player',
    bodyColor: string = '',
    headColor: string = '',
    rarity: string = 'common',
  ): void {
    this.setConnectionState('connecting');

    // Gateway relay: relative path with port in query
    // Auth token, arenaId, player name, and skin sent via Socket.IO handshake auth
    this.socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        token,
        arenaId,
        playerName,
        skinId,
        bodyColor,
        headColor,
        rarity,
      },
    });

    // ── Socket event handlers (raw event names matching server protocol) ──

    this.socket.on('connect', () => {
      this.setConnectionState('connected');
    });

    // Server sends 'init' with our snake ID and arena info
    this.socket.on('init', (data: { snakeId: string; arenaId: string; tickRate: number; broadcastRate: number }) => {
      this._mySnakeId = data.snakeId;
      console.log('[OnlineEngine] Initialized:', data);
      this.onInit?.({ snakeId: data.snakeId, arenaId: data.arenaId });
    });

    // Server sends 'snapshot' at 20Hz with full arena state
    this.socket.on('snapshot', (data: unknown) => {
      const snapshot = data as ArenaSnapshot;
      this._lastSnapshot = snapshot;
      this.onSnapshot?.(snapshot);
    });

    // Server sends 'kill' when a kill event occurs
    this.socket.on('kill', (data: { killer: string; killerName: string; victim: string; victimName: string; score: number }) => {
      const entry: KillFeedEntry = {
        killerId: data.killer,
        killerName: data.killerName,
        victimId: data.victim,
        victimName: data.victimName,
        score: data.score,
        timestamp: Date.now(),
      };
      this.onKill?.(entry);

      // If we are the victim, notify death
      if (data.victim === this._mySnakeId) {
        this.onPlayerDied?.();
      }
    });

    // Server sends 'respawned' after successful respawn
    this.socket.on('respawned', (data: { snakeId: string }) => {
      this._mySnakeId = data.snakeId;
      console.log('[OnlineEngine] Respawned:', data);
      this.onInit?.({ snakeId: data.snakeId, arenaId: '' });
    });

    this.socket.on('disconnect', (reason) => {
      this.setConnectionState('disconnected');
      // Auto-reconnect is handled by socket.io
    });

    this.socket.on('connect_error', (err) => {
      this.setConnectionState('error');
      this.onError?.(err.message || 'Connection failed');
    });
  }

  /** Disconnect from the server. */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this._lastSnapshot = null;
    this._mySnakeId = null;
    this.setConnectionState('disconnected');
  }

  // ── Input forwarding ───────────────────────────────────────────────────────

  /** Update player input (called every frame from the game loop). */
  setInput(targetAngle: number, boosting: boolean): void {
    this.inputBuffer.targetAngle = targetAngle;
    this.inputBuffer.boosting = boosting;
    this.inputDirty = true;

    // Throttle input sends to INPUT_SEND_INTERVAL_MS
    const now = performance.now();
    if (this.inputDirty && now - this.lastInputSend >= this.INPUT_SEND_INTERVAL_MS) {
      this.flushInput();
    }
  }

  /** Force-send any buffered input immediately. */
  private flushInput(): void {
    if (!this.socket?.connected) return;
    // Server listens for raw 'input' event
    this.socket.emit('input', {
      targetAngle: this.inputBuffer.targetAngle,
      boosting: this.inputBuffer.boosting,
    });
    this.inputDirty = false;
    this.lastInputSend = performance.now();
  }

  /** Request respawn after death. */
  requestRespawn(): void {
    if (!this.socket?.connected) return;
    // Server listens for raw 'respawn' event
    this.socket.emit('respawn');
  }

  // ── Snapshot access ────────────────────────────────────────────────────────

  /** Get the latest snapshot received from the server. */
  getSnapshot(): ArenaSnapshot | null {
    return this._lastSnapshot;
  }

  /** Whether the engine has received at least one snapshot. */
  get hasSnapshot(): boolean {
    return this._lastSnapshot !== null;
  }

  // ── Connection state ───────────────────────────────────────────────────────

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  /** The snake ID assigned by the server for this player. */
  get mySnakeId(): string | null {
    return this._mySnakeId;
  }

  // ── Private: Connection state setter ───────────────────────────────────────

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.onConnectionChange?.(state);
  }
}
