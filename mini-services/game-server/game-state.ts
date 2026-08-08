// ==========================================================================
// ArenaRoom — Core Game Simulation for one arena shard.
// Stripped to match offline mode: no bots, no arena boundary, no timed extraction.
// Food uses density-based spawning (same as offline).
// ==========================================================================

import {
  // Types
  type FoodOrb, type StarChip, type SnakeSnapshot, type ArenaSnapshot,
  type SnakeLike, type MoveContext, type SkinRarity,
  // Core engine functions
  createSnake, findSafeSpawn, moveSnake,
  spawnFoodBatch, makeFood,
  checkFoodEating, checkCollisions, killSnake,
  checkStarChips, spawnStarChip,
  // Config (same as offline)
  INITIAL_SPAWN_RADIUS,
  FOOD_RESPAWN_BATCH,
  SPATIAL_CELL_SIZE,
  EXTRACTION_ZONE_RADIUS,
  STAR_CHIP_SPAWN_INTERVAL,
  // Utilities
  SpatialHash, type SpatialEntity,
  // Snapshot building
  buildArenaSnapshot,
} from './shared';

// Import offline food constants for density-based spawning
import {
  FOOD_DENSITY_TARGET,
  FOOD_DESPAWN_RADIUS,
  FOOD_VISIBLE_RADIUS,
  FOOD_MAX_COUNT,
} from '../../src/lib/snake/config';

const DESPAWN_RADIUS_SQ = FOOD_DESPAWN_RADIUS * FOOD_DESPAWN_RADIUS;
const VISIBLE_RADIUS_SQ = FOOD_VISIBLE_RADIUS * FOOD_VISIBLE_RADIUS;

// ─── ServerSnake ─────────────────────────────────────────────────────────────

/** Server-side snake: core SnakeLike + network-specific fields */
export interface ServerSnake extends SnakeLike {
  /** Socket.IO socket ID for networked players */
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
  /** Extraction zone state (inert — no timed spawning) */
  extractionZone: { x: number; y: number; radius: number; active: boolean; activatedAt: number };
  /** Kill events generated this tick (broadcasted by index.ts) */
  pendingKills: KillEvent[] = [];

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
    // No bots — spawn initial food around origin (like offline)
    spawnFoodBatch(this.nextFoodIdRef, this.foods, FOOD_DENSITY_TARGET, 0, 0, INITIAL_SPAWN_RADIUS);
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

    // 1. Move all player snakes (no bots)
    for (const [, snake] of this.snakes) {
      if (!snake.alive) continue;
      moveSnake(snake, snake.input.targetAngle, snake.input.boosting, now, moveCtx);
    }

    // 2. Food eating
    const eatenIds = checkFoodEating(
      this.snakes.values(), this.foods,
      this.foodHash, this.foodValueCache, now,
    );
    if (eatenIds.size > 0) {
      for (let i = this.foods.length - 1; i >= 0; i--) {
        if (eatenIds.has(this.foods[i].id)) {
          this.foods[i] = this.foods[this.foods.length - 1];
          this.foods.length--;
        }
      }
    }

    // 3. Collisions (player vs self only — no other snakes/bots)
    const collisionResult = checkCollisions(
      this.snakes as unknown as Map<string, SnakeLike>,
      this.bodyHash, this.headHash, this.scratch, now,
    );
    for (const deadId of collisionResult.deadIds) {
      const snake = this.snakes.get(deadId);
      if (snake) killSnake(snake, this.nextFoodIdRef, this.foods);
    }
    for (const ke of collisionResult.killEvents) {
      this.pendingKills.push({
        killer: ke.killerId, killerName: ke.killerName,
        victim: ke.victimId, victimName: ke.victimName,
        score: ke.score, timestamp: ke.timestamp,
      });
    }

    // 4. Density-based food spawning (same logic as offline maintainFoodAroundPlayer)
    this.maintainFood();

    // 5. Star chip collection
    const collectedIds = checkStarChips(this.snakes.values(), this.starChips);
    if (collectedIds.size > 0) {
      for (let i = this.starChips.length - 1; i >= 0; i--) {
        if (collectedIds.has(this.starChips[i].id)) {
          this.starChips[i] = this.starChips[this.starChips.length - 1];
          this.starChips.length--;
        }
      }
    }

    // 6. Star chip spawning in extraction zone
    if (this.extractionZone.active && now % STAR_CHIP_SPAWN_INTERVAL < 20) {
      const chip = spawnStarChip(this.nextStarChipIdRef, this.extractionZone, now);
      if (chip) this.starChips.push(chip);
    }
  }

  // ── Density-based food spawning (same as offline) ──────────────────────

  private maintainFood(): void {
    // Find reference snake (first alive player)
    let refSnake: ServerSnake | undefined;
    for (const [, s] of this.snakes) {
      if (s.alive && s.path.length > 0) { refSnake = s; break; }
    }
    if (!refSnake) return;

    const hx = refSnake.path.headX;
    const hy = refSnake.path.headY;
    const angle = refSnake.angle;
    const foods = this.foods;

    // Despawn far food (same as offline)
    let writeIdx = 0;
    let nearbyCount = 0;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      const dx = f.x - hx; const dy = f.y - hy;
      const dSq = dx * dx + dy * dy;
      if (dSq > DESPAWN_RADIUS_SQ) continue;
      if (writeIdx !== i) foods[writeIdx] = f;
      writeIdx++;
      if (dSq < VISIBLE_RADIUS_SQ) nearbyCount++;
    }
    foods.length = writeIdx;

    // Spawn to meet density target (same ratios as offline)
    const deficit = FOOD_DENSITY_TARGET - nearbyCount;
    if (deficit <= 0 || foods.length >= FOOD_MAX_COUNT) return;
    const batch = Math.min(deficit, FOOD_RESPAWN_BATCH);

    const uniformCount = Math.ceil(batch * 0.5);
    const aheadCount = Math.ceil(batch * 0.3);
    const aroundCount = batch - uniformCount - aheadCount;

    for (let i = 0; i < uniformCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
      foods.push(makeFood(this.nextFoodIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
    }
    for (let i = 0; i < aheadCount; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 0.8;
      const dist = 200 + Math.random() * (FOOD_VISIBLE_RADIUS - 200);
      const a = angle + spread;
      foods.push(makeFood(this.nextFoodIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
    }
    for (let i = 0; i < aroundCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 800 + Math.random() * (FOOD_VISIBLE_RADIUS - 800);
      foods.push(makeFood(this.nextFoodIdRef, hx + Math.cos(a) * dist, hy + Math.sin(a) * dist));
    }
  }

  // ── Snapshot Builder ──────────────────────────────────────────────────

  buildSnapshot(): ArenaSnapshot {
    const snapshot = buildArenaSnapshot(
      this.snakes as unknown as Map<string, SnakeLike>,
      this.foods, this.starChips, this.tickCount, this.extractionZone,
    );
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
      if (old.alive) killSnake(old, this.nextFoodIdRef, this.foods);
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

  get playerCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) { if (s.alive && s.isPlayer) count++; }
    return count;
  }

  get aliveCount(): number {
    let count = 0;
    for (const [, s] of this.snakes) { if (s.alive) count++; }
    return count;
  }

  get isEmpty(): boolean {
    for (const [, s] of this.snakes) { if (s.isPlayer) return false; }
    return true;
  }
}
