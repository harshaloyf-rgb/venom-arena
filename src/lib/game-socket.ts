// ============================================================================
// Game Socket — Client-side Socket.IO connection for online multiplayer
// ============================================================================

import { io, Socket } from 'socket.io-client';

// ─── Snapshot Types (compact format — shortened keys for bandwidth) ────────

export interface RemoteSnake {
  id: string;
  name: string;
  hx: number;
  hy: number;
  angle: number;
  score: number;
  color: string;
  sc: string;        // secondaryColor (shortened)
  ip: boolean;       // isPlayer
  ib: boolean;       // isBot
  bl: number;        // bodyLen
  br: number;        // bodyRadius
  bo: boolean;       // boosting
  si?: string;       // skinId (player only)
  ra?: string;       // rarity (player only)
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
}

// ─── Hook State ─────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

export interface GameSocketState {
  status: ConnectionStatus;
  snapshot: GameSnapshot | null;
  error: string | null;
  matchEnd: { outcome: string; score: number; kills: number } | null;
  killerName: string | null;
  serverMapHalf: number | null;
}

// ─── Connection Manager ────────────────────────────────────────────────────

export function createGameSocket(onStateChange: (state: GameSocketState) => void) {
  let socket: Socket | null = null;
  let currentSnapshot: GameSnapshot | null = null;
  let currentStatus: ConnectionStatus = 'disconnected';
  let currentError: string | null = null;
  let matchEndData: { outcome: string; score: number; kills: number } | null = null;
  let killerName: string | null = null;
  let serverMapHalf: number | null = null;
  let inputSeq = 0;

  function emit() {
    onStateChange({
      status: currentStatus,
      snapshot: currentSnapshot,
      error: currentError,
      matchEnd: matchEndData,
      killerName,
      serverMapHalf,
    });
  }

  function parseCompactSnapshot(raw: any): GameSnapshot {
    // Handle compact format: { t, br, s, f, ps, pk }
    // where f is a flat array [x, y, r, color, x, y, r, color, ...]
    const foods: RemoteFood[] = [];
    const fArr = raw.f;
    if (Array.isArray(fArr)) {
      for (let i = 0; i < fArr.length; i += 4) {
        foods.push({ x: fArr[i], y: fArr[i + 1], r: fArr[i + 2], color: fArr[i + 3] });
      }
    }

    return {
      tick: raw.t,
      boundaryRadius: raw.br,
      snakes: raw.s || [],
      foods,
      playerScore: raw.ps,
      playerKills: raw.pk,
    };
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
      serverMapHalf = null;
      inputSeq = 0;
      emit();

      try {
        socket = io('/', {
          auth: { token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 10000,
          query: { XTransformPort: '3001' },
        });

        socket.on('connect', () => {
          currentStatus = 'connected';
          emit();
          // Join arena
          socket!.emit('join', { arenaId });
        });

        socket.on('joined', (data: { snakeId: string; arenaId: string; config: { mapHalf: number } }) => {
          console.log('[GameSocket] Joined arena:', data.arenaId, 'as', data.snakeId);
          serverMapHalf = data.config?.mapHalf ?? null;
          emit();
        });

        socket.on('snapshot', (raw: any) => {
          currentSnapshot = parseCompactSnapshot(raw);
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
          console.log('[GameSocket] Disconnected:', reason, '— transport:', socket.io?.engine?.transport?.name);
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
        inputSeq++;
        socket.emit('input', { angle, boost, seq: inputSeq });
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
