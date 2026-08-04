// ============================================================================
// Venom Arena — Game Server (Socket.IO on port 3001)
// Handles auth, arena routing, sharding, tick loop, and snapshot broadcast.
// ============================================================================

import { Server, Socket } from 'socket.io';
import { ArenaRoom } from './game-state';
import { getArenaById } from '../../src/lib/game-config';
import { DEFAULT_SNAKE_CONFIG } from '../../src/lib/snake/config';
import type { SnakeIdentity, KillFeedEntry } from '../../src/lib/snake/types';

// ── Server Setup ─────────────────────────────────────────────────────────────

const PORT = 3001;

const io = new Server(PORT, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

console.log(`[Venom Arena] Game server listening on port ${PORT}`);

// ── Room Management ──────────────────────────────────────────────────────────

const rooms = new Map<string, ArenaRoom>();

/** Wire Socket.IO emit callbacks onto a room so it can broadcast events. */
function wireRoomCallbacks(room: ArenaRoom, roomKey: string): void {
  room.onKillFeed = (entry: KillFeedEntry) => {
    io.to(roomKey).emit('kill_feed', entry);
  };

  room.onPlayerDied = (socketId: string, data: any) => {
    io.to(socketId).emit('player_died', data);
  };

  room.onExtractionComplete = (socketId: string, data: any) => {
    io.to(socketId).emit('extraction_complete', data);
  };
}

/**
 * Get or create an arena room. NEVER returns null.
 * Returns [room, roomKey] so the caller knows which socket.io room to join.
 * Auto-shards when the base room hits 1000 players.
 */
function getOrCreateRoom(arenaId: string): [ArenaRoom, string] {
  // Check existing base room
  const base = rooms.get(arenaId);
  if (base && base.snakes.size < DEFAULT_SNAKE_CONFIG.maxArenaPlayers) {
    return [base, arenaId];
  }

  // Base room full or exists — check shards
  if (base) {
    let shardNum = 1;
    while (true) {
      const shardKey = `${arenaId}-shard${shardNum}`;
      const shard = rooms.get(shardKey);
      if (shard && shard.snakes.size < DEFAULT_SNAKE_CONFIG.maxArenaPlayers) {
        return [shard, shardKey];
      }
      if (!shard) {
        // Create new shard
        const arena = getArenaById(arenaId);
        const newRoom = new ArenaRoom(
          shardKey,
          shardNum,
          arena?.name ?? arenaId,
          arena?.isPractice ?? false,
          arena?.rewardMultiplier ?? 1.0,
        );
        rooms.set(shardKey, newRoom);
        wireRoomCallbacks(newRoom, shardKey);
        console.log(`[Venom Arena] Created shard ${shardKey} (${arena?.name ?? arenaId})`);
        return [newRoom, shardKey];
      }
      shardNum++;
    }
  }

  // Room doesn't exist — auto-create (FIXES 'arena does not exist' bug)
  const arena = getArenaById(arenaId);
  const isPractice = arena?.isPractice ?? false;
  const rewardMultiplier = arena?.rewardMultiplier ?? 1.0;
  const name = arena?.name ?? arenaId;

  const room = new ArenaRoom(arenaId, 0, name, isPractice, rewardMultiplier);
  rooms.set(arenaId, room);
  wireRoomCallbacks(room, arenaId);
  console.log(`[Venom Arena] Auto-created room ${arenaId} (${name})`);
  return [room, arenaId];
}

// ── Auth Middleware ───────────────────────────────────────────────────────────

io.use(async (socket, next) => {
  const token = socket.auth?.token;
  if (!token) {
    return next(new Error('No auth token provided'));
  }

  try {
    // Verify JWT via Next.js API
    const res = await fetch('/api/match/verify?XTransformPort=3000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      return next(new Error('Invalid token'));
    }

    const data = await res.json();
    (socket as any).user = data.user;
    next();
  } catch (err: any) {
    console.error(`[Auth] Verification failed: ${err.message}`);
    next(new Error('Auth verification failed'));
  }
});

// ── Connection ───────────────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[Venom Arena] Socket connected: ${socket.id}`);

  let currentRoom: ArenaRoom | null = null;
  let currentRoomKey: string | null = null;

  // ── join_arena ────────────────────────────────────────────────────────────
  socket.on('join_arena', (data: { arenaId: string; identity: SnakeIdentity }) => {
    const { arenaId, identity } = data;

    const [room, roomKey] = getOrCreateRoom(arenaId);
    currentRoom = room;
    currentRoomKey = roomKey;

    // Join the socket.io room for broadcasting
    socket.join(roomKey);

    // Add player to room
    room.addPlayer(socket.id, identity);

    // Send arena_joined
    socket.emit('arena_joined', {
      mapRadius: room.map.baseRadius,
      commissionRate: room.commissionRate,
      playerCount: room.realPlayerCount,
    });

    console.log(`[Venom Arena] ${identity.name} joined ${room.name} (${roomKey}, players: ${room.realPlayerCount})`);
  });

  // ── input ─────────────────────────────────────────────────────────────────
  socket.on('input', (data: { angle: number; boosting: boolean; extracting: boolean }) => {
    if (!currentRoom) return;

    currentRoom.handleInput(socket.id, {
      targetAngle: data.angle,
      boosting: data.boosting,
      extracting: data.extracting,
      emoteKey: null,
    });

    // Handle extraction toggle
    currentRoom.handleExtractionToggle(socket.id, data.extracting);
  });

  // ── emote ─────────────────────────────────────────────────────────────────
  socket.on('emote', (data: { emote: string }) => {
    if (!currentRoom) return;
    const emoteKeyMap: Record<string, number> = {
      gg: 1, target: 2, flee: 3, ripped: 4, extracting: 5,
    };
    const key = emoteKeyMap[data.emote];
    if (key !== undefined) {
      currentRoom.handleEmote(socket.id, key);
    }
  });

  // ── ping / pong ───────────────────────────────────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[Venom Arena] Socket disconnected: ${socket.id} (${reason})`);
    if (currentRoom && currentRoomKey) {
      currentRoom.removePlayer(socket.id);
      socket.leave(currentRoomKey);
      currentRoom = null;
      currentRoomKey = null;
    }
  });
});

// ── Tick Loop (30Hz) ─────────────────────────────────────────────────────────

const TICK_MS = 1000 / DEFAULT_SNAKE_CONFIG.tickRateHz;

setInterval(() => {
  for (const [, room] of rooms) {
    room.tick();
  }
}, TICK_MS);

// ── Broadcast Loop (20Hz) ────────────────────────────────────────────────────

const BROADCAST_MS = 1000 / DEFAULT_SNAKE_CONFIG.broadcastRateHz;

setInterval(() => {
  for (const [, room] of rooms) {
    if (room.socketSnakeMap.size === 0) continue;

    // Per-player snapshot (each player gets their own view)
    for (const [socketId, snakeId] of room.socketSnakeMap) {
      const snapshot = room.getSnapshot(snakeId);
      io.to(socketId).emit('snapshot', snapshot);
    }
  }
}, BROADCAST_MS);

// ── Cleanup Empty Rooms (every 60s) ──────────────────────────────────────────

setInterval(() => {
  for (const [key, room] of rooms) {
    // Keep rooms with at least one real player OR active bots
    if (room.socketSnakeMap.size === 0) {
      rooms.delete(key);
      console.log(`[Venom Arena] Cleaned up empty room: ${key}`);
    }
  }
}, 60000);

// ── Graceful Shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('[Venom Arena] Shutting down...');
  io.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Venom Arena] Shutting down...');
  io.close();
  process.exit(0);
});
