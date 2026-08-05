/**
 * OnlineEngine — manages Socket.IO connection to game server,
 * receives 20Hz snapshots, forwards player input.
 *
 * Connection uses the gateway relay: io('/?XTransformPort=3001').
 * All events follow the structured { event, data } envelope.
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
  private readonly INPUT_SEND_INTERVAL_MS = 50; // 20Hz input rate

  // Callbacks (set by consumer)
  public onSnapshot: ((snapshot: ArenaSnapshot) => void) | null = null;
  public onKill: ((entry: KillFeedEntry) => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public onConnectionChange: ((state: ConnectionState) => void) | null = null;
  public onPlayerDied: (() => void) | null = null;

  // ── Connection lifecycle ───────────────────────────────────────────────────

  /** Connect to the game server for a specific arena. */
  connect(arenaId: string, token: string, skinId: string): void {
    this.setConnectionState('connecting');

    // Gateway relay: relative path with port in query
    this.socket = io('/?XTransformPort=3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // ── Socket event handlers ──

    this.socket.on('connect', () => {
      this.setConnectionState('connected');
      // Send join request
      this.socket!.emit('event', {
        event: 'join',
        data: { token, arenaId, skinId },
      });
    });

    this.socket.on('event', (payload: { event: string; data: unknown }) => {
      this.handleServerEvent(payload.event, payload.data);
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
    this.socket.emit('event', {
      event: 'input',
      data: {
        targetAngle: this.inputBuffer.targetAngle,
        boosting: this.inputBuffer.boosting,
      },
    });
    this.inputDirty = false;
    this.lastInputSend = performance.now();
  }

  /** Request respawn after death. */
  requestRespawn(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('event', {
      event: 'respawn',
      data: {},
    });
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

  // ── Private: Server event handler ──────────────────────────────────────────

  private handleServerEvent(event: string, data: unknown): void {
    switch (event) {
      case 'snapshot': {
        const snapshot = data as ArenaSnapshot;
        this._lastSnapshot = snapshot;
        this.onSnapshot?.(snapshot);
        break;
      }

      case 'kill': {
        const entry = data as KillFeedEntry;
        this.onKill?.(entry);
        break;
      }

      case 'player-died': {
        this.onPlayerDied?.();
        break;
      }

      case 'error': {
        const msg = (data as { message: string }).message || 'Unknown server error';
        this.onError?.(msg);
        break;
      }

      default:
        // Ignore unknown events
        break;
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState === state) return;
    this._connectionState = state;
    this.onConnectionChange?.(state);
  }
}
