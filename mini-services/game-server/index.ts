// ============================================================================
// index.ts — Venom Arena Socket.IO game server (mini-service, port 3001).
// ----------------------------------------------------------------------------
// Server-authoritative multiplayer snake. The Next.js app (port 3000) talks
// to this server via the Caddy gateway using io("/?XTransformPort=3001").
//
// Architectural fixes vs the OLD broken server (see worklog ANALYSIS-1):
//  * Auth is mandatory — sockets without a valid JWT (verified via
//    POST /api/match/verify) are disconnected at the middleware. No
//    "auth optional, admit anyway" path.
//  * Identity is the verify response only. We never trust any subsequent
//    client-supplied userTag/name/color/skin.
//  * One socket per userTag — a new connection kicks the prior socket.
//  * Movement is server-authoritative — clients send only `angle`; the
//    server computes position. Teleport is impossible.
//  * Buy-in is deducted atomically by /api/match/join (Next.js + Prisma
//    transaction). We never touch the DB directly.
//  * Match results are reported exactly once via /api/match/result, guarded
//    by a `matchSettling` flag to prevent double-credit on disconnect races.
//  * Recursive setTimeout (not setInterval) for both tick and broadcast
//    loops — a slow tick can't overlap the next.
//  * Every tick is wrapped in try/catch; one bad snake never kills the loop.
//  * Spatial hash grid (see spatial-grid.ts) keeps collision detection
//    near-linear instead of O(n²).
//  * Broadcasts happen at 20 Hz, not every tick, and snapshot points are
//    downsampled to 60 to keep payloads small.
//  * uncaughtException / unhandledRejection are logged, never fatal.
//  * Graceful shutdown on SIGINT/SIGTERM broadcasts `server_shutdown` then exits.
// ============================================================================

import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { readFileSync } from 'fs';
import { join as pathJoin, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  TICK_MS,
  WORLD_SIZE,
  getArenaById,
} from '../../src/lib/game-config';
import { calcVisualRadius, calcBaseMapRadius, getFoodOrbs, calcCommissionRate, DEFAULT_SNAKE_CONFIG } from '../../src/lib/snake-engine.js';
import {
  type ArenaRoom,
  type BotSession,
  type PendingDeath,
  type PlayerIdentity,
  type PlayerSession,
  type SnakeBase,
  buildBaseSnapshot,
  cacheAllSnakes,
  createArenaRoom,
  detectCollisions,
  detectHeadOnCollisions,
  dropScoreOrbsAtBody,
  dropStarsAtDeath,
  eatFood,
  ensureBots,
  expireChat,
  findSafeSpawnPoint,
  initialBody,
  recomputeLeader,
  replenishFood,
  spawnBot,
  tickBot,
  tickSnakeMovement,
} from './game-state.js';

// ----------------------------------------------------------------------------
// Load .env from project root (same secret as Next.js)
// ----------------------------------------------------------------------------
function loadEnv(): void {
  if (process.env.INTERNAL_SECRET) return; // already set
  try {
    const projectRoot = pathJoin(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const envPath = pathJoin(projectRoot, '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      // Only set INTERNAL_SECRET (avoid overwriting PORT or other game-server vars)
      if (key === 'INTERNAL_SECRET') process.env.INTERNAL_SECRET = val;
    }
  } catch {
    // .env not found — use defaults
  }
}
loadEnv();

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3001);
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'venom-arena-internal-dev';
const NEXT_APP_URL = (process.env.NEXT_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const BROADCAST_MS = 1000 / 20; // 20 Hz
const MAX_SNAPSHOTS_PER_SECOND = 20;
const INPUT_MIN_INTERVAL_MS = 1000 / MAX_SNAPSHOTS_PER_SECOND; // 50ms
const CHAT_MIN_INTERVAL_MS = 2000;
const CHAT_MAX_LEN = 80;
const HTTP_TIMEOUT_MS = 3000;

// ----------------------------------------------------------------------------
// Logging — single sink for all output (no console.log elsewhere)
// ----------------------------------------------------------------------------

type LogLevel = 'info' | 'warn' | 'error';
function log(level: LogLevel, msg: string): void {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const prefix = `[${hh}:${mm}:${ss}] [${level.toUpperCase()}]`;
  if (level === 'error') {
    process.stderr.write(`${prefix} ${msg}\n`);
  } else {
    process.stdout.write(`${prefix} ${msg}\n`);
  }
}

// ----------------------------------------------------------------------------
// HTTP helpers (server-to-server, with 3s timeout + try/catch)
// ----------------------------------------------------------------------------

interface VerifyResponse {
  ok: boolean;
  reason?: string;
  player?: PlayerIdentity;
}

interface JoinResponse {
  ok: boolean;
  reason?: string;
  player?: unknown;
}

interface MatchResultResponse {
  player?: unknown;
  chipsEarned?: number;
  chipsLost?: number;
  xpGained?: number;
  newLevel?: number;
  newBankedChips?: number;
}

/** Call POST /api/match/verify to validate the client's JWT and fetch its identity. */
async function verifyToken(token: string): Promise<VerifyResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${NEXT_APP_URL}/api/match/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });
    return (await res.json()) as VerifyResponse;
  } finally {
    clearTimeout(timer);
  }
}

/** Call POST /api/match/join — atomically deducts buyIn on the Next.js side. */
async function joinMatch(userTag: string, arenaId: string): Promise<JoinResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${NEXT_APP_URL}/api/match/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify({ userTag, arenaId }),
      signal: controller.signal,
    });
    return (await res.json()) as JoinResponse;
  } finally {
    clearTimeout(timer);
  }
}

interface ReportResultPayload {
  userTag: string;
  arenaId: string;
  outcome: 'extract' | 'death';
  carriedChips: number;
  kills: number;
  durationSeconds: number;
  killerTag?: string;
  score?: number;
  bankedAmount?: number;
}

/** Call POST /api/match/result — credits/debits the player's account. */
async function reportMatchResult(payload: ReportResultPayload): Promise<MatchResultResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${NEXT_APP_URL}/api/match/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      log('error', `match/result HTTP ${res.status} for ${payload.userTag}`);
      return null;
    }
    return (await res.json()) as MatchResultResponse;
  } catch (err) {
    log('error', `match/result fetch failed for ${payload.userTag}: ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------
// Globals
// ----------------------------------------------------------------------------

// Create HTTP server with a pre-Socket.IO handler for the /stats endpoint.
// This fires BEFORE Socket.IO's handler, so we can safely write the response.
const httpServer = createServer((req, res) => {
  if (req.url === '/stats' && req.method === 'GET' && !res.headersSent) {
    const stats: Record<string, { players: number; maxPlayers: number }> = {};
    for (const [roomKey, room] of rooms) {
      stats[roomKey] = { players: room.players.size, maxPlayers: MAX_PLAYERS_PER_SHARD };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
  }
  // All other requests fall through to Socket.IO's handler.
});

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

/** Per-arena rooms, lazily created. Keyed by arena id from ARENA_TIERS. */
const rooms = new Map<string, ArenaRoom>();
/** Enforces one socket per userTag: userTag → socketId. */
const userTagToSocket = new Map<string, string>();

/** Per-socket data shape (typed helper). */
interface SocketData {
  identity?: PlayerIdentity;
  playerSession?: PlayerSession;
}

function getSocketData(s: Socket): SocketData {
  return s.data as SocketData;
}

/** Max real players per arena shard before auto-creating a new instance. */
const MAX_PLAYERS_PER_SHARD = 1000;

/**
 * Get-or-create an ArenaRoom for `arenaId`. If the primary shard is full
 * (>= MAX_PLAYERS_PER_SHARD real players), find or create the next shard.
 * Shards are keyed as `{arenaId}` (shard 0), `{arenaId}#2` (shard 1), etc.
 */
function getOrCreateRoom(arenaId: string): ArenaRoom | null {
  const arena = getArenaById(arenaId);
  if (!arena) return null;

  // Try shard 0, then 1, 2, ... until we find one with capacity.
  let shardIdx = 0;
  while (true) {
    const roomKey = shardIdx === 0 ? arenaId : `${arenaId}#${shardIdx + 1}`;
    let room = rooms.get(roomKey);
    if (room && room.players.size < MAX_PLAYERS_PER_SHARD) {
      return room;
    }
    if (!room) {
      // Create a new shard.
      room = createArenaRoom(arena);
      rooms.set(roomKey, room);
      ensureBots(room);
      log('info', `Created arena shard ${roomKey} with ${room.bots.size} bots (shard ${shardIdx})`);
      return room;
    }
    shardIdx++;
    // Safety: don't infinite-loop if somehow all shards are full (shouldn't happen).
    if (shardIdx > 200) {
      log('error', `Arena ${arenaId} has >200 shards, rejecting join`);
      return null;
    }
  }
}

/** Get the shard key for a room (for logging / debugging). */
function getRoomKey(room: ArenaRoom): string {
  for (const [key, r] of rooms.entries()) {
    if (r === room) return key;
  }
  return room.arena.id;
}

// ----------------------------------------------------------------------------
// Match settlement (called after extract success or collision death)
// ----------------------------------------------------------------------------

interface MatchResultClientPayload {
  outcome: 'extract' | 'death';
  arenaId: string;
  arenaName: string;
  chipsExtracted: number;
  commission: number;
  bankedAmount: number;
  kills: number;
  score: number;
  xpGained: number;
  newLevel: number;
  newBankedChips: number;
  durationSeconds: number;
}

/**
 * Settle a player's match: call /api/match/result, emit `match_result` to
 * the player, and remove them from the room. Idempotent via the
 * `matchSettling` flag — concurrent calls short-circuit.
 */
async function settleMatch(
  room: ArenaRoom,
  session: PlayerSession,
  outcome: 'extract' | 'death',
  killer?: SnakeBase,
): Promise<void> {
  if (session.matchSettling) return;
  session.matchSettling = true;
  session.isExtracting = false;
  session.extractionProgress = 0;

  const now = Date.now();
  const durationSeconds = Math.max(0, Math.floor((now - session.joinedAt) / 1000));
  const carriedChips = Math.max(0, Math.floor(session.carriedChips));
  const kills = session.kills;
  const killerTag = killer?.userTag;
  const score = session.score;

  // Dynamic commission: 0% if <=3 real players in arena, 35% if >=4.
  const realPlayerCount = room.players.size;
  const commissionRate = calcCommissionRate(realPlayerCount, DEFAULT_SNAKE_CONFIG);
  const commission = outcome === 'extract' ? Math.floor(carriedChips * commissionRate) : 0;
  const bankedAmount = outcome === 'extract' ? (carriedChips - commission) : 0;

  const result = await reportMatchResult({
    userTag: session.identity.userTag,
    arenaId: room.arena.id,
    outcome,
    carriedChips,
    kills,
    durationSeconds,
    killerTag,
    score,
    bankedAmount,
  });

  const payload: MatchResultClientPayload = {
    outcome,
    arenaId: room.arena.id,
    arenaName: room.arena.name,
    chipsExtracted: outcome === 'extract' ? carriedChips : 0,
    commission,
    bankedAmount,
    kills,
    score,
    xpGained: result?.xpGained ?? 0,
    newLevel: result?.newLevel ?? session.identity.level,
    newBankedChips: result?.newBankedChips ?? 0,
    durationSeconds,
  };

  const socket = io.sockets.sockets.get(session.id);
  if (socket) {
    // Emit death BEFORE match_result so the client's onDeath handler
    // runs first (sets up post-death replay recording). If match_result
    // arrived first it would set matchEndedRef=true and cause onDeath
    // to bail via its idempotency guard.
    if (outcome === 'death') {
      socket.emit('death', {
        killerId: killer?.id,
        killerName: killer?.name,
        killerTag: killer?.userTag,
        killerColor: killer?.color,
        killerIsBot: killer?.isBot ?? true,
      });
    }
    socket.emit('match_result', payload);
  }

  // For death: keep the player in the room for 16 s so the broadcast
  // loop continues sending snapshots.  The client records 15 s of
  // post-death frames (300 frames at 20 Hz) for the replay.  After the
  // window expires we clean up.  The session is already marked
  // isDead + matchSettling, so the tick loop skips movement/collisions.
  if (outcome === 'death') {
    const sid = session.id;
    const roomId = room.arena.id;
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (r) r.players.delete(sid);
      const s = io.sockets.sockets.get(sid);
      if (s) {
        const d = getSocketData(s);
        d.playerSession = undefined;
      }
      log('info', `Post-death replay window expired — removed ${session.identity.userTag} from ${roomId}`);
    }, 16_000);
  } else {
    // Extract: remove immediately (no post-death replay needed).
    room.players.delete(session.id);
    if (socket) {
      const data = getSocketData(socket);
      data.playerSession = undefined;
    }
  }
  log('info', `${session.identity.userTag} ${outcome} in ${room.arena.id}: chips=${carriedChips} kills=${kills} dur=${durationSeconds}s`);
}

// ----------------------------------------------------------------------------
// Tick loop (recursive setTimeout — a slow tick can't overlap the next)
// ----------------------------------------------------------------------------

function tickRoom(room: ArenaRoom, now: number): void {
  room.tick++;

  // 1) Cache all snakes + realPlayerCount for this tick (used by all subsequent functions).
  cacheAllSnakes(room);

  // 2) Rebuild spatial grid from scratch each tick.
  room.grid.clear();

  // 3) Insert all snake body segments (skip dead / empty).
  for (const snake of room._cachedSnakes!) {
    if (snake.isDead) continue;
    if (snake.points.length === 0) continue;
    for (let i = 0; i < snake.points.length; i++) {
      const p = snake.points[i];
      room.grid.insert({
        id: `${snake.id}:${i}`,
        kind: 'segment',
        x: p.x,
        y: p.y,
        radius: snake.size,
        snakeId: snake.id,
        segIdx: i,
      });
    }
  }

  // 4) Insert all food (skip already-eaten with value=0).
  for (const food of room.foods) {
    if (food.value <= 0) continue;
    room.grid.insert({
      id: food.id,
      kind: 'food',
      x: food.x,
      y: food.y,
      radius: food.size,
      value: food.value,
      isStarChip: food.isStarChip,
      color: food.color,
      foodRef: food, // <-- reference to the REAL food object so eatFood can zero it
    });
  }

  // 5) Bot AI tick.
  for (const bot of room.bots.values()) {
    if (bot.isDead) continue;
    try {
      tickBot(bot, room, now);
    } catch (err) {
      log('error', `Bot tick error in ${room.arena.id}: ${(err as Error).message}`);
    }
  }

  // 6) Player movement (server-authoritative — apply desired angle + speed).
  for (const session of room.players.values()) {
    if (session.isDead || session.matchSettling) continue;
    try {
      const dropped = tickSnakeMovement(session, session.desiredAngle, session.wantsBoost, room.cfg);
      // Add boost-dropped food orbs to the room.
      for (const pt of dropped) {
        const cfgOrbs = getFoodOrbs(room.cfg);
        const smallOrb = cfgOrbs.find(o => o.size === 'small') ?? cfgOrbs[0];
        room.foods.push({
          id: `food-${room.arena.id}-${room.foodIdCounter++}`,
          x: pt.x,
          y: pt.y,
          size: smallOrb.radius,
          value: smallOrb.value,
          isStarChip: false,
          color: smallOrb.color,
          glowColor: smallOrb.glowColor,
          orbSize: 'small',
        });
      }
    } catch (err) {
      log('error', `Player movement error: ${(err as Error).message}`);
    }
  }

  // 7) Collision detection (body + head-on).
  let deaths: PendingDeath[] = [];
  try {
    deaths = detectCollisions(room, now);
    // Head-on collisions processed AFTER body collisions (already-dead snakes skipped).
    const headOnDeaths = detectHeadOnCollisions(room, now);
    deaths = deaths.concat(headOnDeaths);
  } catch (err) {
    log('error', `Collision detection error in ${room.arena.id}: ${(err as Error).message}`);
  }

  // 8) Apply deaths with CORRECT drop rules per spec:
  //    Body/headOn collision: drop score orbs (ALL snakes, including selfDestruct bots) + 10 stars (real players always).
  //    Wall death: drop 0 food (score destroyed) + 10 stars (real players always, even if carriedChips=0).
  //    Bot selfDestruct WALL death: 0 food, 0 stars (vanish cleanly).
  //    Bot selfDestruct COLLISION death: STILL drops food (only wall death vanishes cleanly).
  for (const death of deaths) {
    const dead = room.players.get(death.deadId) || (room.bots.get(death.deadId) as SnakeBase | undefined);
    if (!dead || dead.isDead) continue;
    dead.isDead = true;

    const headX = dead.points[0]?.x ?? 0;
    const headY = dead.points[0]?.y ?? 0;

    if (death.cause === 'wall') {
      // Wall death: NO food orbs (score destroyed).
      // Stars: real players ALWAYS get 10 stars (even if carriedChips=0, each star=1 chip value).
      // selfDestruct bots get 0 stars.
      if (dead.isPlayer) {
        dropStarsAtDeath(room, headX, headY, dead.carriedChips);
        log('info', `Wall-death star drop: ${dead.name} → 10 stars (${Math.floor(dead.carriedChips)} chips) at (${headX.toFixed(0)},${headY.toFixed(0)})`);
      }
      // Bot wall death (selfDestruct): 0 food, 0 stars — vanish cleanly.
    } else {
      // Body or headOn collision: ALL snakes drop score orbs (sum = snake.score).
      // selfDestruct bots that die by COLLISION still drop food (only WALL death vanishes cleanly).
      const foodCountBefore = room.foods.length;
      dropScoreOrbsAtBody(room, dead.points, dead.score, dead.color);
      const foodDropped = room.foods.length - foodCountBefore;
      log('info', `Death food drop: ${dead.name} (${dead.isBot?'bot':'player'}) score=${dead.score} bodyLen=${dead.points.length} → ${foodDropped} orbs`);
      // Stars: real players ALWAYS get 10 stars (even if carriedChips=0).
      if (dead.isPlayer) {
        dropStarsAtDeath(room, headX, headY, dead.carriedChips);
        log('info', `Death star drop: ${dead.name} → 10 stars (${Math.floor(dead.carriedChips)} chips) at (${headX.toFixed(0)},${headY.toFixed(0)})`);
      }
    }

    // Credit killer's kill counter (only if killer is alive). Bots don't track kills.
    const killer = death.killerId && death.killerId !== 'wall'
      ? (room.players.get(death.killerId) ?? room.bots.get(death.killerId))
      : undefined;
    if (killer && !killer.isDead && killer.isPlayer) {
      (killer as PlayerSession).kills += 1;
    }

    // Broadcast kill feed to all players in the arena
    const killFeedMsg = death.cause === 'wall'
      ? { victimName: dead.name, victimIsBot: dead.isBot, killerName: null, killerIsBot: false, cause: 'wall' as const }
      : killer
        ? { victimName: dead.name, victimIsBot: dead.isBot, killerName: killer.name, killerIsBot: killer.isBot, cause: death.cause as string }
        : { victimName: dead.name, victimIsBot: dead.isBot, killerName: null, killerIsBot: false, cause: death.cause as string };
    for (const socketId of room.players.keys()) {
      io.to(socketId).emit('kill_feed', killFeedMsg);
    }

    // Notify all players about death food/star drops so they can show visual effects.
    if (death.cause === 'wall') {
      // Wall death: no food orbs, but stars may have dropped for real players.
      if (dead.isPlayer) {
        const wallDropEvent = {
          x: headX,
          y: headY,
          score: 0,
          bodyPoints: [],
          color: dead.color,
          droppedStars: 10,
        };
        for (const socketId of room.players.keys()) {
          io.to(socketId).emit('death_food_drop', wallDropEvent);
        }
      }
    } else {
      const dropEvent = {
        x: headX,
        y: headY,
        score: dead.score,
        bodyPoints: dead.points.slice(0, Math.min(60, dead.points.length)),
        color: dead.color,
        droppedStars: dead.isPlayer ? 10 : 0,
      };
      for (const socketId of room.players.keys()) {
        io.to(socketId).emit('death_food_drop', dropEvent);
      }
    }

    if (dead.isPlayer) {
      const session = dead as PlayerSession;
      log('info', `${session.identity.userTag} died in ${room.arena.id} (cause=${death.cause}, killer=${death.killerId ?? 'none'})`);
      // Settle asynchronously — never throw out of the tick loop.
      settleMatch(room, session, 'death', death.cause === 'wall' ? undefined : killer).catch((err) => {
        log('error', `settleMatch(death) failed: ${(err as Error).message}`);
      });
    } else {
      // Bot dies: remove + respawn only if under cap.
      room.bots.delete(dead.id);
      if (room.bots.size < room.arena.botsCount) {
        try {
          const fresh = spawnNewBot(room);
          if (fresh) room.bots.set(fresh.id, fresh);
        } catch (err) {
          log('error', `Bot respawn error: ${(err as Error).message}`);
        }
      }
    }
  }

  // 9) Food collision (credits carriedChips, marks food as eaten via sentinel).
  try {
    eatFood(room);
  } catch (err) {
    log('error', `eatFood error in ${room.arena.id}: ${(err as Error).message}`);
  }

  // 10) Replenish food up to target.
  try {
    replenishFood(room);
  } catch (err) {
    log('error', `replenishFood error in ${room.arena.id}: ${(err as Error).message}`);
  }

  // 11) Extraction progress for players. NO zone check — extract anywhere.
  for (const session of room.players.values()) {
    if (session.isDead || session.matchSettling) continue;
    if (!session.isExtracting) continue;

    session.extractionProgress += TICK_MS;
    const progress = Math.min(1, session.extractionProgress / room.cfg.extractionDurationMs);
    const sock = io.sockets.sockets.get(session.id);
    if (sock) sock.emit('extract_progress', { progress });

    if (session.extractionProgress >= room.cfg.extractionDurationMs) {
      // Extraction success — settle asynchronously.
      settleMatch(room, session, 'extract').catch((err) => {
        log('error', `settleMatch(extract) failed: ${(err as Error).message}`);
      });
    }
  }

  // 12) Recompute leader + expire chat bubbles.
  try {
    recomputeLeader(room);
  } catch (err) {
    log('error', `recomputeLeader error: ${(err as Error).message}`);
  }
  try {
    expireChat(room, now);
  } catch (err) {
    log('error', `expireChat error: ${(err as Error).message}`);
  }
}

function tickOnce(): void {
  const now = Date.now();
  try {
    for (const room of rooms.values()) {
      // Skip empty rooms (no players) for CPU savings — bots stay idle.
      if (room.players.size === 0) continue;
      try {
        tickRoom(room, now);
      } catch (err) {
        log('error', `Tick error in arena ${room.arena.id}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    log('error', `Tick loop fatal: ${(err as Error).message}`);
  } finally {
    setTimeout(tickOnce, TICK_MS);
  }
}

// Local helper so tickRoom can spawn a bot safely (never throws out of the tick loop).
function spawnNewBot(room: ArenaRoom): BotSession | null {
  try {
    return spawnBot(room);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Broadcast loop (20 Hz — independent of tick rate)
// ----------------------------------------------------------------------------

function broadcastOnce(): void {
  try {
    for (const room of rooms.values()) {
      if (room.players.size === 0) continue;
      // Build one base snapshot per room, then customize yourRank per viewer.
      let base: ReturnType<typeof buildBaseSnapshot> | null = null;
      const sorted = [...room.players.values()]
        .filter(p => !p.isDead && !p.matchSettling)
        .sort((a, b) => b.carriedChips - a.carriedChips);
      for (const socketId of room.players.keys()) {
        try {
          if (!base) base = buildBaseSnapshot(room);
          const yourRank = sorted.findIndex(p => p.id === socketId) + 1;
          io.to(socketId).emit('snapshot', { ...base, yourRank: yourRank > 0 ? yourRank : 0 });
        } catch (err) {
          log('error', `Snapshot build error in ${room.arena.id}: ${(err as Error).message}`);
          continue;
        }
      }
    }
  } catch (err) {
    log('error', `Broadcast loop fatal: ${(err as Error).message}`);
  } finally {
    setTimeout(broadcastOnce, BROADCAST_MS);
  }
}

// ----------------------------------------------------------------------------
// Socket.IO auth middleware
// ----------------------------------------------------------------------------

io.use(async (socket, next) => {
  const token = (socket.handshake.auth as { token?: unknown })?.token;
  if (typeof token !== 'string' || token.length === 0) {
    return next(new Error('No token provided'));
  }
  try {
    const result = await verifyToken(token);
    if (!result.ok || !result.player) {
      return next(new Error(result.reason || 'invalid_token'));
    }
    getSocketData(socket).identity = result.player;
    return next();
  } catch (err) {
    log('warn', `Verify fetch failed: ${(err as Error).message}`);
    return next(new Error('verify_failed'));
  }
});

// ----------------------------------------------------------------------------
// Connection handler
// ----------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  const data = getSocketData(socket);
  const identity = data.identity;
  if (!identity) {
    // Should never happen — middleware rejects unauthed sockets.
    socket.disconnect(true);
    return;
  }

  // One socket per userTag: kick any prior session.
  const prior = userTagToSocket.get(identity.userTag);
  if (prior && prior !== socket.id) {
    const priorSock = io.sockets.sockets.get(prior);
    if (priorSock) {
      priorSock.emit('kicked', { reason: 'Another session opened for this account' });
      priorSock.disconnect(true);
    }
  }
  userTagToSocket.set(identity.userTag, socket.id);
  log('info', `Socket connected: ${identity.userTag} (${socket.id})`);

  // ----- join_arena -----
  socket.on('join_arena', (payload: unknown) => {
    void handleJoinArena(socket, payload);
  });

  // ----- input -----
  socket.on('input', (payload: unknown) => {
    handleInput(socket, payload);
  });

  // ----- extract -----
  socket.on('extract', () => {
    handleExtract(socket);
  });

  // ----- cancel_extract -----
  socket.on('cancel_extract', () => {
    handleCancelExtract(socket);
  });

  // ----- chat -----
  socket.on('chat', (payload: unknown) => {
    handleChat(socket, payload);
  });

  // ----- leave -----
  socket.on('leave', () => {
    handleLeave(socket, 'client requested');
  });

  // ----- disconnect -----
  socket.on('disconnect', (reason: string) => {
    handleLeave(socket, `disconnected (${reason})`);
    // Clean up userTag → socket mapping (only if we still own it).
    const ident = getSocketData(socket).identity;
    if (ident && userTagToSocket.get(ident.userTag) === socket.id) {
      userTagToSocket.delete(ident.userTag);
    }
    log('info', `Socket disconnected: ${ident?.userTag ?? 'unknown'} (${reason})`);
  });

  socket.on('error', (err: Error) => {
    log('error', `Socket error (${socket.id}): ${err.message}`);
  });
});

// ----------------------------------------------------------------------------
// Event handlers
// ----------------------------------------------------------------------------

async function handleJoinArena(socket: Socket, payload: unknown): Promise<void> {
  const data = getSocketData(socket);
  const identity = data.identity;
  if (!identity) return;

  if (!payload || typeof payload !== 'object') {
    socket.emit('join_error', { reason: 'invalid_arena' });
    return;
  }
  const arenaId = String((payload as { arenaId?: unknown }).arenaId || '');
  const arena = getArenaById(arenaId);
  if (!arena) {
    socket.emit('join_error', { reason: 'invalid_arena' });
    return;
  }

  // Already in a match? Reject.
  if (data.playerSession) {
    socket.emit('join_error', { reason: 'already_in_match' });
    return;
  }

  // Server-to-server: atomically deduct buyIn on the Next.js side.
  let joinResult;
  try {
    joinResult = await joinMatch(identity.userTag, arenaId);
  } catch (err) {
    log('error', `joinMatch fetch failed: ${(err as Error).message}`);
    socket.emit('join_error', { reason: 'invalid_arena' });
    return;
  }

  if (!joinResult.ok) {
    const reason = joinResult.reason;
    if (reason === 'insufficient_chips') {
      socket.emit('join_error', { reason: 'insufficient_chips' });
      return;
    }
    if (reason === 'banned') {
      socket.emit('join_error', { reason: 'banned' });
      socket.emit('kicked', { reason: 'Account banned' });
      socket.disconnect(true);
      return;
    }
    // Pass through the actual reason so the client shows the right message
    log('error', `joinMatch failed for ${identity.userTag} in ${arenaId}: reason=${reason}`);
    socket.emit('join_error', { reason: reason || 'server_error' });
    return;
  }

  // Spawn the player.
  const room = getOrCreateRoom(arenaId);
  if (!room) {
    socket.emit('join_error', { reason: 'invalid_arena' });
    return;
  }

  // Ensure bots exist (cap at arena.botsCount — won't over-spawn).
  ensureBots(room);

  const cfg = room.cfg;
  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const baseRadius = calcBaseMapRadius(Math.max(1, realPlayerCount), cfg);
  const spawn = findSafeSpawnPoint(room, baseRadius - 200, room.mapCenterX, room.mapCenterY);
  const angle = Math.random() * Math.PI * 2;
  const session: PlayerSession = {
    id: socket.id,
    name: identity.name,
    userTag: identity.userTag,
    country: identity.country,
    points: initialBody(spawn.x, spawn.y, angle, cfg.initialBodyLength, cfg.segmentSpacing),
    angle,
    size: calcVisualRadius(cfg.initialSpawnScore, cfg),
    color: identity.color,
    secondaryColor: identity.secondaryColor,
    isPlayer: true,
    isBot: false,
    carriedChips: room.arena.buyIn,
    score: cfg.initialSpawnScore,
    boostFrameCounter: 0,
    isExtracting: false,
    extractionProgress: 0,
    isDead: false,
    spawnProtectedUntil: Date.now() + cfg.spawnProtectionMs,
    identity,
    desiredAngle: angle,
    wantsBoost: false,
    kills: 0,
    joinedAt: Date.now(),
    lastInputAt: 0,
    inputDropCount: 0,
    lastChatAt: 0,
    arenaId,
    matchSettling: false,
  };

  room.players.set(socket.id, session);
  data.playerSession = session;

  socket.emit('joined', {
    arenaId,
    worldSize: WORLD_SIZE,
    yourId: socket.id,
  });

  log('info', `${identity.userTag} joined ${arenaId} (buyIn=${arena.buyIn})`);
}

/** Validate + rate-limit a client input packet. Server applies position; client only sends angle. */
function handleInput(socket: Socket, payload: unknown): void {
  const session = getSocketData(socket).playerSession;
  if (!session || session.isDead || session.matchSettling) return;

  if (!payload || typeof payload !== 'object') return;
  const obj = payload as { angle?: unknown; wantsBoost?: unknown };
  const angleRaw = obj.angle;
  const wantsBoostRaw = obj.wantsBoost;

  if (typeof angleRaw !== 'number' || !Number.isFinite(angleRaw)) return;
  if (typeof wantsBoostRaw !== 'boolean') return;

  // Normalize angle into [0, 2π).
  let angle = angleRaw;
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;

  // Rate-limit: max MAX_SNAPSHOTS_PER_SECOND per second.
  const now = Date.now();
  const delta = now - session.lastInputAt;
  if (delta < INPUT_MIN_INTERVAL_MS) {
    session.inputDropCount++;
    if (session.inputDropCount % 20 === 0) {
      log('warn', `${session.identity.userTag} input flood: ${session.inputDropCount} packets dropped`);
    }
    return;
  }
  session.lastInputAt = now;
  session.inputDropCount = 0;

  // ── Extraction steering detection ──
  // Forward gliding during extraction is allowed (natural movement).
  // BUT any intentional steering (angle change > threshold) restarts extraction.
  if (session.isExtracting) {
    let angleDiff = Math.abs(angle - session.angle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    const STEER_THRESHOLD = 0.08; // ~4.6 degrees — small but intentional steer
    if (angleDiff > STEER_THRESHOLD) {
      session.extractionProgress = 0;
      // Notify client so the UI shows the restart immediately
      socket.emit('extract_progress', { progress: 0 });
      socket.emit('extract_cancelled_by_steer', {});
    }
  }

  session.desiredAngle = angle;
  session.wantsBoost = wantsBoostRaw;
}

/** Start extraction. Validates the player is within the extract zone. */
function handleExtract(socket: Socket): void {
  const session = getSocketData(socket).playerSession;
  if (!session || session.isDead || session.matchSettling) return;
  if (session.isExtracting) return;

  // NO zone check — extract anywhere (matches original design).
  session.isExtracting = true;
  session.extractionProgress = 0;
  const room = session.arenaId ? rooms.get(session.arenaId) : null;
  socket.emit('extract_start', { durationMs: room?.cfg.extractionDurationMs ?? 3000 });
}

/** Cancel an in-progress extraction. */
function handleCancelExtract(socket: Socket): void {
  const session = getSocketData(socket).playerSession;
  if (!session) return;
  session.isExtracting = false;
  session.extractionProgress = 0;
}

/** Validate + rate-limit a chat message; broadcast to the room. */
function handleChat(socket: Socket, payload: unknown): void {
  const session = getSocketData(socket).playerSession;
  const identity = getSocketData(socket).identity;
  if (!session || !identity) return;
  if (!payload || typeof payload !== 'object') return;
  const raw = (payload as { message?: unknown }).message;
  if (typeof raw !== 'string') return;
  const message = raw.trim().slice(0, CHAT_MAX_LEN);
  if (message.length === 0) return;

  const now = Date.now();
  if (now - session.lastChatAt < CHAT_MIN_INTERVAL_MS) return;
  session.lastChatAt = now;

  session.chatMessage = message;
  session.chatExpiry = now + 4000;

  const room = session.arenaId ? rooms.get(session.arenaId) : null;
  if (!room) return;
  const chatPayload = {
    senderId: session.id,
    senderName: session.name,
    senderTag: session.userTag,
    message,
  };
  for (const socketId of room.players.keys()) {
    io.to(socketId).emit('chat', chatPayload);
  }
}

/** Remove a player from their arena; scatter carried chips as star-chips (no DB write). */
function handleLeave(socket: Socket, reason: string): void {
  const data = getSocketData(socket);
  const session = data.playerSession;
  if (!session) return;

  const room = session.arenaId ? rooms.get(session.arenaId) : null;
  if (room) {
    // Forfeit carried chips as 10 star collectibles at death position.
    if (!session.isDead && !session.matchSettling && session.carriedChips > 0) {
      try {
        dropStarsAtDeath(room, session.points[0]?.x ?? 0, session.points[0]?.y ?? 0, session.carriedChips);
      } catch (err) {
        log('error', `dropStarsAtDeath error on leave: ${(err as Error).message}`);
      }
    }
    room.players.delete(socket.id);
  }

  data.playerSession = undefined;
  log('info', `${session.identity.userTag} left arena ${session.arenaId ?? '?'} (${reason})`);
}

// ----------------------------------------------------------------------------
// Process-level guards (the OLD server had none → one bad write killed it)
// ----------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  log('error', `uncaughtException: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  log('error', `unhandledRejection: ${msg}`);
});

function gracefulShutdown(signal: string): void {
  log('info', `${signal} received — broadcasting server_shutdown and exiting`);
  try {
    io.emit('server_shutdown', {});
  } catch (err) {
    log('error', `shutdown broadcast failed: ${(err as Error).message}`);
  }
  // Give sockets a moment to flush, then exit.
  setTimeout(() => process.exit(0), 400);
  // Hard exit fallback if flush hangs.
  setTimeout(() => process.exit(1), 2000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// Log SIGHUP so we can diagnose if the sandbox is hanging up the process.
process.on('SIGHUP', () => {
  log('warn', 'SIGHUP received — ignoring (nohup-style)');
});
// Log SIGPIPE so we don't die silently if a socket write fails on a closed pipe.
process.on('SIGPIPE', () => {
  log('warn', 'SIGPIPE received — ignoring');
});

// Diagnostic: log when the event loop is about to drain. If bun decides to
// exit cleanly (no more refs), this tells us why.
process.on('beforeExit', (code) => {
  log('warn', `beforeExit code=${code} — event loop empty, process will exit`);
});
process.on('exit', (code) => {
  log('warn', `exit code=${code}`);
});

// Heartbeat: log every 15s so we can pinpoint when the process dies.
// Every 4th heartbeat (60s), clean up empty rooms (0 players AND 0 active bots).
let heartbeatCount = 0;
function heartbeat(): void {
  heartbeatCount++;
  log('info', `heartbeat — rooms=${rooms.size} players=${countPlayers()}`);

  // Cleanup: every 4th heartbeat (every ~60s)
  if (heartbeatCount % 4 === 0) {
    let cleaned = 0;
    for (const [key, room] of rooms) {
      if (room.players.size === 0 && room.bots.size === 0) {
        rooms.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log('info', `Cleaned up ${cleaned} empty arena room(s) — ${rooms.size} remaining`);
    }
  }

  setTimeout(heartbeat, 15000);
}
function countPlayers(): number {
  let n = 0;
  for (const room of rooms.values()) n += room.players.size;
  return n;
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------

log('warn', 'CORS is open (origin: *) — OK for dev (Caddy restricts in prod)');
log('info', `NEXT_APP_URL=${NEXT_APP_URL}  PORT=${PORT}`);

// Arenas are created lazily on first join_arena — no pre-creation.

// Start tick + broadcast loops.
setTimeout(tickOnce, TICK_MS);
setTimeout(broadcastOnce, BROADCAST_MS);
setTimeout(heartbeat, 15000);

httpServer.on('error', (err) => {
  log('error', `HTTP server error: ${err.message}`);
});
httpServer.listen(PORT, () => {
  log('info', `Game server listening on port ${PORT}`);
});
// Keep the process alive — Bun sometimes exits when no pending I/O refs.
setInterval(() => {}, 60000);
