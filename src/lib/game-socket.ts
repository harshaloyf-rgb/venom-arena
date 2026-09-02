// ============================================================================
// Game Socket — Raw WebSocket client with binary protocol for online multiplayer
// Connects to the player's regional game server for optimal latency.
// ============================================================================

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
  mode?: 'full' | 'head-only'; // snapshot mode from server
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

// ─── Binary Opcodes ─────────────────────────────────────────────────────────

const OP_AUTH       = 0x01;
const OP_AUTH_OK    = 0x02;
const OP_AUTH_FAIL  = 0x03;
const OP_JOIN       = 0x10;
const OP_JOINED     = 0x11;
const OP_JOIN_ERROR = 0x12;
const OP_INPUT      = 0x20;
const OP_SNAPSHOT   = 0x21;
const OP_EXTRACT    = 0x30;
const OP_KILLED     = 0x31;
const OP_MATCH_END  = 0x32;
const OP_EXTRACT_FAIL = 0x33;
const OP_ERROR      = 0x34;
const OP_CUSTOM_SKIN = 0x40;
const OP_STRING_TABLE = 0x41;

// ─── Binary Reader Helper ───────────────────────────────────────────────────

class BinReader {
  private dv: DataView;
  private u8: Uint8Array;
  private pos = 0;

  constructor(buf: ArrayBuffer) {
    this.dv = new DataView(buf);
    this.u8 = new Uint8Array(buf);
  }

  get offset() { return this.pos; }
  get remaining() { return this.u8.length - this.pos; }

  u8v(): number { const v = this.u8[this.pos]; this.pos += 1; return v; }
  i8v(): number { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  u16v(): number { const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i16v(): number { const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  u32v(): number { const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  f32v(): number { const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }

  utf8(len: number): string {
    const bytes = this.u8.slice(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }
}

// ─── Binary Writer Helpers ──────────────────────────────────────────────────

function buildAuthMsg(token: string): ArrayBuffer {
  const enc = new TextEncoder();
  const tokenBytes = enc.encode(token);
  const buf = new ArrayBuffer(1 + 2 + tokenBytes.length);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint8(0, OP_AUTH);
  dv.setUint16(1, tokenBytes.length, true);
  u8.set(tokenBytes, 3);
  return buf;
}

function buildJoinMsg(arenaId: string): ArrayBuffer {
  const enc = new TextEncoder();
  const idBytes = enc.encode(arenaId);
  const buf = new ArrayBuffer(1 + 1 + idBytes.length);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint8(0, OP_JOIN);
  dv.setUint8(1, idBytes.length);
  u8.set(idBytes, 2);
  return buf;
}

function buildInputMsg(angle: number, boost: boolean, seq: number): ArrayBuffer {
  const buf = new ArrayBuffer(1 + 4 + 1 + 4);
  const dv = new DataView(buf);
  dv.setUint8(0, OP_INPUT);
  dv.setFloat32(1, angle, true);
  dv.setUint8(5, boost ? 1 : 0);
  dv.setUint32(6, seq, true);
  return buf;
}

function buildExtractMsg(): ArrayBuffer {
  const buf = new ArrayBuffer(1);
  new DataView(buf).setUint8(0, OP_EXTRACT);
  return buf;
}

// ─── Connection Manager ────────────────────────────────────────────────────

export function createGameSocket(onStateChange: (state: GameSocketState) => void) {
  let ws: WebSocket | null = null;
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

  // String table for server string references
  const stringTable: string[] = [];

  // Reconnection state
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  const RECONNECT_DELAY = 1000;
  let savedToken = '';
  let savedArenaId = '';
  let savedGamePort = 3001;
  let intentionalDisconnect = false;

  // Pre-allocated parse buffers (avoid GC from array creation every 50ms)
  const _parseFoods: RemoteFood[] = [];
  const _parseMinimap: MinimapDot[] = [];
  const _parseStars: RemoteStar[] = [];

  // Pre-allocated snake array for snapshots
  let _parseSnakes: RemoteSnake[] = [];

  function st(idx: number): string {
    return stringTable[idx] ?? '';
  }

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

  // ── Binary message handlers ──────────────────────────────────────────────

  function handleStringTable(r: BinReader) {
    const count = r.u16v();
    for (let i = 0; i < count; i++) {
      const idx = r.u16v();
      const len = r.u8v();
      const str = r.utf8(len);
      stringTable[idx] = str;
    }
  }

  function handleAuthOk(r: BinReader) {
    const mapHalf = r.f32v();
    serverMapHalf = mapHalf;
    currentStatus = 'connected';
    reconnectAttempts = 0;
    emit();
    // Send JOIN immediately after AUTH_OK
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buildJoinMsg(savedArenaId));
    }
  }

  function handleAuthFail(r: BinReader) {
    const len = r.u8v();
    const reason = r.utf8(len);
    currentError = reason;
    currentStatus = 'error';
    emit();
  }

  function handleJoined(r: BinReader) {
    const snakeIdLen = r.u8v();
    const snakeId = r.utf8(snakeIdLen);
    const mapHalf = r.f32v();
    console.log('[GameSocket] Joined arena as', snakeId, 'mapHalf:', mapHalf);
    serverMapHalf = mapHalf;
    emit();
  }

  function handleJoinError(r: BinReader) {
    const len = r.u8v();
    const reason = r.utf8(len);
    currentError = reason;
    currentStatus = 'error';
    emit();
  }

  function parseBinarySnapshot(r: BinReader): GameSnapshot {
    const tick = r.u32v();
    const boundaryRadius = r.f32v();
    const playerScore = r.f32v();
    const playerKills = r.u16v();
    const playerCarriedChips = r.f32v();
    const flags = r.u8v();
    // bit 0: isSpectator (reserved), bit 1: head-only mode
    const isHeadOnly = (flags & 0x02) !== 0;

    const snakeCount = r.u16v();
    const foodCount = r.u16v();
    const starCount = r.u16v();
    const minimapCount = r.u16v();

    // ── Parse snakes ──
    // Reuse array if possible, otherwise allocate new
    if (_parseSnakes.length !== snakeCount) {
      _parseSnakes = new Array(snakeCount);
    }
    for (let i = 0; i < snakeCount; i++) {
      const snakeIdIdx = r.u16v();
      const nameIdx = r.u16v();
      const headX = r.f32v();
      const headY = r.f32v();
      const angle = r.f32v();
      const score = r.u32v();
      const colorIdx = r.u16v();
      const headColIdx = r.u16v();
      const bodyLen = r.u16v();
      const bodyRadiusRaw = r.u8v();
      const sFlags = r.u8v();
      const skinIdx = r.u16v();
      const rarityIdx = r.u16v();
      const hasCarriedChips = (sFlags & 0x08) !== 0;
      const carriedChips = hasCarriedChips ? r.f32v() : 0;

      const snake: RemoteSnake = {
        id: st(snakeIdIdx),
        name: st(nameIdx),
        hx: headX,
        hy: headY,
        angle,
        score,
        color: st(colorIdx),
        sc: st(headColIdx),
        ip: (sFlags & 0x01) !== 0,
        ib: (sFlags & 0x02) !== 0,
        bl: bodyLen,
        br: bodyRadiusRaw / 10,
        bo: (sFlags & 0x04) !== 0,
        cc: carriedChips,
      };
      if (skinIdx !== 0xFFFF) snake.si = st(skinIdx);
      if (rarityIdx !== 0xFFFF) snake.ra = st(rarityIdx);
      _parseSnakes[i] = snake;

      // Debug log for first snake (avoids spam)
      if (i === 0) {
        console.log('[GameSocket] First snake:', snake.name, 'bodyLen:', bodyLen, 'bodyRadiusRaw:', bodyRadiusRaw, 'sFlags:', sFlags.toString(16), 'score:', score);
      }
    }

    // ── Parse foods (12 bytes each) ──
    const foods = _parseFoods;
    foods.length = 0;
    for (let i = 0; i < foodCount; i++) {
      const x = r.f32v();
      const y = r.f32v();
      const radiusIdx = r.u8v();
      const colorIdx = r.u16v();
      const fFlags = r.u8v();
      let radius: number;
      if (radiusIdx === 0) radius = 1.5;
      else if (radiusIdx === 1) radius = 2.0;
      else radius = 3.0;
      foods.push({
        x,
        y,
        r: radius,
        color: st(colorIdx),
        m: (fFlags & 0x01) !== 0,
      });
    }

    // ── Parse stars (13 bytes each) ──
    const stars = _parseStars;
    stars.length = 0;
    for (let i = 0; i < starCount; i++) {
      const x = r.f32v();
      const y = r.f32v();
      const value = r.u16v();
      const id = r.u16v();
      const radius = r.u8v();
      stars.push({ x, y, value, id, radius });
    }

    // ── Parse minimap dots (7 bytes each) ──
    const minimapDots = _parseMinimap;
    minimapDots.length = 0;
    for (let i = 0; i < minimapCount; i++) {
      const xRaw = r.i16v();
      const yRaw = r.i16v();
      const score = r.u16v();
      const mFlags = r.u8v();
      // Decompress: val / 32767 * boundaryRadius
      const x = (xRaw / 32767) * boundaryRadius;
      const y = (yRaw / 32767) * boundaryRadius;
      minimapDots.push({
        x,
        y,
        score,
        isBot: (mFlags & 0x01) !== 0,
      });
    }

    return {
      tick,
      boundaryRadius,
      snakes: _parseSnakes,
      foods,
      stars,
      playerScore,
      playerKills,
      playerCarriedChips,
      minimapDots,
      mode: isHeadOnly ? 'head-only' : 'full',
    };
  }

  function handleSnapshot(data: ArrayBuffer) {
    const r = new BinReader(data);
    // Skip opcode byte
    r.u8v();
    currentSnapshot = parseBinarySnapshot(r);
    emit();
  }

  function handleKilled(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const killerNameLen = r.u8v();
    killerName = r.utf8(killerNameLen);
    const killerTagLen = r.u8v();
    killerTag = killerTagLen > 0 ? r.utf8(killerTagLen) : null;
    const kFlags = r.u8v();
    killerIsBot = (kFlags & 0x01) !== 0;
    emit();
  }

  function handleMatchEnd(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const outcome = r.u8v();

    if (outcome === 0) {
      // Death outcome
      const score = r.u32v();
      const kills = r.u16v();
      const duration = r.u32v();
      const reasonLen = r.u8v();
      const reason = r.utf8(reasonLen);
      const kTagLen = r.u8v();
      const kTag = kTagLen > 0 ? r.utf8(kTagLen) : null;
      const mFlags = r.u8v();
      const kIsBot = (mFlags & 0x01) !== 0;
      const chipsLost = r.f32v();

      matchEndData = {
        outcome: 'death',
        score,
        kills,
        durationSeconds: duration,
        reason,
        killerTag: kTag,
        killerIsBot: kIsBot,
        chipsLost,
      };
    } else if (outcome === 1) {
      // Extract outcome
      const score = r.u32v();
      const kills = r.u16v();
      const duration = r.u32v();
      const carriedChips = r.f32v();
      const commission = r.f32v();
      const bankedAmount = r.f32v();
      const chipsEarned = r.f32v();

      matchEndData = {
        outcome: 'extract',
        score,
        kills,
        durationSeconds: duration,
        carriedChips,
        commission,
        bankedAmount,
        chipsEarned,
      };
    }
    emit();
  }

  function handleExtractFail(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const len = r.u8v();
    extractFailedReason = r.utf8(len);
    emit();
  }

  function handleError(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const len = r.u8v();
    const reason = r.utf8(len);
    currentError = reason;
    currentStatus = 'error';
    emit();
  }

  function handleCustomSkin(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const snakeIdLen = r.u8v();
    const snakeId = r.utf8(snakeIdLen);
    const skinIdLen = r.u8v();
    const skinId = r.utf8(skinIdLen);
    const jsonLen = r.u16v();
    const jsonStr = r.utf8(jsonLen);

    try {
      const skinData = JSON.parse(jsonStr);
      const segments = generateCustomSegments(
        skinData.colors,
        skinData.bodyStyle as any,
        skinData.taperStyle as any,
        skinData.glow,
      );
      registerCustomSkinData(skinId, skinData.colors, segments);
    } catch (e) {
      console.warn('[GameSocket] Failed to register remote custom skin:', e);
    }
  }

  // ── WebSocket message dispatcher ─────────────────────────────────────────

  function onMessage(event: MessageEvent) {
    if (!(event.data instanceof ArrayBuffer)) return;
    const u8 = new Uint8Array(event.data);
    const opcode = u8[0];

    switch (opcode) {
      case OP_STRING_TABLE: {
        const r = new BinReader(event.data);
        r.u8v(); // skip opcode
        handleStringTable(r);
        break;
      }
      case OP_AUTH_OK: {
        const r = new BinReader(event.data);
        r.u8v();
        handleAuthOk(r);
        break;
      }
      case OP_AUTH_FAIL: {
        const r = new BinReader(event.data);
        r.u8v();
        handleAuthFail(r);
        break;
      }
      case OP_JOINED: {
        const r = new BinReader(event.data);
        r.u8v();
        handleJoined(r);
        break;
      }
      case OP_JOIN_ERROR: {
        const r = new BinReader(event.data);
        r.u8v();
        handleJoinError(r);
        break;
      }
      case OP_SNAPSHOT:
        handleSnapshot(event.data);
        break;
      case OP_KILLED:
        handleKilled(event.data);
        break;
      case OP_MATCH_END:
        handleMatchEnd(event.data);
        break;
      case OP_EXTRACT_FAIL:
        handleExtractFail(event.data);
        break;
      case OP_ERROR:
        handleError(event.data);
        break;
      case OP_CUSTOM_SKIN:
        handleCustomSkin(event.data);
        break;
    }
  }

  function onOpen() {
    // Send AUTH immediately on connect
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buildAuthMsg(savedToken));
    }
  }

  function onClose() {
    if (intentionalDisconnect) return;
    console.log('[GameSocket] WebSocket closed, attempting reconnect...');
    attemptReconnect();
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) {
      console.error('[GameSocket] All reconnection attempts exhausted');
      currentError = 'Unable to connect to game server';
      currentStatus = 'error';
      emit();
      return;
    }

    reconnectAttempts++;
    console.log(`[GameSocket] Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT} in ${RECONNECT_DELAY}ms`);

    setTimeout(() => {
      if (intentionalDisconnect) return;
      currentStatus = 'connecting';
      emit();
      createWsConnection();
    }, RECONNECT_DELAY);
  }

  function createWsConnection() {
    try {
      ws = new WebSocket(`/?XTransformPort=${savedGamePort}`);
      ws.binaryType = 'arraybuffer';
      ws.onopen = onOpen;
      ws.onmessage = onMessage;
      ws.onclose = onClose;
      ws.onerror = () => {
        // onclose will fire after this and handle reconnect
      };
    } catch (err: any) {
      console.warn('[GameSocket] Failed to create WebSocket:', err.message);
      attemptReconnect();
    }
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
      reconnectAttempts = 0;
      intentionalDisconnect = false;
      savedToken = token;
      savedArenaId = arenaId;
      stringTable.length = 0;
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
        savedGamePort = gamePort;

        // 2. Ensure the regional game server is running
        let serverJustStarted = false;
        try {
          const ensureRes = await fetch(`/api/game-server/ensure?region=${playerRegion}&force=1`);
          if (!ensureRes.ok) {
            console.warn('[GameSocket] Game server ensure check failed:', ensureRes.status);
            // Fallback: try without region param (starts default server on 3001)
            await fetch('/api/game-server/ensure?force=1');
            gamePort = 3001;
            savedGamePort = gamePort;
          } else {
            const ensureData = await ensureRes.json();
            if (ensureData.port) {
              gamePort = ensureData.port;
              savedGamePort = gamePort;
            }
            if (ensureData.started) serverJustStarted = true;
          }
        } catch {
          console.warn('[GameSocket] Game server ensure check failed — will attempt connection anyway');
        }

        // 2b. If server was just spawned, wait for it to fully initialize
        if (serverJustStarted) {
          console.log('[GameSocket] Server just started, waiting 2s for init...');
          await new Promise(r => setTimeout(r, 2000));
        }

        // 3. Create raw WebSocket connection
        createWsConnection();
      } catch (err: any) {
        currentError = err.message || 'Failed to connect';
        currentStatus = 'error';
        emit();
      }
    },

    sendInput(angle: number, boost: boolean) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        inputSeq++;
        ws.send(buildInputMsg(angle, boost, inputSeq));
      }
    },

    sendExtract() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(buildExtractMsg());
      }
    },

    disconnect() {
      intentionalDisconnect = true;
      reconnectAttempts = MAX_RECONNECT; // prevent auto-reconnect
      if (ws) {
        ws.onclose = null; // prevent onClose from triggering reconnect
        ws.close();
        ws = null;
      }
      currentStatus = 'disconnected';
      currentSnapshot = null;
      emit();
    },
  };
}
