// index.ts
import { createServer } from "http";
import { Server } from "socket.io";

// shared.ts
import {
  createSnake,
  findSafeSpawn,
  moveSnake,
  makeFood,
  spawnFoodBatch,
  checkFoodEating,
  checkCollisions,
  killSnake,
  respawnBots,
  checkStarChips,
  spawnStarChip,
  buildSnakeSnapshot,
  buildArenaSnapshot,
  BOT_NAMES,
  SNAKE_PALETTES,
  FOOD_SIZES,
  SPACING_RATIO,
  BOOST_MIN_BODY_SCALED,
  COLLISION_DIST_SQ,
  STAR_CHIP_DIST_SQ,
  MAGNET_PULL_DIST_SQ,
  MAGNET_DEATH_DIST_SQ
} from "../../src/lib/snake/core";
import {
  BASE_SPEED,
  BOOST_SPEED,
  SEGMENT_SPACING,
  START_LENGTH,
  computeBodyLength,
  computeBodyRadius,
  INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH,
  FOOD_DOWNSAMPLE_RADIUS,
  MAX_SNAKES_PER_SNAPSHOT,
  SNAKE_RADIUS,
  SPAWN_PROTECTION_MS,
  SPATIAL_CELL_SIZE,
  BOOST_DROP_INTERVAL,
  BOOST_MIN_BODY,
  BOOST_MIN_SCORE,
  BOOST_DROP_COUNT,
  BOT_COUNT,
  BOT_MAX_TURN_RATE,
  BOT_START_SCORE_MIN,
  BOT_START_SCORE_MAX,
  SAFE_SPAWN_DIST,
  SAFE_SPAWN_ATTEMPTS,
  EXTRACTION_ZONE_RADIUS,
  EXTRACTION_SCORE_THRESHOLD,
  EXTRACTION_SPEED_BONUS,
  STAR_CHIP_SPAWN_INTERVAL
} from "../../src/lib/snake/config";
import { distSq, angleDirect } from "../../src/lib/snake/vec2";
import { getBotTarget } from "../../src/lib/snake/bot-ai";
import { PathBuffer } from "../../src/lib/snake/pool";
import { SpatialHash } from "../../src/lib/snake/spatial-hash";
var ARENA_RADIUS = 5e3;
var FOOD_COUNT_TARGET = 500;
var FOOD_SPAWN_AREA_RADIUS = 4e3;
var EXTRACTION_ZONE_DURATION = 6e4;
var EXTRACTION_ZONE_SPAWN_INTERVAL = 12e4;
var SERVER_BOT_COUNT = 20;

// game-state.ts
var ArenaRoom = class {
  id;
  snakes = /* @__PURE__ */ new Map();
  foods = [];
  starChips = [];
  tickCount = 0;
  extractionZone;
  /** Kill events generated this tick (broadcasted by index.ts) */
  pendingKills = [];
  /** Track the extraction zone timer */
  lastExtractionSpawn = 0;
  // Spatial hashes reused each tick
  foodHash = new SpatialHash(SPATIAL_CELL_SIZE);
  bodyHash = new SpatialHash(SPATIAL_CELL_SIZE);
  headHash = new SpatialHash(SPATIAL_CELL_SIZE);
  scratch = { x: 0, y: 0, radius: 0, id: 0 };
  foodValueCache = /* @__PURE__ */ new Map();
  // Ref wrappers for core functions that take { value: number }
  nextFoodIdRef = { value: 0 };
  nextStarChipIdRef = { value: 0 };
  constructor(id) {
    this.id = id;
    this.extractionZone = {
      x: 0,
      y: 0,
      radius: EXTRACTION_ZONE_RADIUS,
      active: false,
      activatedAt: 0
    };
    this.lastExtractionSpawn = Date.now();
    this.initArena();
  }
  // ── Initialization ────────────────────────────────────────────────────
  initArena() {
    const now = Date.now();
    for (let i = 0; i < SERVER_BOT_COUNT; i++) {
      const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
      const nameIdx = i % BOT_NAMES.length;
      const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : "";
      const pos = findSafeSpawn(this.snakes, 0, 0);
      const base = createSnake(`bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos.x, pos.y, true, now);
      const serverBot = {
        ...base,
        socketId: "",
        input: { targetAngle: base.angle, boosting: false },
        lastSnapshot: null
      };
      this.snakes.set(serverBot.id, serverBot);
    }
    spawnFoodBatch(this.nextFoodIdRef, this.foods, FOOD_COUNT_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);
  }
  // ── Player Management ─────────────────────────────────────────────────
  addPlayer(socketId, name, skinId = "skin-default", rarity = "common") {
    const now = Date.now();
    const pos = findSafeSpawn(this.snakes, 0, 0);
    const base = createSnake(socketId, name, 0, pos.x, pos.y, false, now);
    const serverSnake = {
      ...base,
      skinId,
      rarity,
      socketId,
      input: { targetAngle: base.angle, boosting: false },
      lastSnapshot: null
    };
    this.snakes.set(serverSnake.id, serverSnake);
    return serverSnake;
  }
  removePlayer(socketId) {
    const snake = this.snakes.get(socketId);
    if (!snake) return null;
    if (snake.alive) {
      killSnake(snake, this.nextFoodIdRef, this.foods);
      this.pendingKills.push({
        killer: "arena",
        killerName: "Arena",
        victim: snake.id,
        victimName: snake.name,
        score: snake.score,
        timestamp: Date.now()
      });
    }
    this.snakes.delete(socketId);
    return this.pendingKills.length > 0 ? this.pendingKills.pop() ?? null : null;
  }
  handleInput(socketId, targetAngle, boosting) {
    const snake = this.snakes.get(socketId);
    if (!snake || !snake.alive) return;
    snake.input.targetAngle = targetAngle;
    snake.input.boosting = boosting;
  }
  // ── Main Game Tick ────────────────────────────────────────────────────
  tick() {
    this.tickCount++;
    const now = Date.now();
    this.pendingKills = [];
    const moveCtx = {
      foods: this.foods,
      nextFoodId: this.nextFoodIdRef,
      extractionZone: this.extractionZone.active ? this.extractionZone : void 0
    };
    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      if (snake.isBot) {
        const botAngle = getBotTarget(snake, this.snakes, this.foods);
        moveSnake(snake, botAngle, false, now, moveCtx);
      } else {
        moveSnake(snake, snake.input.targetAngle, snake.input.boosting, now, moveCtx);
      }
    }
    const eatenIds = checkFoodEating(
      this.snakes.values(),
      this.foods,
      this.foodHash,
      this.foodValueCache,
      now
    );
    if (eatenIds.size > 0) {
      for (let i = this.foods.length - 1; i >= 0; i--) {
        if (eatenIds.has(this.foods[i].id)) {
          this.foods[i] = this.foods[this.foods.length - 1];
          this.foods.length--;
        }
      }
    }
    const collectedIds = checkStarChips(this.snakes.values(), this.starChips);
    if (collectedIds.size > 0) {
      for (let i = this.starChips.length - 1; i >= 0; i--) {
        if (collectedIds.has(this.starChips[i].id)) {
          this.starChips[i] = this.starChips[this.starChips.length - 1];
          this.starChips.length--;
        }
      }
    }
    if (this.foods.length < FOOD_COUNT_TARGET) {
      const deficit = FOOD_COUNT_TARGET - this.foods.length;
      const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);
      const playerPositions = [];
      for (const [, s] of this.snakes) {
        if (s.alive && !s.isBot && s.path.length > 0) {
          playerPositions.push({ x: s.path.headX, y: s.path.headY });
        }
      }
      if (playerPositions.length > 0) {
        const perPlayer = Math.ceil(batch / playerPositions.length);
        for (const pos of playerPositions) {
          const count = Math.min(perPlayer, batch);
          spawnFoodBatch(this.nextFoodIdRef, this.foods, count, pos.x, pos.y, FOOD_SPAWN_AREA_RADIUS);
        }
      } else {
        const alive = [];
        for (const [, s] of this.snakes) {
          if (s.alive && s.path.length > 0) alive.push(s);
        }
        if (alive.length > 0) {
          const rs = alive[Math.floor(Math.random() * alive.length)];
          spawnFoodBatch(this.nextFoodIdRef, this.foods, batch, rs.path.headX, rs.path.headY, FOOD_SPAWN_AREA_RADIUS);
        }
      }
    }
    this.manageExtractionZone(now);
    if (this.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
      const chip = spawnStarChip(this.nextStarChipIdRef, this.extractionZone, now);
      if (chip) this.starChips.push(chip);
    }
    const collisionResult = checkCollisions(
      this.snakes,
      this.bodyHash,
      this.headHash,
      this.scratch,
      now
    );
    for (const deadId of collisionResult.deadIds) {
      const snake = this.snakes.get(deadId);
      if (snake) {
        killSnake(snake, this.nextFoodIdRef, this.foods);
        if (snake.isBot) this.snakes.delete(deadId);
      }
    }
    for (const ke of collisionResult.killEvents) {
      this.pendingKills.push({
        killer: ke.killerId,
        killerName: ke.killerName,
        victim: ke.victimId,
        victimName: ke.victimName,
        score: ke.score,
        timestamp: ke.timestamp
      });
    }
    const newBots = respawnBots(
      this.snakes,
      SERVER_BOT_COUNT,
      this.tickCount,
      now
    );
    for (const bot of newBots) {
      const serverBot = {
        ...bot,
        socketId: "",
        input: { targetAngle: bot.angle, boosting: false },
        lastSnapshot: null
      };
      this.snakes.set(serverBot.id, serverBot);
    }
    this.enforceArenaBounds(now);
  }
  // ── Extraction Zone (online-only) ──────────────────────────────────────
  manageExtractionZone(now) {
    const ez = this.extractionZone;
    if (!ez.active) {
      if (now - this.lastExtractionSpawn >= EXTRACTION_ZONE_SPAWN_INTERVAL) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * ARENA_RADIUS * 0.5;
        ez.x = Math.cos(a) * d;
        ez.y = Math.sin(a) * d;
        ez.radius = EXTRACTION_ZONE_RADIUS;
        ez.active = true;
        ez.activatedAt = now;
        this.lastExtractionSpawn = now;
      }
    } else {
      if (now - ez.activatedAt >= EXTRACTION_ZONE_DURATION) {
        ez.active = false;
        this.starChips = [];
      }
    }
  }
  // ── Arena Boundary Enforcement (online-only) ──────────────────────────
  enforceArenaBounds(now) {
    const radiusSq = ARENA_RADIUS * ARENA_RADIUS;
    const DOT_DIST = 0.75;
    for (const [, snake] of this.snakes) {
      if (!snake.alive || snake.path.length === 0) continue;
      const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * DOT_DIST;
      const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * DOT_DIST;
      const distFromCenter = dotX * dotX + dotY * dotY;
      if (distFromCenter > radiusSq) {
        if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
        killSnake(snake, this.nextFoodIdRef, this.foods);
        this.pendingKills.push({
          killer: "boundary",
          killerName: "Boundary",
          victim: snake.id,
          victimName: snake.name,
          score: snake.score,
          timestamp: Date.now()
        });
        if (snake.isBot) this.snakes.delete(snake.id);
      }
    }
  }
  // ── Snapshot Builder ──────────────────────────────────────────────────
  buildSnapshot() {
    const snapshot = buildArenaSnapshot(
      this.snakes,
      this.foods,
      this.starChips,
      this.tickCount,
      this.extractionZone
    );
    for (const snakeSnap of snapshot.snakes) {
      const snake = this.snakes.get(snakeSnap.id);
      if (snake) snake.lastSnapshot = snakeSnap;
    }
    return snapshot;
  }
  // ── Respawn Player ────────────────────────────────────────────────────
  respawnPlayer(socketId) {
    const old = this.snakes.get(socketId);
    let savedSkinId = "skin-default";
    let savedRarity = "common";
    let savedName = "Player";
    if (old) {
      savedSkinId = old.skinId;
      savedRarity = old.rarity;
      savedName = old.name;
      if (old.alive) {
        killSnake(old, this.nextFoodIdRef, this.foods);
      }
      this.snakes.delete(socketId);
    }
    const now = Date.now();
    const pos = findSafeSpawn(this.snakes, 0, 0);
    const base = createSnake(socketId, savedName, 0, pos.x, pos.y, false, now);
    const serverSnake = {
      ...base,
      skinId: savedSkinId,
      rarity: savedRarity,
      socketId,
      input: { targetAngle: base.angle, boosting: false },
      lastSnapshot: null
    };
    this.snakes.set(serverSnake.id, serverSnake);
    return serverSnake;
  }
  // ── Utility ──────────────────────────────────────────────────────────
  /** Get player count (non-bot alive snakes) */
  get playerCount() {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive && s.isPlayer) count++;
    }
    return count;
  }
  /** Get total alive count */
  get aliveCount() {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive) count++;
    }
    return count;
  }
  /** Check if arena is empty (no players) */
  get isEmpty() {
    for (const [, s] of this.snakes) {
      if (s.isPlayer) return false;
    }
    return true;
  }
};

// index.ts
var PORT = 3001;
var TICK_INTERVAL_MS = Math.round(1e3 / 30);
var BROADCAST_INTERVAL_MS = Math.round(1e3 / 20);
var ARENA_CLEANUP_INTERVAL_MS = 6e4;
var httpServer = createServer();
var io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Performance tuning for 1000+ connections
  transports: ["websocket", "polling"],
  perMessageDeflate: false
});
httpServer.listen(PORT, "::", () => {
  console.log(`Venom Game Server listening on port ${PORT}`);
});
var arenas = /* @__PURE__ */ new Map();
function getOrCreateArena(arenaId) {
  let room = arenas.get(arenaId);
  if (!room) {
    room = new ArenaRoom(arenaId);
    arenas.set(arenaId, room);
    console.log(`[Arena] Created new arena shard: ${arenaId}`);
  }
  return room;
}
setInterval(() => {
  for (const [arenaId, arena] of arenas) {
    if (arena.isEmpty) {
      console.log(`[Arena] Cleaning up empty arena: ${arenaId}`);
      arenas.delete(arenaId);
    }
  }
}, ARENA_CLEANUP_INTERVAL_MS);
io.use((socket, next) => {
  const { token, arenaId } = socket.handshake.auth;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return next(new Error("Authentication required"));
  }
  if (!arenaId || typeof arenaId !== "string" || arenaId.trim().length === 0) {
    return next(new Error("Arena ID required"));
  }
  socket.data.userId = token.trim();
  socket.data.arenaId = arenaId.trim();
  next();
});
io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const arenaId = socket.data.arenaId;
  console.log(`[Connect] socket=${socket.id} user=${userId} arena=${arenaId}`);
  const arena = getOrCreateArena(arenaId);
  const playerName = userId.slice(0, 16);
  const snake = arena.addPlayer(socket.id, playerName);
  const initSnapshot = arena.buildSnapshot();
  socket.emit("snapshot", serializeSnapshot(initSnapshot));
  socket.emit("init", {
    snakeId: snake.id,
    arenaId,
    tickRate: 30,
    broadcastRate: 20
  });
  console.log(`[Join] user=${userId} snake=${snake.id} arena=${arenaId} players=${arena.playerCount} total=${arena.aliveCount}`);
  socket.on("input", (data) => {
    if (typeof data?.targetAngle !== "number" || typeof data?.boosting !== "boolean") return;
    arena.handleInput(socket.id, data.targetAngle, data.boosting);
  });
  socket.on("respawn", () => {
    const respawned = arena.respawnPlayer(socket.id);
    if (respawned) {
      const respawnSnapshot = arena.buildSnapshot();
      socket.emit("snapshot", serializeSnapshot(respawnSnapshot));
      socket.emit("respawned", { snakeId: respawned.id });
      console.log(`[Respawn] user=${userId} snake=${respawned.id}`);
    }
  });
  socket.on("setSkin", (data) => {
    const s = arena.snakes.get(socket.id);
    if (s) {
      s.skinId = data.skinId;
      s.rarity = data.rarity;
    }
  });
  socket.on("disconnect", (reason) => {
    console.log(`[Disconnect] socket=${socket.id} user=${userId} arena=${arenaId} reason=${reason}`);
    const killEvent = arena.removePlayer(socket.id);
    if (killEvent) {
      arena.pendingKills = [];
    }
    console.log(`[Leave] arena=${arenaId} players=${arena.playerCount} total=${arena.aliveCount}`);
  });
});
function serializeSnapshot(snapshot) {
  return {
    tick: snapshot.tick,
    timestamp: snapshot.timestamp,
    snakes: snapshot.snakes.map((s) => ({
      ...s,
      bodyX: Array.from(s.bodyX),
      bodyY: Array.from(s.bodyY)
    })),
    foods: snapshot.foods,
    starChips: snapshot.starChips,
    extraction: snapshot.extraction
  };
}
var lastBroadcast = 0;
setInterval(() => {
  const now = Date.now();
  for (const [arenaId, arena] of arenas) {
    arena.tick();
    if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
      const snapshot = arena.buildSnapshot();
      const serialized = serializeSnapshot(snapshot);
      for (const [, snake] of arena.snakes) {
        if (!snake.isPlayer || !snake.alive) continue;
        const socket = io.sockets.sockets.get(snake.socketId);
        if (socket) {
          socket.emit("snapshot", serialized);
        }
      }
      for (const kill of arena.pendingKills) {
        const killMsg = {
          type: "kill",
          killer: kill.killer,
          killerName: kill.killerName,
          victim: kill.victim,
          victimName: kill.victimName,
          score: kill.score
        };
        for (const [, snake] of arena.snakes) {
          if (!snake.isPlayer || !snake.alive) continue;
          const socket = io.sockets.sockets.get(snake.socketId);
          if (socket) {
            socket.emit("kill", killMsg);
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
console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
console.log("\u2551          Venom Game Server \u2014 Multiplayer             \u2551");
console.log("\u2551  Port: 3001 | Tick: 30Hz | Broadcast: 20Hz          \u2551");
console.log("\u2551  Bots: 20/shard | Tick: 30Hz | Broadcast: 20Hz           \u2551");
console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
console.log(`Venom Game Server running on port ${PORT}`);
