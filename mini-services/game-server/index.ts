// ============================================================================
// Venom Game Server — Socket.IO Multiplayer Server
// Entry point: Port 3001
// Supports multiple arena shards, 1000 players/bots per shard.
// ============================================================================

import { createServer } from 'http';
import { Server } from 'socket.io';
import { ArenaRoom, type KillEvent } from './game-state';
import type { ArenaSnapshot, SkinRarity } from './shared';

// ─── Configuration ──────────────────────────────────────────────────────────

const PORT = 3001;
const TICK_INTERVAL_MS = Math.round(1000 / 30);  // 30Hz tick
const BROADCAST_INTERVAL_MS = Math.round(1000 / 20); // 20Hz broadcast
const ARENA_CLEANUP_INTERVAL_MS = 60000; // Clean empty arenas every 60s

// ─── Server Setup ───────────────────────────────────────────────────────────
// Use explicit HTTP server (bun requires this for Socket.IO to bind correctly)

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Performance tuning for 1000+ connections
  transports: ['websocket', 'polling'],
  perMessageDeflate: false,
});

httpServer.listen(PORT, '::', () => {
  console.log(`Venom Game Server listening on port ${PORT}`);
});

// ─── Arena Shards ────────────────────────────────────────────────────────────

const arenas: Map<string, ArenaRoom> = new Map();

/** Get or create an arena room by ID */
function getOrCreateArena(arenaId: string): ArenaRoom {
  let room = arenas.get(arenaId);
  if (!room) {
    room = new ArenaRoom(arenaId);
    arenas.set(arenaId, room);
    console.log(`[Arena] Created new arena shard: ${arenaId}`);
  }
  return room;
}

/** Periodically clean up empty arenas to free memory */
setInterval(() => {
  for (const [arenaId, arena] of arenas) {
    if (arena.isEmpty) {
      console.log(`[Arena] Cleaning up empty arena: ${arenaId}`);
      arenas.delete(arenaId);
    }
  }
}, ARENA_CLEANUP_INTERVAL_MS);

// ─── Auth Middleware ──────────────────────────────────────────────────────────

io.use((socket, next) => {
  const { token, arenaId } = socket.handshake.auth;

  // Basic validation: token must be non-empty string
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return next(new Error('Authentication required'));
  }

  // Arena ID must be provided
  if (!arenaId || typeof arenaId !== 'string' || arenaId.trim().length === 0) {
    return next(new Error('Arena ID required'));
  }

  // Store validated data on socket
  (socket.data as any).userId = token.trim();
  (socket.data as any).arenaId = arenaId.trim();

  next();
});

// ─── Connection Handling ────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const userId = (socket.data as any).userId as string;
  const arenaId = (socket.data as any).arenaId as string;

  console.log(`[Connect] socket=${socket.id} user=${userId} arena=${arenaId}`);

  // Get or create arena
  const arena = getOrCreateArena(arenaId);

  // Default player name from userId
  const playerName = userId.slice(0, 16);

  // Add player to arena
  const snake = arena.addPlayer(socket.id, playerName);

  // Send initial state snapshot
  const initSnapshot = arena.buildSnapshot();
  socket.emit('snapshot', serializeSnapshot(initSnapshot));

  // Send player's assigned snake ID
  socket.emit('init', {
    snakeId: snake.id,
    arenaId,
    tickRate: 30,
    broadcastRate: 20,
  });

  console.log(`[Join] user=${userId} snake=${snake.id} arena=${arenaId} players=${arena.playerCount} total=${arena.aliveCount}`);

  // ── Input Handling ──────────────────────────────────────────────────

  socket.on('input', (data: { targetAngle: number; boosting: boolean }) => {
    if (typeof data?.targetAngle !== 'number' || typeof data?.boosting !== 'boolean') return;
    arena.handleInput(socket.id, data.targetAngle, data.boosting);
  });

  // ── Respawn Request ────────────────────────────────────────────────

  socket.on('respawn', () => {
    const respawned = arena.respawnPlayer(socket.id);
    if (respawned) {
      const respawnSnapshot = arena.buildSnapshot();
      socket.emit('snapshot', serializeSnapshot(respawnSnapshot));
      socket.emit('respawned', { snakeId: respawned.id });
      console.log(`[Respawn] user=${userId} snake=${respawned.id}`);
    }
  });

  // ── Skin Change ────────────────────────────────────────────────────

  socket.on('setSkin', (data: { skinId: string; rarity: SkinRarity }) => {
    const s = arena.snakes.get(socket.id);
    if (s) {
      s.skinId = data.skinId;
      s.rarity = data.rarity;
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    console.log(`[Disconnect] socket=${socket.id} user=${userId} arena=${arenaId} reason=${reason}`);
    const killEvent = arena.removePlayer(socket.id);
    if (killEvent) {
      // Broadcast the leave/kill to remaining players
      arena.pendingKills = [];
    }
    console.log(`[Leave] arena=${arenaId} players=${arena.playerCount} total=${arena.aliveCount}`);
  });
});

// ─── Snapshot Serialization ──────────────────────────────────────────────────

/** Serialize ArenaSnapshot for network transport (Float32Array → Array) */
function serializeSnapshot(snapshot: ArenaSnapshot): object {
  return {
    tick: snapshot.tick,
    timestamp: snapshot.timestamp,
    snakes: snapshot.snakes.map(s => ({
      ...s,
      bodyX: Array.from(s.bodyX),
      bodyY: Array.from(s.bodyY),
    })),
    foods: snapshot.foods,
    starChips: snapshot.starChips,
    extraction: snapshot.extraction,
  };
}

// ─── Main Game Loop ──────────────────────────────────────────────────────────

let lastBroadcast = 0;

// 30Hz tick loop
setInterval(() => {
  const now = Date.now();

  for (const [arenaId, arena] of arenas) {
    // Run game tick
    arena.tick();

    // Broadcast at 20Hz (every 1-2 ticks at 30Hz)
    if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
      const snapshot = arena.buildSnapshot();
      const serialized = serializeSnapshot(snapshot);

      // Send snapshot to all players in this arena
      for (const [, snake] of arena.snakes) {
        if (!snake.isPlayer || !snake.alive) continue;
        const socket = io.sockets.sockets.get(snake.socketId);
        if (socket) {
          socket.emit('snapshot', serialized);
        }
      }

      // Broadcast kill events
      for (const kill of arena.pendingKills) {
        const killMsg = {
          type: 'kill',
          killer: kill.killer,
          killerName: kill.killerName,
          victim: kill.victim,
          victimName: kill.victimName,
          score: kill.score,
        };
        for (const [, snake] of arena.snakes) {
          if (!snake.isPlayer || !snake.alive) continue;
          const socket = io.sockets.sockets.get(snake.socketId);
          if (socket) {
            socket.emit('kill', killMsg);
          }
        }
      }
      arena.pendingKills = [];
    }
  }

  if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
    lastBroadcast = now;
  }
}, TICK_INTERVAL_MS);

// ─── Server Start ────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║          Venom Game Server — Multiplayer             ║');
console.log('║  Port: 3001 | Tick: 30Hz | Broadcast: 20Hz          ║');
console.log('║  Bots: 20/shard | Tick: 30Hz | Broadcast: 20Hz           ║',);
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`Venom Game Server running on port ${PORT}`);
