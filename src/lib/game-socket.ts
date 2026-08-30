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
  cc: number;        // carriedChips (only > 0 for real players)
  si?: string;       // skinId
  ra?: string;       // rarity
}

export interface RemoteFood {
  x: number;
  y: number;
  r: number;
  color: string;
  m: boolean;  // magnetized
}

export interface MinimapDot {
  x: number;
  y: number;
  score: number;
  isBot: boolean;
}

export interface RemoteStar {
  x: number;
  y: number;
  value: number;
  id: number;
  radius: number;   // visual radius (matches dead player's body width)
}

export interface GameSnapshot {
  tick: number;
  boundaryRadius: number;
  snakes: RemoteSnake[];
  foods: RemoteFood[];
  stars: RemoteStar[];
  playerScore: number;
  playerKills: number;
  playerCarriedChips: number;
  minimapDots: MinimapDot[];
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

  // Pre-allocated parse buffers (avoid GC from array creation every 50ms)
  const _parseFoods: RemoteFood[] = [];
  const _parseMinimap: MinimapDot[] = [];
  const _parseStars: RemoteStar[] = [];

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
    // Reuse pre-allocated arrays (avoid GC from 1500+ object creation every 50ms)
    const foods = _parseFoods;
    const fArr = raw.f;
    foods.length = 0;
    if (Array.isArray(fArr)) {
      for (let i = 0; i < fArr.length; i += 5) {
        foods.push({ x: fArr[i], y: fArr[i + 1], r: fArr[i + 2], color: fArr[i + 3], m: fArr[i + 4] === 1 });
      }
    }

    const minimapDots = _parseMinimap;
    const mArr = raw.m;
    minimapDots.length = 0;
    if (Array.isArray(mArr)) {
      for (let i = 0; i < mArr.length; i += 4) {
        minimapDots.push({ x: mArr[i], y: mArr[i + 1], score: mArr[i + 2], isBot: mArr[i + 3] === 1 });
      }
    }

    const stars = _parseStars;
    const stArr = raw.st;
    stars.length = 0;
    if (Array.isArray(stArr)) {
      for (let i = 0; i < stArr.length; i += 5) {
        stars.push({ x: stArr[i], y: stArr[i + 1], value: stArr[i + 2], id: stArr[i + 3], radius: stArr[i + 4] });
      }
    }

    return {
      tick: raw.t,
      boundaryRadius: raw.br,
      snakes: raw.s || [],
      foods,
      stars,
      playerScore: raw.ps,
      playerKills: raw.pk,
      playerCarriedChips: raw.pc || 0,
      minimapDots,
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
        // Ensure game server is running before connecting
        try {
          const ensureRes = await fetch('/api/game-server/ensure');
          if (!ensureRes.ok) {
            console.warn('[GameSocket] Game server ensure check failed:', ensureRes.status);
          }
        } catch {
          console.warn('[GameSocket] Game server ensure check failed — will attempt connection anyway');
        }

        socket = io('/?XTransformPort=3001', {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
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
