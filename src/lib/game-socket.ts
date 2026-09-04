// ============================================================================
// Game Socket — Raw WebSocket client with binary protocol for online multiplayer
// Connects to the player's regional game server for optimal latency.
// ============================================================================

import { registerCustomSkinData } from '@/lib/snake/skin-registry';
import { generateCustomSegments } from '@/components/panels/cosmetics/cosmetics-utils';
import { apiUrl } from '@/lib/api-base';

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

// FIX O8: server-authoritative global leaderboard
export interface LeaderboardEntry {
  name: string;
  score: number;
  chips: number;
  isBot: boolean;
  isSelf: boolean;
}

export interface ServerLeaderboard {
  score: LeaderboardEntry[];
  chips: LeaderboardEntry[];
  totalAlive: number;
  selfRankScore: number;
  selfRankChips: number;
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
  killerId: string | null;
  killerTag: string | null;
  killerIsBot: boolean;
  serverMapHalf: number | null;
  /** FIX O2: true once JOINED confirmed and a live snake exists on the server —
   *  lets the UI un-latch a disconnect-induced dead-state on resume. */
  joinedInGame: boolean;
  /** FIX O8: server-authoritative global leaderboard (null until first message) */
  leaderboard: ServerLeaderboard | null;
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
const OP_LEADERBOARD = 0x42; // FIX O8: server-authoritative global leaderboard
// FIX H5: heartbeat — client pings every 10s, server pongs. Detects half-dead
// mobile connections that keep readyState OPEN after backgrounding.
const OP_PING       = 0x60;
const OP_PONG       = 0x61;

// ─── Heartbeat / lifecycle tuning (FIX H5) ─────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 10000;      // client ping cadence
const PONG_TIMEOUT_MS = 30000;            // no pong for 30s → zombie socket
const MAX_SNAPSHOT_STALENESS_MS = 2500;   // snapshots stopped → force reconnect on resume

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

  /** FIX H4: bounds-check EVERY read. A truncated snapshot (mobile network
   *  handoff, proxy hiccup) used to read undefined bytes silently or throw a
   *  raw RangeError deep inside parse code — the exact crash class fixed on
   *  the server. Now it throws immediately with context, and the message
   *  dispatcher catches + drops it. */
  private _need(n: number): void {
    if (this.pos + n > this.u8.length) {
      throw new RangeError(`BinReader OOB: need ${n} byte(s) at offset ${this.pos}, buffer is ${this.u8.length}`);
    }
  }

  u8v(): number { this._need(1); const v = this.u8[this.pos]; this.pos += 1; return v; }
  i8v(): number { this._need(1); const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  u16v(): number { this._need(2); const v = this.dv.getUint16(this.pos, true); this.pos += 2; return v; }
  i16v(): number { this._need(2); const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  u32v(): number { this._need(4); const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  f32v(): number { this._need(4); const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }

  utf8(len: number): string {
    this._need(len);
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

function buildJoinMsg(arenaId: string, useTicket = false): ArrayBuffer {
  const enc = new TextEncoder();
  const idBytes = enc.encode(arenaId);
  // Optional trailing flag byte (locked spec 2026-09-04): 0x01 = redeem a
  // Virtual Ticket for this join (free Jade Corridor entry). Older servers
  // ignore trailing bytes; the server reads it only when present.
  const buf = new ArrayBuffer(1 + 1 + idBytes.length + (useTicket ? 1 : 0));
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint8(0, OP_JOIN);
  dv.setUint8(1, idBytes.length);
  u8.set(idBytes, 2);
  if (useTicket) dv.setUint8(2 + idBytes.length, 0x01);
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

/** FIX H5: 1-byte heartbeat ping. */
function buildPingMsg(): ArrayBuffer {
  const buf = new ArrayBuffer(1);
  new DataView(buf).setUint8(0, OP_PING);
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
  let killerId: string | null = null;
  let killerTag: string | null = null;
  let killerIsBot = true;
  let serverMapHalf: number | null = null;
  let inputSeq = 0;

  // String table for server string references
  const stringTable: string[] = [];

  // Reconnection state
  // FIX H5: exponential backoff with jitter instead of 5 fixed 1s retries.
  // A 10-second phone call used to burn all 5 attempts in 5 seconds while
  // backgrounded, leaving the game permanently stuck in 'error'.
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 8;
  let savedToken = '';
  let savedArenaId = '';
  let savedUseTicket = false;
  let savedGamePort = 3001;
  let intentionalDisconnect = false;

  // FIX (hotfix-1.3): auto-JOIN guard state.
  // everConnected — this session completed AUTH_OK at least once.
  // joinedInGame  — the server currently holds a LIVE snake for us:
  //   set true on JOINED, cleared on KILLED / MATCH_END / disconnect.
  // Used by handleAuthOk: a reconnect after death/extract must NOT silently
  // auto-join a fresh snake (that re-charged the buy-in without the player
  // pressing Play). A reconnect while alive mid-match SHOULD re-join — the
  // server migrates the live snake to the new socket without charging.
  let everConnected = false;
  let joinedInGame = false;

  // FIX H5: heartbeat + lifecycle state
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastPongAt = 0;
  let lastSnapshotAt = 0;
  let visibilityHandler: (() => void) | null = null;
  let serverLeaderboard: ServerLeaderboard | null = null; // FIX O8

  // Pre-allocated parse buffers (avoid GC from array creation every 50ms)
  const _parseFoods: RemoteFood[] = [];
  const _parseMinimap: MinimapDot[] = [];
  const _minimapPool: MinimapDot[] = []; // FIX O11: pooled dot objects
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
      killerId,
      killerTag,
      killerIsBot,
      serverMapHalf,
      joinedInGame,
      leaderboard: serverLeaderboard,
    });
    // One-shot: clear after emitting so consumer only sees it once
    extractFailedReason = null;
  }

  // FIX O8: parse the server leaderboard message
  function handleLeaderboard(data: ArrayBuffer) {
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const readList = (): LeaderboardEntry[] => {
      const n = r.u8v();
      const list: LeaderboardEntry[] = [];
      for (let i = 0; i < n; i++) {
        const nameLen = r.u8v();
        const name = r.utf8(nameLen);
        const score = r.u32v();
        const chips = r.u32v();
        const flags = r.u8v();
        list.push({ name, score, chips, isBot: (flags & 0x01) !== 0, isSelf: (flags & 0x02) !== 0 });
      }
      return list;
    };
    const score = readList();
    const chips = readList();
    const totalAlive = r.u16v();
    const selfRankScore = r.u16v();
    const selfRankChips = r.u16v();
    serverLeaderboard = { score, chips, totalAlive, selfRankScore, selfRankChips };
    emit();
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
    const firstAuth = !everConnected;
    everConnected = true;
    emit();
    // FIX (hotfix-1.3): auto-JOIN policy.
    //  - First AUTH_OK of the session: JOIN immediately (player pressed Play).
    //  - Reconnect while still alive mid-match (joinedInGame): JOIN again —
    //    the server migrates the live snake to this socket WITHOUT charging
    //    the buy-in a second time.
    //  - Reconnect after death/extract (!joinedInGame): DO NOT join. The old
    //    behavior auto-joined a fresh snake here and silently re-charged the
    //    buy-in whenever the socket dropped after death or app backgrounding.
    //    The death/match-end screen stays up; the player rejoins manually.
    if (ws && ws.readyState === WebSocket.OPEN && (firstAuth || joinedInGame)) {
      ws.send(buildJoinMsg(savedArenaId, savedUseTicket));
    } else if (!firstAuth && !joinedInGame) {
      console.log('[GameSocket] Reconnected after match end — auto-JOIN skipped (buy-in guard)');
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
    joinedInGame = true; // FIX (hotfix-1.3): live snake exists on the server
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

    const snakeCount = Math.min(r.u16v(), 4096);
    const foodCount = Math.min(r.u16v(), 8192);
    const starCount = Math.min(r.u16v(), 4096);
    const minimapCount = Math.min(r.u16v(), 4096);
    // FIX H4: caps above are cheap insurance — a corrupted count byte can no
    // longer drive a huge parse loop even before the bounds checker fires.

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

      // Debug log for first snake — DEV ONLY (FIX O16: this logged at 20 Hz
      // in production builds, spamming consoles and costing frame time)
      if (i === 0 && process.env.NODE_ENV !== 'production') {
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

    // ── Parse stars (15 bytes each) ──
    const stars = _parseStars;
    stars.length = 0;
    for (let i = 0; i < starCount; i++) {
      const x = r.f32v();
      const y = r.f32v();
      // FIX O14: f32 value (was u16 — high-value stars displayed clamped)
      const value = r.f32v();
      const id = r.u16v();
      const radius = r.u8v();
      stars.push({ x, y, value, id, radius });
    }

    // ── Parse minimap dots (7 bytes each) ──
    // FIX O11: the server only rebuilds minimap dots every 4th snapshot (5Hz)
    // and sends an EMPTY dot list otherwise — keep the previous dots so the
    // minimap holds steady instead of blinking empty. Objects are POOLED:
    // re-allocating ~1000 dots per snapshot was 20K objects/sec of GC churn.
    const minimapDots = _parseMinimap;
    if (minimapCount > 0) {
      minimapDots.length = 0;
      for (let i = 0; i < minimapCount; i++) {
        const xRaw = r.i16v();
        const yRaw = r.i16v();
        const score = r.u16v();
        const mFlags = r.u8v();
        // Decompress: val / 32767 * boundaryRadius
        const x = (xRaw / 32767) * boundaryRadius;
        const y = (yRaw / 32767) * boundaryRadius;
        let dot = _minimapPool[i];
        if (!dot) { dot = { x: 0, y: 0, score: 0, isBot: false }; _minimapPool[i] = dot; }
        dot.x = x;
        dot.y = y;
        dot.score = score;
        dot.isBot = (mFlags & 0x01) !== 0;
        minimapDots.push(dot);
      }
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
    lastSnapshotAt = performance.now(); // FIX H5: staleness tracking
    emit();
  }

  function handleKilled(data: ArrayBuffer) {
    joinedInGame = false; // FIX (hotfix-1.3): snake no longer live
    const r = new BinReader(data);
    r.u8v(); // skip opcode
    const killerNameLen = r.u8v();
    killerName = r.utf8(killerNameLen);
    // E6: killer snakeId — exact highlight match on the death screen
    const killerIdLen = r.u8v();
    killerId = killerIdLen > 0 ? r.utf8(killerIdLen) : null;
    const killerTagLen = r.u8v();
    killerTag = killerTagLen > 0 ? r.utf8(killerTagLen) : null;
    const kFlags = r.u8v();
    killerIsBot = (kFlags & 0x01) !== 0;
    emit();
  }

  function handleMatchEnd(data: ArrayBuffer) {
    joinedInGame = false; // FIX (hotfix-1.3): match over — no live snake
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
    if (u8.length < 1) return;
    const opcode = u8[0];

    // FIX H4: wrap the whole dispatch. Any malformed server message now gets
    // logged and dropped instead of throwing inside the WS event chain.
    try {
      switch (opcode) {
        case OP_PONG:
          lastPongAt = performance.now(); // FIX H5: heartbeat liveness
          break;
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
        case OP_LEADERBOARD:
          handleLeaderboard(event.data);
          break;
      }
    } catch (err) {
      console.warn(`[GameSocket] Dropped malformed message (opcode 0x${opcode.toString(16)}):`, err);
    }
  }

  function onOpen() {
    // FIX H9: reset the string table on EVERY socket open (including
    // reconnects). The server keeps a FRESH per-connection table and resends
    // every string the client needs as deltas on the first snapshot, so a
    // stale table (server restarted mid-session → indices shifted) can only
    // produce wrong names/colors. Clearing is always safe here.
    stringTable.length = 0;
    // Send AUTH immediately on connect
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buildAuthMsg(savedToken));
    }
  }

  function onClose() {
    stopHeartbeat(); // FIX H5: no interval leak across reconnects
    if (intentionalDisconnect) return;
    console.log('[GameSocket] WebSocket closed, attempting reconnect...');
    attemptReconnect();
  }

  /** FIX H5: exponential backoff with jitter — 1s, 2s, 4s … capped at 15s. */
  function reconnectDelayMs(attempt: number): number {
    const base = Math.min(1000 * Math.pow(2, Math.max(0, attempt - 1)), 15000);
    return Math.floor(base + Math.random() * 300);
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
    const delay = reconnectDelayMs(reconnectAttempts);
    console.log(`[GameSocket] Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT} in ${delay}ms`);

    setTimeout(() => {
      if (intentionalDisconnect) return;
      currentStatus = 'connecting';
      emit();
      createWsConnection();
    }, delay);
  }

  // ── FIX H5: heartbeat + visibility lifecycle ────────────────────────────

  function startHeartbeat(): void {
    stopHeartbeat();
    lastPongAt = performance.now();
    heartbeatTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (now - lastPongAt > PONG_TIMEOUT_MS) {
        // Zombie socket: readyState OPEN but no pong for 30s (typical after
        // mobile network handoff). Force close — onClose triggers reconnect.
        console.warn('[GameSocket] Heartbeat timeout (no pong for 30s) — forcing reconnect');
        try { ws.close(); } catch { /* ignore */ }
        return;
      }
      try { ws.send(buildPingMsg()); } catch { /* ignore — onClose will handle */ }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  /** FIX H5: when the app returns to the foreground (phone call ended, app
   *  switched back), verify the socket is actually usable instead of staring
   *  at a frozen world:
   *  - socket dead → reconnect immediately (attempts reset — user is watching)
   *  - socket "open" but snapshots stale > 2.5s → force fresh reconnect */
  function handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return; // hidden: rAF pauses naturally
    if (intentionalDisconnect) return;

    const readyState = ws ? ws.readyState : WebSocket.CLOSED;
    if (readyState !== WebSocket.OPEN) {
      reconnectAttempts = 0;
      currentStatus = 'connecting';
      emit();
      stopHeartbeat();
      createWsConnection();
      return;
    }

    if (currentStatus === 'connected'
        && lastSnapshotAt > 0
        && performance.now() - lastSnapshotAt > MAX_SNAPSHOT_STALENESS_MS) {
      console.warn('[GameSocket] Stale snapshots on resume — forcing reconnect');
      try { ws!.close(); } catch { /* ignore */ }
    }
  }

  function attachVisibility(): void {
    if (visibilityHandler || typeof document === 'undefined') return;
    visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function detachVisibility(): void {
    if (visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
    visibilityHandler = null;
  }

  function createWsConnection() {
    try {
      // T3 (static-export readiness): the WS URL is now configurable via
      // NEXT_PUBLIC_GAME_WS_URL. The default keeps the historical platform
      // behavior (same-origin relative URL + XTransformPort port routing),
      // which also works in the z preview proxy. For a static export
      // (Capacitor shell / CDN-hosted client), set the env var to the
      // absolute game-server origin, e.g. wss://ws.example.com.
      const wsUrl = process.env.NEXT_PUBLIC_GAME_WS_URL || `/?XTransformPort=${savedGamePort}`;
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      ws.onopen = onOpen;
      ws.onmessage = onMessage;
      ws.onclose = onClose;
      ws.onerror = () => {
        // onclose will fire after this and handle reconnect
      };
      startHeartbeat(); // FIX H5
    } catch (err: any) {
      console.warn('[GameSocket] Failed to create WebSocket:', err.message);
      attemptReconnect();
    }
  }

  return {
    get snapshot() { return currentSnapshot; },
    get status() { return currentStatus; },

    async connect(token: string, arenaId: string, opts?: { useTicket?: boolean }) {
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
      everConnected = false;   // FIX (hotfix-1.3): fresh session — first AUTH_OK joins again
      joinedInGame = false;    // FIX (hotfix-1.3)
      savedToken = token;
      savedArenaId = arenaId;
      savedUseTicket = opts?.useTicket === true;
      stringTable.length = 0;
      lastSnapshotAt = 0; // FIX H5
      attachVisibility(); // FIX H5: resume health-check while connected
      emit();

      try {
        // 1. Fetch the player's regional game server endpoint
        let gamePort = 3001; // fallback to default
        let playerRegion = 'UNKNOWN';
        try {
          const regionRes = await fetch(apiUrl('/api/player/region-server'));
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
        // NOTE: no force=1 — force-restarting would kick every player already
        // in a match on that server. The route only spawns when the port is down.
        let serverJustStarted = false;
        try {
          const ensureRes = await fetch(apiUrl(`/api/game-server/ensure?region=${playerRegion}`));
          if (!ensureRes.ok) {
            console.warn('[GameSocket] Game server ensure check failed:', ensureRes.status);
            // Fallback: try without region param (starts default server on 3001)
            await fetch(apiUrl('/api/game-server/ensure'));
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
      stopHeartbeat(); // FIX H5
      detachVisibility(); // FIX H5
      if (ws) {
        ws.onclose = null; // prevent onClose from triggering reconnect
        ws.close();
        ws = null;
      }
      currentStatus = 'disconnected';
      currentSnapshot = null;
      joinedInGame = false; // FIX (hotfix-1.3)
      emit();
    },
  };
}
