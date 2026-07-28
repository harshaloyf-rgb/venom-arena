// ============================================================================
// game-state.ts — In-memory per-arena game state + pure game logic.
// ----------------------------------------------------------------------------
// All Socket.IO / HTTP glue lives in index.ts; this module is pure game
// state and physics so it can be reasoned about (and later tested) in
// isolation.
//
// Key design decisions that FIX the old server's bugs:
//  * NO client-supplied position — the server is the sole authority on
//    snake coordinates. Client only sends a desired `angle`.
//  * Bounded body length — a snake's `points` array is capped at
//    `MAX_BODY_POINTS` so a runaway chip count can't OOM the server.
//  * All `points[0]` accesses are guarded; an empty `points` array
//    short-circuits the snake's tick (no TypeError crash).
//  * Map iteration + late-removal: dead snakes are collected into an
//    array and removed AFTER iteration completes (no Map mutation mid-iter).
//  * Bot AI reuses the same grid queries as players and never allocates
//    new arrays per tick (it walks the query Map directly).
// ============================================================================

import {
  BASE_SPEED,
  BOOST_DROP_INTERVAL,
  BOOST_MIN_LENGTH,
  BOOST_SPEED,
  BOT_NAMES,
  BOT_SKINS,
  COLLISION_HIT_FACTOR,
  DEATH_FOOD_DROP_EVERY,
  DEATH_STAR_DROP_MAX,
  DEATH_STAR_DROP_MIN,
  EXTRACT_DURATION_MS,
  EXTRACT_GLIDE_SPEED,
  FOOD_COUNT_TARGET,
  INITIAL_BODY_LENGTH,
  MAP_BASE_RADIUS,
  MAP_BREATH_AMPLITUDE,
  MAP_BREATH_CYCLE_MS,
  MAX_BODY_LENGTH,
  REGULAR_FOOD_GROW,
  REGULAR_FOOD_VALUE_MAX,
  REGULAR_FOOD_VALUE_MIN,
  RESPAWN_INVULN_MS,
  SEGMENT_SPACING,
  SIZE_BASE,
  SIZE_SCORE_FACTOR,
  STAR_CHIP_GROW,
  STAR_CHIP_VALUE,
  TICK_MS,
  TURN_BASE,
  TURN_MIN,
  TURN_SCORE_FACTOR,
  WORLD_SIZE,
  WORLD_RADIUS,
  type ArenaTier,
} from '../../src/lib/game-config';
import type {
  FoodSnapshot,
  GameSnapshot,
  SnakeSnapshot,
} from '../../src/lib/types';
import { SpatialHashGrid, type GridItem } from './spatial-grid.js';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

/** Identity returned by POST /api/match/verify. Treated as immutable trust. */
export interface PlayerIdentity {
  id: string;
  userTag: string;
  name: string;
  country: string;
  level: number;
  bankedChips?: number;
  currentSkin: string;
  currentTrail: string;
  currentDeath: string;
  currentFlag: string | null;
  color: string;
  secondaryColor?: string;
  pattern?: string;
  unlockedSkins: string[];
  clanTag: string | null;
  clanRank: string | null;
  role: 'player' | 'admin';
}

/** Shared shape between human players and bots. */
export interface SnakeBase {
  id: string;
  name: string;
  userTag?: string;
  country?: string;
  /** Body points; index 0 is the head. */
  points: Vec2[];
  angle: number;
  /** Visual radius in px; used for both rendering and collision. */
  size: number;
  color: string;
  secondaryColor?: string;
  isPlayer: boolean;
  isBot: boolean;
  /** Chips carried in-match (ONLY from star chips). Lost on death, banked on extract. */
  carriedChips: number;
  /** Body-length score: regular food +1, star chip +3. Determines body length & size. */
  score: number;
  /** Frame counter for boost drop interval. */
  boostFrameCounter: number;
  isExtracting: boolean;
  /** ms accumulated toward EXTRACT_DURATION_MS. */
  extractionProgress: number;
  isDead: boolean;
  /** epoch ms; snake is invulnerable until this timestamp. */
  spawnProtectedUntil: number;
  chatMessage?: string;
  chatExpiry?: number;
}

/** A human-controlled snake. */
export interface PlayerSession extends SnakeBase {
  identity: PlayerIdentity;
  /** Last validated desired angle sent by the client. */
  desiredAngle: number;
  wantsBoost: boolean;
  kills: number;
  joinedAt: number;
  lastInputAt: number;
  /** Counts consecutive rate-limit drops; logged when abusey. */
  inputDropCount: number;
  lastChatAt: number;
  arenaId: string | null;
  /** True while we're awaiting /api/match/result response — prevents double-report. */
  matchSettling: boolean;
}

export type BotPersonality = 'scavenger' | 'opportunist' | 'hunter' | 'extractor' | 'coward';

/** An AI-controlled snake. */
export interface BotSession extends SnakeBase {
  botId: string;
  personality: BotPersonality;
  /** epoch ms; next time the bot re-evaluates its target angle. */
  nextThinkAt: number;
  /** Cached desired angle between re-thinks. */
  desiredAngle: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  value: number;
  isStarChip: boolean;
  color: string;
}

/** One arena's full in-memory state. */
export interface ArenaRoom {
  arena: ArenaTier;
  players: Map<string, PlayerSession>;
  bots: Map<string, BotSession>;
  foods: Food[];
  grid: SpatialHashGrid;
  tick: number;
  lastBroadcast: number;
  leaderId: string | null;
  leaderChips: number;
  /** Monotonic counter for food ids within this arena. */
  foodIdCounter: number;
  /** Monotonic counter for bot ids within this arena. */
  botIdCounter: number;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Max turn rate per tick (radians) for bots. Prevents instant 180° snaps. */
const MAX_TURN_PER_TICK = 0.22;
/** Max points emitted in a snapshot — longer bodies are downsampled. */
const MAX_SNAPSHOT_POINTS = 60;

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------

/** Smallest angular difference from `current` to `desired`, in [-π, π]. */
function angularDelta(current: number, desired: number): number {
  let diff = desired - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/** Step `current` toward `desired` by at most `maxStep` radians. */
export function turnToward(current: number, desired: number, maxStep: number): number {
  const diff = angularDelta(current, desired);
  if (Math.abs(diff) <= maxStep) return desired;
  return current + Math.sign(diff) * maxStep;
}

/** Distance between two points. */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ----------------------------------------------------------------------------
// Spawning
// ----------------------------------------------------------------------------

/** Random point inside a disc of radius `maxR` centered on the WORLD center. */
export function randomSpawnPoint(maxR: number): Vec2 {
  // sqrt for uniform area distribution (avoids clustering at center)
  const r = Math.sqrt(Math.random()) * maxR;
  const theta = Math.random() * Math.PI * 2;
  return { x: WORLD_RADIUS + Math.cos(theta) * r, y: WORLD_RADIUS + Math.sin(theta) * r };
}

/** Breathing map radius — oscillates +/- MAP_BREATH_AMPLITUDE every MAP_BREATH_CYCLE_MS. */
export function getMapRadius(elapsedMs: number): number {
  const cycle = (elapsedMs % MAP_BREATH_CYCLE_MS) / MAP_BREATH_CYCLE_MS;
  return MAP_BASE_RADIUS + Math.sin(cycle * Math.PI * 2) * MAP_BREATH_AMPLITUDE;
}

/**
 * Build an initial body: `length` points strung out behind the head at
 * SEGMENT_SPACING px apart, all along the angle's reverse direction.
 */
export function initialBody(headX: number, headY: number, angle: number, length: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < length; i++) {
    pts.push({
      x: headX - Math.cos(angle) * i * SEGMENT_SPACING,
      y: headY - Math.sin(angle) * i * SEGMENT_SPACING,
    });
  }
  return pts;
}

/** Factory: create a fresh ArenaRoom for the given tier (no bots spawned yet). */
export function createArenaRoom(arena: ArenaTier): ArenaRoom {
  return {
    arena,
    players: new Map(),
    bots: new Map(),
    foods: [],
    grid: new SpatialHashGrid(120),
    tick: 0,
    lastBroadcast: 0,
    leaderId: null,
    leaderChips: 0,
    foodIdCounter: 0,
    botIdCounter: 0,
  };
}

/** Spawn a single bot with a random personality and safe location. */
export function spawnBot(room: ArenaRoom): BotSession {
  const idx = room.botIdCounter++;
  const name = BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? '-' + Math.floor(idx / BOT_NAMES.length) : '');
  const skin = BOT_SKINS[idx % BOT_SKINS.length];
  const personalities: BotPersonality[] = ['scavenger', 'opportunist', 'hunter', 'extractor', 'coward'];
  const personality = personalities[idx % personalities.length];
  const spawn = randomSpawnPoint(WORLD_RADIUS - 200);
  const angle = Math.random() * Math.PI * 2;
  const botId = `bot-${room.arena.id}-${idx}`;
  return {
    id: botId,
    botId,
    name,
    points: initialBody(spawn.x, spawn.y, angle, INITIAL_BODY_LENGTH),
    angle,
    size: SIZE_BASE,
    color: skin.color,
    secondaryColor: skin.secondaryColor,
    isPlayer: false,
    isBot: true,
    carriedChips: 0,
    score: 0,
    boostFrameCounter: 0,
    isExtracting: false,
    extractionProgress: 0,
    isDead: false,
    spawnProtectedUntil: Date.now() + RESPAWN_INVULN_MS,
    personality,
    nextThinkAt: 0,
    desiredAngle: angle,
  };
}

/** Ensure the arena has `arena.botsCount` bots, spawning new ones as needed. */
export function ensureBots(room: ArenaRoom): void {
  while (room.bots.size < room.arena.botsCount) {
    const bot = spawnBot(room);
    room.bots.set(bot.id, bot);
  }
}

/** Spawn one regular food pellet at a random in-world location. Original: value 2-6, 8 colors. */
const FOOD_COLORS = ['#38bdf8', '#818cf8', '#fb7185', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee', '#f472b6'];
export function spawnRandomFood(room: ArenaRoom): Food {
  const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
  const pos = randomSpawnPoint(MAP_BASE_RADIUS - 20);
  return {
    id,
    x: pos.x,
    y: pos.y,
    size: 4 + Math.random() * 3,
    value: Math.floor(Math.random() * (REGULAR_FOOD_VALUE_MAX - REGULAR_FOOD_VALUE_MIN + 1)) + REGULAR_FOOD_VALUE_MIN,
    isStarChip: false,
    color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
  };
}

/**
 * Drop star chips at body segment positions (NO scatter).
 * ONLY for real players (bots never have chips).
 * Called on BOTH body-collision death AND wall death for real players.
 */
export function dropStarChipsAtBody(room: ArenaRoom, bodyPoints: Vec2[], chips: number): void {
  if (!bodyPoints || bodyPoints.length === 0 || chips <= 0) return;
  const dropCount = Math.min(DEATH_STAR_DROP_MAX, Math.max(DEATH_STAR_DROP_MIN, Math.floor(chips / 5)));
  const valuePerDrop = Math.max(1, Math.floor(chips / dropCount));
  for (let i = 0; i < dropCount; i++) {
    // Distribute along the body — no scatter radius.
    const segIdx = Math.min(bodyPoints.length - 1, Math.floor((i / dropCount) * bodyPoints.length));
    const pt = bodyPoints[segIdx];
    const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
    room.foods.push({
      id,
      x: pt.x,
      y: pt.y,
      size: 9 + Math.random() * 2,
      value: valuePerDrop,
      isStarChip: true,
      color: '#fbbf24',
    });
  }
}

/**
 * Drop regular food at body segment positions (NO scatter).
 * Called ONLY on body-collision death (NOT wall death).
 * Both real players and bots drop food on body-collision death.
 */
export function dropFoodAtBody(room: ArenaRoom, bodyPoints: Vec2[], color: string): void {
  if (!bodyPoints || bodyPoints.length === 0) return;
  // Every 2nd segment drops food (original logic).
  for (let i = 0; i < bodyPoints.length; i += DEATH_FOOD_DROP_EVERY) {
    const pt = bodyPoints[i];
    const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
    room.foods.push({
      id,
      x: pt.x,
      y: pt.y,
      size: 4 + Math.random() * 3,
      value: Math.floor(Math.random() * (REGULAR_FOOD_VALUE_MAX - REGULAR_FOOD_VALUE_MIN + 1)) + REGULAR_FOOD_VALUE_MIN,
      isStarChip: false,
      color: color,
    });
  }
}

// ----------------------------------------------------------------------------
// Snake movement
// ----------------------------------------------------------------------------

/**
 * Move a snake one tick. The server is the sole authority on coordinates:
 * `desiredAngle` is the only client influence (via rate-limited turn speed).
 *
 * ORIGINAL MECHANICS (matching server.ts):
 *  * Regular food = +1 score (grows body), NO chips.
 *  * Star chips = +chips to carriedChips, +3 score.
 *  * Boost costs BODY LENGTH: every 40 frames drops 1 tail segment (score -1).
 *  * Boost requires body.length > 8.
 *  * Turn rate: max(0.045, 0.15 - score*0.0006) — bigger snakes turn slower.
 *  * Size: 8 + sqrt(score) * 0.4.
 *  * Extraction glide speed = 3.2 (can still steer while extracting).
 *  * Body length = INITIAL_BODY_LENGTH + score, capped at MAX_BODY_LENGTH (120).
 */
export function tickSnakeMovement(
  snake: SnakeBase,
  desiredAngle: number,
  wantsBoost: boolean,
): void {
  if (snake.points.length === 0) return;
  if (snake.isDead) return;

  // 1) Turn — rate-limited, bigger snakes turn slower (original formula).
  const turnRate = Math.max(TURN_MIN, TURN_BASE - snake.score * TURN_SCORE_FACTOR);
  snake.angle = turnToward(snake.angle, desiredAngle, turnRate);

  // 2) Speed: extracting glide < normal < boost.
  let speed = BASE_SPEED;
  if (snake.isExtracting) {
    speed = EXTRACT_GLIDE_SPEED;
  } else if (wantsBoost && snake.points.length > BOOST_MIN_LENGTH) {
    speed = BOOST_SPEED;
    // Boost cost: drop 1 tail segment every BOOST_DROP_INTERVAL frames.
    snake.boostFrameCounter++;
    if (snake.boostFrameCounter >= BOOST_DROP_INTERVAL) {
      snake.boostFrameCounter = 0;
      if (snake.points.length > BOOST_MIN_LENGTH) {
        snake.points.pop();
        snake.score = Math.max(BOOST_MIN_LENGTH, snake.score - 1);
      }
    }
  }

  // 3) Move head.
  const head = snake.points[0];
  const nx = head.x + Math.cos(snake.angle) * speed;
  const ny = head.y + Math.sin(snake.angle) * speed;

  // 4) Unshift new head — body trails naturally. NO world clamp (wall = death).
  snake.points.unshift({ x: nx, y: ny });

  // 5) Grow/shrink body to target length based on SCORE (not chips).
  const targetLen = Math.min(
    MAX_BODY_LENGTH,
    INITIAL_BODY_LENGTH + snake.score,
  );
  while (snake.points.length > targetLen) snake.points.pop();

  // 6) Size formula: 8 + sqrt(score) * 0.4 (original).
  snake.size = SIZE_BASE + Math.sqrt(snake.score) * SIZE_SCORE_FACTOR;
}

// ----------------------------------------------------------------------------
// Bot AI
// ----------------------------------------------------------------------------

/**
 * Cheap per-bot AI. Re-evaluates a target angle every ~150ms; between
 * re-thinks it just moves toward the cached angle. The bot seeks the
 * nearest food pellet and flees from any foreign body segment within a
 * threat radius. No allocations on the hot path — we walk the grid query
 * Map directly.
 */
export function tickBot(bot: BotSession, room: ArenaRoom, now: number): void {
  if (bot.points.length === 0 || bot.isDead) return;

  if (now >= bot.nextThinkAt) {
    bot.nextThinkAt = now + 120 + Math.floor(Math.random() * 80);
    const head = bot.points[0];

    // Find nearest food (scan ~250px radius).
    let bestFood: GridItem | null = null;
    let bestFoodDist = Infinity;
    const foodQuery = room.grid.queryRadius(head.x, head.y, 260);
    for (const item of foodQuery.values()) {
      if (item.kind !== 'food') continue;
      if ((item.value ?? 0) <= 0) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < bestFoodDist) {
        bestFoodDist = d;
        bestFood = item;
      }
    }

    // Find nearest threat (foreign body segment within ~140px).
    let threatX = 0;
    let threatY = 0;
    let threatDist = Infinity;
    const threatQuery = room.grid.queryRadius(head.x, head.y, 150);
    for (const item of threatQuery.values()) {
      if (item.kind !== 'segment') continue;
      if (item.snakeId === bot.id) continue;
      if (item.segIdx === 0) continue; // ignore head-on collisions
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < threatDist) {
        threatDist = d;
        threatX = item.x;
        threatY = item.y;
      }
    }

    let desired: number;
    const cowardFleeDist = 140;
    const opportunistFleeDist = 90;
    const shouldFlee =
      threatDist < cowardFleeDist &&
      (bot.personality === 'coward' ||
        bot.personality === 'extractor' ||
        (bot.personality === 'opportunist' && threatDist < opportunistFleeDist));

    if (shouldFlee) {
      // Flee directly away from the threat segment.
      desired = Math.atan2(head.y - threatY, head.x - threatX);
    } else if (bestFood) {
      desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
    } else {
      // Wander: nudge current angle slightly. Avoids getting stuck on walls.
      desired = bot.angle + (Math.random() - 0.5) * 0.4;
    }

    // Edge avoidance: if near world border, turn back toward center.
    const headR = Math.hypot(head.x, head.y);
    if (headR > WORLD_RADIUS - 250) {
      const toCenter = Math.atan2(-head.y, -head.x);
      desired = turnToward(desired, toCenter, MAX_TURN_PER_TICK * 2);
    }

    bot.desiredAngle = desired;
  }

  // Hunter personality occasionally boosts.
  const wantsBoost = bot.personality === 'hunter' && bot.carriedChips > 5 && Math.random() < 0.05;
  tickSnakeMovement(bot, bot.desiredAngle, wantsBoost);
}

// ----------------------------------------------------------------------------
// Collision detection
// ----------------------------------------------------------------------------

/** A pending death detected during collision iteration; applied after iteration. */
export interface PendingDeath {
  deadId: string;
  killerId?: string;
  cause: 'body' | 'wall';
}

/**
 * Detect head-to-body collisions via the spatial grid. For each living,
 * non-spawn-protected snake's head, query nearby segments; if any
 * foreign non-head segment is within `head.size + seg.radius`, the head's
 * owner dies (and the segment's owner is the killer).
 *
 * Returns the list of deaths. Caller must apply them AFTER iteration.
 */
export function detectCollisions(room: ArenaRoom, now: number): PendingDeath[] {
  const deaths: PendingDeath[] = [];
  const seenDead = new Set<string>();

  const allSnakes: SnakeBase[] = collectAllSnakes(room);
  for (const snake of allSnakes) {
    if (snake.isDead) continue;
    if (snake.points.length === 0) continue;
    if (now < snake.spawnProtectedUntil) continue;
    if (seenDead.has(snake.id)) continue;

    const head = snake.points[0];

    // Wall collision: death if outside the breathing map radius.
    const mapRadius = getMapRadius(now);
    const distFromCenter = Math.hypot(head.x - WORLD_RADIUS, head.y - WORLD_RADIUS);
    if (distFromCenter > mapRadius) {
      deaths.push({ deadId: snake.id, killerId: 'wall', cause: 'wall' });
      seenDead.add(snake.id);
      continue;
    }

    const queryR = snake.size + 30;
    const nearby = room.grid.queryRadius(head.x, head.y, queryR);

    for (const item of nearby.values()) {
      if (item.kind !== 'segment') continue;
      if (item.snakeId === snake.id) continue;
      if (item.segIdx === 0) continue; // skip head-to-head (head-to-body only)
      const d = dist(head.x, head.y, item.x, item.y);
      // Original hit factor: (radiusA + radiusB) * 0.75
      if (d < (snake.size + item.radius) * COLLISION_HIT_FACTOR) {
        deaths.push({ deadId: snake.id, killerId: item.snakeId, cause: 'body' });
        seenDead.add(snake.id);
        break;
      }
    }
  }

  return deaths;
}

/**
 * Eat food via the spatial grid. RULES:
 *  * Regular food (isStarChip=false): +1 score (grows body), NO chips. ALL snakes eat this.
 *  * Star chip (isStarChip=true): +value chips to carriedChips, +3 score. ONLY real players eat this.
 *  * Bots NEVER collect star chips (they have no economic role).
 * Eaten food is zeroed on both the grid item AND the real Food object.
 */
export function eatFood(room: ArenaRoom): void {
  const allSnakes: SnakeBase[] = collectAllSnakes(room);
  for (const snake of allSnakes) {
    if (snake.isDead) continue;
    if (snake.points.length === 0) continue;
    const head = snake.points[0];
    const nearby = room.grid.queryRadius(head.x, head.y, snake.size + 20);
    for (const item of nearby.values()) {
      if (item.kind !== 'food') continue;
      if ((item.value ?? 0) <= 0) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < snake.size + (item.radius || 6) + 6) {
        if (item.isStarChip) {
          // Star chip: ONLY real players collect (bots skip).
          if (!snake.isPlayer) continue;
          snake.carriedChips += item.value ?? 0;
          snake.score += STAR_CHIP_GROW;
        } else {
          // Regular food: all snakes eat (+1 score, no chips).
          snake.score += REGULAR_FOOD_GROW;
        }
        // Zero BOTH the grid item (intra-tick sentinel) AND the real food object.
        item.value = 0;
        if (item.foodRef) item.foodRef.value = 0;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Snapshot
// ----------------------------------------------------------------------------

/** Iterator helper: yield every living-or-dead snake (player + bot) in the room. */
export function collectAllSnakes(room: ArenaRoom): SnakeBase[] {
  const out: SnakeBase[] = [];
  for (const p of room.players.values()) out.push(p);
  for (const b of room.bots.values()) out.push(b);
  return out;
}

/**
 * Build the broadcast GameSnapshot for an arena.
 * @param viewerId — the socket ID of the player receiving this snapshot (for yourRank computation).
 */
export function buildSnapshot(room: ArenaRoom, viewerId?: string): GameSnapshot {
  const snakes: SnakeSnapshot[] = [];
  const now = Date.now();
  for (const snake of collectAllSnakes(room)) {
    let points = snake.points;
    if (points.length > MAX_SNAPSHOT_POINTS) {
      const step = points.length / MAX_SNAPSHOT_POINTS;
      const downsampled: Vec2[] = [];
      for (let i = 0; i < MAX_SNAPSHOT_POINTS; i++) {
        downsampled.push(points[Math.floor(i * step)]);
      }
      points = downsampled;
    }
    snakes.push({
      id: snake.id,
      name: snake.name,
      userTag: snake.userTag,
      points,
      angle: snake.angle,
      size: snake.size,
      color: snake.color,
      secondaryColor: snake.secondaryColor,
      isPlayer: snake.isPlayer,
      isBot: snake.isBot,
      carriedChips: Math.floor(snake.carriedChips),
      score: snake.score,
      isExtracting: snake.isExtracting,
      extractionProgress: Math.min(1, snake.extractionProgress / EXTRACT_DURATION_MS),
      isDead: snake.isDead,
      spawnProtected: now < snake.spawnProtectedUntil,
      chatMessage: snake.chatMessage,
      country: snake.country,
    });
  }

  const foods: FoodSnapshot[] = room.foods.map((f) => ({
    id: f.id,
    x: f.x,
    y: f.y,
    size: f.size,
    value: f.value,
    isStarChip: f.isStarChip,
    color: f.color,
  }));

  // Build arena leaderboard from REAL players only, sorted by carriedChips desc.
  const realPlayers = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling);
  const sorted = realPlayers.sort((a, b) => b.carriedChips - a.carriedChips);
  const arenaLeaderboard = sorted.slice(0, 10).map(p => ({
    id: p.id,
    name: p.name,
    userTag: p.userTag,
    carriedChips: Math.floor(p.carriedChips),
    score: p.score,
    kills: p.kills,
    isPlayer: p.id === viewerId,
    country: p.country,
  }));

  // Your rank: position in sorted real players by carriedChips.
  const yourRank = viewerId ? sorted.findIndex(p => p.id === viewerId) + 1 : 0;

  // Dynamic commission: 0% if <=3 real players, 35% if >=4.
  const realPlayerCount = realPlayers.length;
  const commissionRate = realPlayerCount <= 3 ? 0 : 0.35;

  return {
    arenaId: room.arena.id,
    tick: room.tick,
    snakes,
    foods,
    worldSize: WORLD_SIZE,
    leaderId: room.leaderId,
    leaderChips: room.leaderChips,
    realPlayerCount,
    yourRank: yourRank > 0 ? yourRank : 0,
    arenaLeaderboard,
    commissionRate,
  };
}

/**
 * Recompute the arena leader (highest carriedChips). Called once per tick
 * after collisions + food have been resolved.
 */
export function recomputeLeader(room: ArenaRoom): void {
  let topId: string | null = null;
  let topChips = 0;
  for (const snake of collectAllSnakes(room)) {
    if (snake.carriedChips > topChips) {
      topChips = snake.carriedChips;
      topId = snake.id;
    }
  }
  room.leaderId = topId;
  room.leaderChips = Math.floor(topChips);
}

/** Re-populate food up to FOOD_COUNT_TARGET. Called once per tick. */
export function replenishFood(room: ArenaRoom): void {
  // Filter out eaten food first (sentinel: value === 0).
  if (room.foods.some((f) => f.value <= 0)) {
    room.foods = room.foods.filter((f) => f.value > 0);
  }
  let guard = 0;
  while (room.foods.length < FOOD_COUNT_TARGET && guard < 50) {
    room.foods.push(spawnRandomFood(room));
    guard++;
  }
}

/** Expire chat bubbles whose TTL has elapsed. */
export function expireChat(room: ArenaRoom, now: number): void {
  for (const snake of collectAllSnakes(room)) {
    if (snake.chatExpiry && now > snake.chatExpiry) {
      snake.chatMessage = undefined;
      snake.chatExpiry = undefined;
    }
  }
}

// Re-export the TICK_MS for the index module's timers.
export { TICK_MS };
