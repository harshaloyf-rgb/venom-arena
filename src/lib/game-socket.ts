// ============================================================================
// Game Socket — Client-side Socket.IO connection for online multiplayer
// ============================================================================

import { io, Socket } from 'socket.io-client';

// ─── Snapshot Types (matching server protocol) ─────────────────────────────

export interface RemoteSnake {
  id: string;
  name: string;
  hx: number;
  hy: number;
  angle: number;
  score: number;
  alive: boolean;
  color: string;
  secondaryColor: string;
  isPlayer: boolean;
  isBot: boolean;
  bodyLen: number;
  bodyRadius: number;
  boosting: boolean;
  skinId?: string;
  rarity?: string;
}

export interface RemoteFood {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface GameSnapshot {
  tick: number;
  boundaryRadius: number;
  snakes: RemoteSnake[];
  foods: RemoteFood[];
  playerScore: number;
  playerKills: number;
  playerX: number;
  playerY: number;
  playerAngle: number;
  playerBoosting: boolean;
  playerAlive: boolean;
}

// ─── Hook State ─────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

export interface GameSocketState {
  status: ConnectionStatus;
  snapshot: GameSnapshot | null;
  error: string | null;
  matchEnd: { outcome: string; score: number; kills: number } | null;
  killerName: string | null;
}

// ─── Connection Manager ────────────────────────────────────────────────────

export function createGameSocket(onStateChange: (state: GameSocketState) => void) {
  let socket: Socket | null = null;
  let currentSnapshot: GameSnapshot | null = null;
  let currentStatus: ConnectionStatus = 'disconnected';
  let currentError: string | null = null;
  let matchEndData: { outcome: string; score: number; kills: number } | null = null;
  let killerName: string | null = null;

  function emit() {
    onStateChange({
      status: currentStatus,
      snapshot: currentSnapshot,
      error: currentError,
      matchEnd: matchEndData,
      killerName,
    });
  }

  return {
    get snapshot() { return currentSnapshot; },
    get status() { return currentStatus; },

    async connect(token: string, arenaId: string) {
      currentStatus = 'connecting';
      currentError = null;
      matchEndData = null;
      killerName = null;
      currentSnapshot = null;
      emit();

      try {
        socket = io('/?XTransformPort=3001', {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: false,
          timeout: 10000,
        });

        socket.on('connect', () => {
          currentStatus = 'connected';
          emit();
          // Join arena
          socket!.emit('join', { arenaId });
        });

        socket.on('joined', (data: { snakeId: string; arenaId: string; config: { mapHalf: number } }) => {
          console.log('[GameSocket] Joined arena:', data.arenaId, 'as', data.snakeId);
        });

        socket.on('snapshot', (snap: GameSnapshot) => {
          currentSnapshot = snap;
          emit();
        });

        socket.on('killed', (data: { killerName: string }) => {
          killerName = data.killerName;
          emit();
        });

        socket.on('matchEnd', (data: { outcome: string; score: number; kills: number }) => {
          matchEndData = data;
          emit();
        });

        socket.on('error', (data: { message: string }) => {
          currentError = data.message;
          currentStatus = 'error';
          emit();
        });

        socket.on('disconnect', (reason) => {
          console.log('[GameSocket] Disconnected:', reason);
          currentStatus = 'disconnected';
          emit();
        });

        socket.on('connect_error', (err) => {
          console.error('[GameSocket] Connect error:', err.message);
          currentError = err.message;
          currentStatus = 'error';
          emit();
        });
      } catch (err: any) {
        currentError = err.message || 'Failed to connect';
        currentStatus = 'error';
        emit();
      }
    },

    sendInput(angle: number, boost: boolean) {
      if (socket?.connected) {
        socket.emit('input', { angle, boost });
      }
    },

    disconnect() {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      currentStatus = 'disconnected';
      currentSnapshot = null;
      emit();
    },
  };
}
