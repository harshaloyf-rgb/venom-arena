// ============================================================================
// ArenaRoom — Core Game Simulation for one arena shard.
// Uses its OWN game logic from shared.ts (ONLINE ONLY — no shared core).
// Online-specific: player management, arena bounds, extraction zone timing,
// count-based food spawning, snapshot broadcasting.
// ============================================================================

import {
  // Types
  type FoodOrb, type StarChip, type SnakeSnapshot, type ArenaSnapshot,
  type SnakeLike, type MoveContext, type SkinRarity,
  // Core engine functions
  createSnake, findSafeSpawn, moveSnake,
  spawnFoodBatch,
  checkFoodEating, checkCollisions, killSnake, respawnBots,
  checkStarChips, spawnStarChip,
  buildArenaSnapshot,
  // Config
  ARENA_RADIUS, INITIAL_SPAWN_RADIUS, FOOD_COUNT_TARGET, FOOD_SPAWN_AREA_RADIUS,
  FOOD_RESPAWN_BATCH,
  SNAKE_RADIUS, SPAWN_PROTECTION_MS, SPATIAL_CELL_SIZE,
  BOT_MAX_TURN_RATE, BOT_START_SCORE_MIN, BOT_START_SCORE_MAX,
  STAR_CHIP_SPAWN_INTERVAL,
  EXTRACTION_ZONE_RADIUS, EXTRACTION_SCORE_THRESHOLD,
  EXTRACTION_ZONE_DURATION, EXTRACTION_ZONE_SPAWN_INTERVAL,
  // Server-specific config
  SERVER_BOT_COUNT,
  // Utilities
  getBotTarget, type BotSnakeInput,
  // Data structures
  SpatialHash, type SpatialEntity,
  // Constants from core
  BOT_NAMES,
} from './shared';

// ─── ServerSnake ─────────────────────────────────────────────────────────────

/** Server-side snake: core SnakeLike + network-specific fields */
export interface ServerSnake extends SnakeLike {
  /** Socket.IO socket ID for networked players (empty string for bots) */
  socketId: string;
  /** Queued player input (overwritten each time input arrives) */
  input: { targetAngle: number; boosting: boolean };
  /** Cached last snapshot (set during buildSnapshot) */
  lastSnapshot: SnakeSnapshot | null;
}

// ─── Kill Event (server format consumed by index.ts) ─────────────────────────

export interface KillEvent {
  killer: string;
  killerName: string;
  victim: string;
  victimName: string;
  score: number;
  timestamp: number;
}

// ─── ArenaRoom ───────────────────────────────────────────────────────────────

export class ArenaRoom {
  id: string;
  snakes: Map<string, ServerSnake> = new Map();
  foods: FoodOrb[] = [];
  starChips: StarChip[] = [];
  tickCount = 0;
  extractionZone: { x: number; y: number; radius: number; active: boolean; activatedAt: number };
  /** Kill events generated this tick (broadcasted by index.ts) */
  pendingKills: KillEvent[] = [];
  /** Track the extraction zone timer */
  private lastExtractionSpawn = 0;

  // Spatial hashes reused each tick
  private foodHash: SpatialHash = new SpatialHash(SPATIAL_CELL_SIZE);
  private bodyHash: SpatialHash = new SpatialHash(SPATIAL_CELL_SIZE);
  private headHash: SpatialHash = new SpatialHash(SPATIAL_CELL_SIZE);
  private scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
  private foodValueCache: Map<number, number> = new Map();

  // Ref wrappers for core functions that take { value: number }
  private nextFoodIdRef = { value: 0 };
  private nextStarChipIdRef = { value: 0 };

  constructor(id: string) {
    this.id = id;
    this.extractionZone = {
      x: 0, y: 0, radius: EXTRACTION_ZONE_RADIUS,
      active: false, activatedAt: 0,
    };
    this.lastExtractionSpawn = Date.now();
    this.initArena();
  }

  // ── Initialization ────────────────────────────────────────────────────

  private initArena(): void {
    const now = Date.now();

    // Spawn bots
    for (let i = 0; i < SERVER_BOT_COUNT; i++) {
      const score = Math.floor(BOT_START_SCORE_MIN + Math.random() * (BOT_START_SCORE_MAX - BOT_START_SCORE_MIN));
      const nameIdx = i % BOT_NAMES.length;
      const nameSuffix = i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : '';
      const pos = findSafeSpawn(this.snakes as unknown as Map<string, SnakeLike>, 0, 0);
      const base = createSnake(`bot-${i}`, BOT_NAMES[nameIdx] + nameSuffix, score, pos.x, pos.y, true, now);
      const serverBot: ServerSnake = {
        ...base,
        socketId: '',
        input: { targetAngle: base.angle, boosting: false },
        lastSnapshot: null,
      };
      this.snakes.set(serverBot.id, serverBot);
    }

    // Spawn initial food
    spawnFoodBatch(this.nextFoodIdRef, this.foods, FOOD_COUNT_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);
  }

  // ── Player Management ─────────────────────────────────────────────────

  addPlayer(socketId: string, name: string, skinId: string = 'skin-default', rarity: SkinRarity = 'common'): ServerSnake {
    const now = Date.now();
    const pos = findSafeSpawn(this.snakes as unknown as Map<string, SnakeLike>, 0, 0);
    const base = createSnake(socketId, name, 0, pos.x, pos.y, false, now);
    const serverSnake: ServerSnake = {
      ...base,
      skinId,
      rarity,
      socketId,
      input: { targetAngle: base.angle, boosting: false },
      lastSnapshot: null,
    };
    this.snakes.set(serverSnake.id, serverSnake);
    return serverSnake;
  }

  removePlayer(socketId: string): KillEvent | null {
    const snake = this.snakes.get(socketId);
    if (!snake) return null;
    if (snake.alive) {
      killSnake(snake, this.nextFoodIdRef, this.foods);
      this.pendingKills.push({
        killer: 'arena', killerName: 'Arena',
        victim: snake.id, victimName: snake.name,
        score: snake.score, timestamp: Date.now(),
      });
    }
    this.snakes.delete(socketId);
    return this.pendingKills.length > 0 ? this.pendingKills.pop() ?? null : null;
  }

  handleInput(socketId: string, targetAngle: number, boosting: boolean): void {
    const snake = this.snakes.get(socketId);
    if (!snake || !snake.alive) return;
    snake.input.targetAngle = targetAngle;
    snake.input.boosting = boosting;
  }

  // ── Main Game Tick ────────────────────────────────────────────────────

  tick(): void {
    this.tickCount++;
    const now = Date.now();
    this.pendingKills = [];

    // Build MoveContext (shared across all snakes this tick)
    const moveCtx: MoveContext = {
      foods: this.foods,
      nextFoodId: this.nextFoodIdRef,
      extractionZone: this.extractionZone.active ? this.extractionZone : undefined,
    };

    // 1. Move all snakes (bots + players)
    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      if (snake.isBot) {
        const botAngle = getBotTarget(snake, this.snakes as unknown as Map<string, BotSnakeInput>, this.foods);
        moveSnake(snake, botAngle, false, now, moveCtx);
      } else {
        moveSnake(snake, snake.input.targetAngle, snake.input.boosting, now, moveCtx);
      }
    }

    // 2. Food eating
    const eatenIds = checkFoodEating(
      this.snakes.values(), this.foods,
      this.foodHash, this.foodValueCache, now,
    );
    if (eatenIds.size > 0) {
      // Swap-remove eaten food
      for (let i = this.foods.length - 1; i >= 0; i--) {
        if (eatenIds.has(this.foods[i].id)) {
          this.foods[i] = this.foods[this.foods.length - 1];
          this.foods.length--;
        }
      }
    }

    // 3. Star chip collection
    const collectedIds = checkStarChips(this.snakes.values(), this.starChips);
    if (collectedIds.size > 0) {
      // Swap-remove collected chips
      for (let i = this.starChips.length - 1; i >= 0; i--) {
        if (collectedIds.has(this.starChips[i].id)) {
          this.starChips[i] = this.starChips[this.starChips.length - 1];
          this.starChips.length--;
        }
      }
    }

    // 4. Spawn food to maintain target — prioritize spawning near players
    if (this.foods.length < FOOD_COUNT_TARGET) {
      const deficit = FOOD_COUNT_TARGET - this.foods.length;
      const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);

      // Collect player positions (non-bot alive snakes)
      const playerPositions: Array<{ x: number; y: number }> = [];
      for (const [, s] of this.snakes) {
        if (s.alive && !s.isBot && s.path.length > 0) {
          playerPositions.push({ x: s.path.headX, y: s.path.headY });
        }
      }

      if (playerPositions.length > 0) {
        // Distribute food evenly among all players
        const perPlayer = Math.ceil(batch / playerPositions.length);
        for (const pos of playerPositions) {
          const count = Math.min(perPlayer, batch);
          spawnFoodBatch(this.nextFoodIdRef, this.foods, count, pos.x, pos.y, FOOD_SPAWN_AREA_RADIUS);
        }
      } else {
        // No players — spawn around a random alive bot
        const alive: ServerSnake[] = [];
        for (const [, s] of this.snakes) {
          if (s.alive && s.path.length > 0) alive.push(s);
        }
        if (alive.length > 0) {
          const rs = alive[Math.floor(Math.random() * alive.length)];
          spawnFoodBatch(this.nextFoodIdRef, this.foods, batch, rs.path.headX, rs.path.headY, FOOD_SPAWN_AREA_RADIUS);
        }
      }
    }

    // 5. Extraction zone management (online-only)
    this.manageExtractionZone(now);

    // 6. Star chip spawning in extraction zone
    if (this.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
      const chip = spawnStarChip(this.nextStarChipIdRef, this.extractionZone, now);
      if (chip) this.starChips.push(chip);
    }

    // 7. Collisions
    const collisionResult = checkCollisions(
      this.snakes as unknown as Map<string, SnakeLike>,
      this.bodyHash, this.headHash, this.scratch, now,
    );
    // Process deaths
    for (const deadId of collisionResult.deadIds) {
      const snake = this.snakes.get(deadId);
      if (snake) {
        killSnake(snake, this.nextFoodIdRef, this.foods);
        if (snake.isBot) this.snakes.delete(deadId);
      }
    }
    // Convert core KillEvents to server format
    for (const ke of collisionResult.killEvents) {
      this.pendingKills.push({
        killer: ke.killerId, killerName: ke.killerName,
        victim: ke.victimId, victimName: ke.victimName,
        score: ke.score, timestamp: ke.timestamp,
      });
    }

    // 8. Respawn dead bots
    const newBots = respawnBots(
      this.snakes as unknown as Map<string, SnakeLike>,
      SERVER_BOT_COUNT, this.tickCount, now,
    );
    for (const bot of newBots) {
      const serverBot: ServerSnake = {
        ...bot,
        socketId: '',
        input: { targetAngle: bot.angle, boosting: false },
        lastSnapshot: null,
      };
      this.snakes.set(serverBot.id, serverBot);
    }

    // 9. Arena boundary enforcement (online-only)
    this.enforceArenaBounds(now);
  }

  // ── Extraction Zone (online-only) ──────────────────────────────────────

  private manageExtractionZone(now: number): void {
    const ez = this.extractionZone;

    if (!ez.active) {
      // Check if it's time to spawn a new extraction zone
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
      // Deactivate after duration
      if (now - ez.activatedAt >= EXTRACTION_ZONE_DURATION) {
        ez.active = false;
        this.starChips = [];
      }
    }
  }

  // ── Arena Boundary Enforcement (online-only) ──────────────────────────

  private enforceArenaBounds(now: number): void {
    const radiusSq = ARENA_RADIUS * ARENA_RADIUS;
    const DOT_DIST = 0.75;
    for (const [, snake] of this.snakes) {
      if (!snake.alive || snake.path.length === 0) continue;
      // Use black dot position for boundary check
      const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * DOT_DIST;
      const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * DOT_DIST;
      const distFromCenter = dotX * dotX + dotY * dotY;

      if (distFromCenter > radiusSq) {
        if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
        killSnake(snake, this.nextFoodIdRef, this.foods);
        this.pendingKills.push({
          killer: 'boundary', killerName: 'Boundary',
          victim: snake.id, victimName: snake.name,
          score: snake.score, timestamp: Date.now(),
        });
        if (snake.isBot) this.snakes.delete(snake.id);
      }
    }
  }

  // ── Snapshot Builder ──────────────────────────────────────────────────

  buildSnapshot(): ArenaSnapshot {
    const snapshot = buildArenaSnapshot(
      this.snakes as unknown as Map<string, SnakeLike>,
      this.foods, this.starChips, this.tickCount, this.extractionZone,
    );
    // Set lastSnapshot on capped snakes (used by index.ts for per-player queries)
    for (const snakeSnap of snapshot.snakes) {
      const snake = this.snakes.get(snakeSnap.id);
      if (snake) snake.lastSnapshot = snakeSnap;
    }
    return snapshot;
  }

  // ── Respawn Player ────────────────────────────────────────────────────

  respawnPlayer(socketId: string): ServerSnake | null {
    const old = this.snakes.get(socketId);
    let savedSkinId = 'skin-default';
    let savedRarity: SkinRarity = 'common';
    let savedName = 'Player';
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
    const pos = findSafeSpawn(this.snakes as unknown as Map<string, SnakeLike>, 0, 0);
    const base = createSnake(socketId, savedName, 0, pos.x, pos.y, false, now);
    const serverSnake: ServerSnake = {
      ...base,
      skinId: savedSkinId,
      rarity: savedRarity,
      socketId,
      input: { targetAngle: base.angle, boosting: false },
      lastSnapshot: null,
    };
    this.snakes.set(serverSnake.id, serverSnake);
    return serverSnake;
  }

  // ── Utility ──────────────────────────────────────────────────────────

  /** Get player count (non-bot alive snakes) */
  get playerCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive && s.isPlayer) count++;
    }
    return count;
  }

  /** Get total alive count */
  get aliveCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) {
      if (s.alive) count++;
    }
    return count;
  }

  /** Check if arena is empty (no players) */
  get isEmpty(): boolean {
    for (const [, s] of this.snakes) {
      if (s.isPlayer) return false;
    }
    return true;
  }
}
