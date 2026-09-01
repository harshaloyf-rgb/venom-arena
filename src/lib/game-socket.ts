// ============================================================================
// Game Socket — Client-side Socket.IO connection for online multiplayer
// Connects to the player's regional game server for optimal latency.
// ============================================================================

import { io, Socket } from 'socket.io-client';
import { registerCustomSkinData } from '@/lib/snake/skin-registry';
import { generateCustomSegments } from '@/components/panels/cosmetics/cosmetics-utils';

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

export interface ExtractData {
  carriedChips: number;
  commission: number;
  bankedAmount: number;
  chipsEarned: number;
}

export interface GameSocketState {
  status: ConnectionStatus;
  snapshot: GameSnapshot | null;
  error: string | null;
  extractFailed: string | null;
  matchEnd: {
    outcome: string; score: number; kills: number; durationSeconds?: number; reason?: string;
    killerTag?: string | null; killerIsBot?: boolean; chipsLost?: number;
    carriedChips?: number; commission?: number; bankedAmount?: number; chipsEarned?: number;
  } | null;
  killerName: string | null;
  killerTag: string | null;
  killerIsBot: boolean;
  serverMapHalf: number | null;
}

// ─── Connection Manager ────────────────────────────────────────────────────

export function createGameSocket(onStateChange: (state: GameSocketState) => void) {
  let socket: Socket | null = null;
  let currentSnapshot: GameSnapshot | null = null;
  let currentStatus: ConnectionStatus = 'disconnected';
  let currentError: string | null = null;
  let matchEndData: {
    outcome: string; score: number; kills: number; durationSeconds?: number; reason?: string;
    killerTag?: string | null; killerIsBot?: boolean; chipsLost?: number;
    carriedChips?: number; commission?: number; bankedAmount?: number; chipsEarned?: number;
  } | null = null;
  let extractFailedReason: string | null = null;
  let killerName: string | null = null;
  let killerTag: string | null = null;
  let killerIsBot = true;
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
      extractFailed: extractFailedReason,
      matchEnd: matchEndData,
      killerName,
      killerTag,
      killerIsBot,
      serverMapHalf,
    });
    // One-shot: clear after emitting so consumer only sees it once
    extractFailedReason = null;
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
      extractFailedReason = null;
      killerName = null;
      killerTag = null;
      killerIsBot = true;
      currentSnapshot = null;
      serverMapHalf = null;
      inputSeq = 0;
      emit();

      try {
        // 1. Fetch the player's regional game server endpoint
        let gamePort = 3001; // fallback to default
        let playerRegion = 'UNKNOWN';
        try {
          const regionRes = await fetch('/api/player/region-server');
          if (regionRes.ok) {
            const data = await regionRes.json();
            if (data?.server?.port) {
              gamePort = data.server.port;
              playerRegion = data.region;
            }
          }
        } catch {
          console.warn('[GameSocket] Failed to fetch region-server, using default port 3001');
        }
        console.log(`[GameSocket] Connecting to region=${playerRegion} port=${gamePort}`);

        // 2. Ensure the regional game server is running
        let serverJustStarted = false;
        try {
          const ensureRes = await fetch(`/api/game-server/ensure?region=${playerRegion}`);
          if (!ensureRes.ok) {
            console.warn('[GameSocket] Game server ensure check failed:', ensureRes.status);
            // Fallback: try without region param (starts default server on 3001)
            await fetch('/api/game-server/ensure');
            gamePort = 3001;
          } else {
            const ensureData = await ensureRes.json();
            if (ensureData.port) gamePort = ensureData.port;
            if (ensureData.started) serverJustStarted = true;
          }
        } catch {
          console.warn('[GameSocket] Game server ensure check failed — will attempt connection anyway');
        }

        // 2b. If server was just spawned, wait for Socket.IO to fully initialize
        if (serverJustStarted) {
          console.log('[GameSocket] Server just started, waiting 2s for Socket.IO init...');
          await new Promise(r => setTimeout(r, 2000));
        }

        // 3. Connect Socket.IO to the regional game server
        socket = io(`/?XTransformPort=${gamePort}`, {
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
          socket!.emit('join', { arenaId });
        });

        socket.on('joined', (data: { snakeId: string; arenaId: string; config: { mapHalf: number } }) => {
          console.log('[GameSocket] Joined arena:', data.arenaId, 'as', data.snakeId);
          serverMapHalf = data.config?.mapHalf ?? null;
          emit();
        });

        socket.on('customSkin', (data: { snakeId: string; skinId: string; data: { id: string; colors: string[]; bodyStyle: string; taperStyle: string; glow: boolean } }) => {
          // Register remote player's custom skin so renderer can draw it
          try {
            const segments = generateCustomSegments(
              data.data.colors,
              data.data.bodyStyle as any,
              data.data.taperStyle as any,
              data.data.glow,
            );
            registerCustomSkinData(data.skinId, data.data.colors, segments);
          } catch (e) {
            console.warn('[GameSocket] Failed to register remote custom skin:', e);
          }
        });

        socket.on('snapshot', (raw: any) => {
          currentSnapshot = parseCompactSnapshot(raw);
          emit();
        });

        socket.on('killed', (data: { killerName: string; killerTag?: string | null; killerIsBot?: boolean }) => {
          killerName = data.killerName;
          killerTag = data.killerTag || null;
          killerIsBot = data.killerIsBot ?? true;
          emit();
        });

        socket.on('extractFailed', (data: { reason: string }) => {
          extractFailedReason = data.reason;
          emit();
        });

        socket.on('matchEnd', (data: { outcome: string; score: number; kills: number; durationSeconds?: number; reason?: string; killerTag?: string | null; killerIsBot?: boolean; chipsLost?: number; carriedChips?: number; commission?: number; bankedAmount?: number; chipsEarned?: number }) => {
          console.log('[GameSocket] matchEnd received:', JSON.stringify(data));
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
          // Transient — Socket.IO will auto-reconnect. Don't set error state.
          console.warn('[GameSocket] Connect error (reconnecting):', err.message);
        });

        socket.on('reconnect_failed', () => {
          console.error('[GameSocket] All reconnection attempts exhausted');
          currentError = 'Unable to connect to game server';
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

    sendExtract() {
      if (socket?.connected) {
        socket.emit('extract');
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
