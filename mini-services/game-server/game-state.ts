// ============================================================================
// game-state.ts — In-memory per-arena game state + pure game logic.
// ----------------------------------------------------------------------------
// REWRITTEN per new spec:
//  * Three food orb sizes (Small=1pt, Medium=3pt, Large=5pt)
//  * Score model: INITIAL_SPAWN_SCORE(20) + food collected
//  * Star drops: ALWAYS exactly 10 per player death
//  * Death food: exact sum matching snake's total score
//  * Head-on collision: mass + boost priority rules
//  * Bot AI: all bots evade humans, self-destruct at score >= 100 (online only)
//  * Dynamic map radius based on real player count
// ============================================================================

import {
  BASE_SPEED,
  BOOST_DROP_INTERVAL,
  BOOST_MIN_LENGTH,
  BOOST_SPEED,
  BOT_EVADE_RADIUS,
  BOT_FOOD_SCAN_RADIUS,
  BOT_NAMES,
  BOT_SELF_DESTRUCT_THRESHOLD,
  BOT_SKINS,
  COLLISION_HIT_FACTOR,
  EXTRACT_DURATION_MS,
  EXTRACT_GLIDE_SPEED,
  FOOD_COUNT_TARGET,
  FOOD_ORB_LARGE,
  FOOD_ORB_MEDIUM,
  FOOD_ORB_SMALL,
  FOOD_ORB_WEIGHTS,
  HEAD_ON_HIT_FACTOR,
  INITIAL_BODY_LENGTH,
  INITIAL_SPAWN_SCORE,
  MAP_MIN_RADIUS,
  MAX_BODY_LENGTH,
  MAX_ARENA_PLAYERS,
  NECK_PROTECTION_SEGS,
  SAFE_SPAWN_MIN_DIST,
  SAFE_SPAWN_ATTEMPTS,
  RESPAWN_INVULN_MS,
  SEGMENT_SPACING,
  SIZE_BASE,
  SIZE_SCORE_FACTOR,
  STAR_DROP_COUNT,
  TICK_MS,
  TURN_BASE,
  TURN_MIN,
  TURN_SCORE_FACTOR,
  WORLD_SIZE,
  getDynamicMapRadius,
  type ArenaTier,
  type FoodOrbConfig,
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
  /** Total score: INITIAL_SPAWN_SCORE + all food collected. Determines body length & size. */
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
  /** Whether the snake is actively boosting (for head-on collision rules). */
  wantsBoost: boolean;
  /** Bot behavioral state (online mode only). */
  botState?: 'harvesting' | 'selfDestruct';
}

/** A human-controlled snake. */
export interface PlayerSession extends SnakeBase {
  identity: PlayerIdentity;
  /** Last validated desired angle sent by the client. */
  desiredAngle: number;
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
  glowColor?: string;
  orbSize?: 'small' | 'medium' | 'large';
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
  /** Cached map center X for spawn/reference. */
  mapCenterX: number;
  /** Cached map center Y for spawn/reference. */
  mapCenterY: number;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/** Max turn rate per tick (radians) for bots. */
const MAX_TURN_PER_TICK = 0.22;
/** Max points emitted in a snapshot — longer bodies are downsampled. */
const MAX_SNAPSHOT_POINTS = 60;

// Food orb configs for quick lookup
const FOOD_ORB_CONFIGS: FoodOrbConfig[] = [
  FOOD_ORB_SMALL,   // weight 0.6
  FOOD_ORB_MEDIUM,  // weight 0.3
  FOOD_ORB_LARGE,   // weight 0.1
];

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------

function angularDelta(current: number, desired: number): number {
  let diff = desired - current;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

export function turnToward(current: number, desired: number, maxStep: number): number {
  const diff = angularDelta(current, desired);
  if (Math.abs(diff) <= maxStep) return desired;
  return current + Math.sign(diff) * maxStep;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ----------------------------------------------------------------------------
// Weighted random picker (for food orb spawning)
// ----------------------------------------------------------------------------

function weightedRandomIndex(weights: number[]): number {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (r <= cumulative) return i;
  }
  return weights.length - 1;
}

// ----------------------------------------------------------------------------
// Spawning
// ----------------------------------------------------------------------------

/** Random point inside a disc of radius `maxR` centered at (cx, cy). */
export function randomSpawnPoint(maxR: number, cx: number = 0, cy: number = 0): Vec2 {
  const r = Math.sqrt(Math.random()) * maxR * 0.85;
  const theta = Math.random() * Math.PI * 2;
  return { x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r };
}

/**
 * Find a safe spawn point that is far from all existing snakes (players + bots).
 * Tries SAFE_SPAWN_ATTEMPTS times, falls back to random if no safe spot found.
 */
export function findSafeSpawnPoint(room: ArenaRoom, maxR: number, cx: number = 0, cy: number = 0): Vec2 {
  const allHeads: Vec2[] = [];
  for (const s of collectAllSnakes(room)) {
    if (s.isDead || s.points.length === 0) continue;
    allHeads.push(s.points[0]);
  }

  for (let attempt = 0; attempt < SAFE_SPAWN_ATTEMPTS; attempt++) {
    const pt = randomSpawnPoint(maxR, cx, cy);
    let safe = true;

    // Must be at least 500px inside the map boundary to avoid instant map death
    const distFromCenter = dist(pt.x, pt.y, cx, cy);
    if (distFromCenter > maxR - 500) {
      safe = false;
    }

    // Must be far from all existing snake heads
    if (safe) {
      for (const head of allHeads) {
        if (dist(pt.x, pt.y, head.x, head.y) < SAFE_SPAWN_MIN_DIST) {
          safe = false;
          break;
        }
      }
    }
    if (safe) return pt;
  }
  // Fallback: return a random point (better than no spawn at all)
  return randomSpawnPoint(maxR, cx, cy);
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

/** Factory: create a fresh ArenaRoom. */
export function createArenaRoom(arena: ArenaTier): ArenaRoom {
  const mapRadius = getDynamicMapRadius(1);
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
    mapCenterX: 0,
    mapCenterY: 0,
  };
}

/** Spawn a single bot. */
export function spawnBot(room: ArenaRoom): BotSession {
  const idx = room.botIdCounter++;
  const name = BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? '-' + Math.floor(idx / BOT_NAMES.length) : '');
  const skin = BOT_SKINS[idx % BOT_SKINS.length];
  const personalities: BotPersonality[] = ['scavenger', 'opportunist', 'hunter', 'extractor', 'coward'];
  const personality = personalities[idx % personalities.length];

  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const mapRadius = getDynamicMapRadius(Math.max(1, realPlayerCount));
  const spawn = findSafeSpawnPoint(room, mapRadius - 200, room.mapCenterX, room.mapCenterY);
  const angle = Math.random() * Math.PI * 2;
  const botId = `bot-${room.arena.id}-${idx}`;

  return {
    id: botId,
    botId,
    name,
    points: initialBody(spawn.x, spawn.y, angle, INITIAL_BODY_LENGTH),
    angle,
    size: SIZE_BASE + Math.sqrt(INITIAL_SPAWN_SCORE) * SIZE_SCORE_FACTOR,
    color: skin.color,
    secondaryColor: skin.secondaryColor,
    isPlayer: false,
    isBot: true,
    carriedChips: 0,
    score: INITIAL_SPAWN_SCORE,
    boostFrameCounter: 0,
    isExtracting: false,
    extractionProgress: 0,
    isDead: false,
    spawnProtectedUntil: Date.now() + RESPAWN_INVULN_MS,
    personality,
    nextThinkAt: 0,
    desiredAngle: angle,
    wantsBoost: false,
    botState: 'harvesting',
  };
}

/** Ensure the arena has the target bot count. */
export function ensureBots(room: ArenaRoom): void {
  while (room.bots.size < room.arena.botsCount) {
    const bot = spawnBot(room);
    room.bots.set(bot.id, bot);
  }
}

/** Spawn one random food orb (S/M/L based on weights). */
export function spawnRandomFood(room: ArenaRoom): Food {
  const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const mapRadius = getDynamicMapRadius(Math.max(1, realPlayerCount));
  const pos = randomSpawnPoint(mapRadius - 50, room.mapCenterX, room.mapCenterY);

  const orbIdx = weightedRandomIndex(FOOD_ORB_WEIGHTS);
  const orb = FOOD_ORB_CONFIGS[orbIdx];

  return {
    id,
    x: pos.x,
    y: pos.y,
    size: orb.radius,
    value: orb.value,
    isStarChip: false,
    color: orb.color,
    glowColor: orb.glowColor,
    orbSize: orb.size,
  };
}

// ----------------------------------------------------------------------------
// Death drop helpers
// ----------------------------------------------------------------------------

/**
 * Compute the mix of Small(1), Medium(3), Large(5) orbs that sum to exactly totalScore.
 * Greedily picks Large first, then Medium, then Small.
 */
export function computeDeathOrbs(totalScore: number): { small: number; medium: number; large: number } {
  let remaining = totalScore;
  const large = Math.floor(remaining / 5);
  remaining -= large * 5;
  const medium = Math.floor(remaining / 3);
  remaining -= medium * 3;
  const small = remaining;
  return { small, medium, large };
}

/**
 * Drop score orbs (S/M/L) that sum to exactly totalScore along a body path.
 * Used for body-collision deaths (NOT wall deaths).
 */
export function dropScoreOrbsAtBody(
  room: ArenaRoom,
  bodyPoints: Vec2[],
  totalScore: number,
  snakeColor: string,
): void {
  if (!bodyPoints || bodyPoints.length === 0 || totalScore <= 0) return;

  const { small, medium, large } = computeDeathOrbs(totalScore);
  let orbIdx = 0;
  const totalOrbs = small + medium + large;
  if (totalOrbs === 0) return;

  // Interleave S/M/L along the body for visual spread
  const orbSequence: Array<{ value: number; size: number; color: string; glowColor: string; orbSize: 'small' | 'medium' | 'large' }> = [];
  for (let i = 0; i < large; i++) orbSequence.push({ value: 5, size: 8, color: '#f472b6', glowColor: '#ec4899', orbSize: 'large' });
  for (let i = 0; i < medium; i++) orbSequence.push({ value: 3, size: 5, color: '#38bdf8', glowColor: '#0ea5e9', orbSize: 'medium' });
  for (let i = 0; i < small; i++) orbSequence.push({ value: 1, size: 3, color: '#34d399', glowColor: '#10b981', orbSize: 'small' });

  // Shuffle for visual variety
  for (let i = orbSequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [orbSequence[i], orbSequence[j]] = [orbSequence[j], orbSequence[i]];
  }

  for (const orb of orbSequence) {
    const segIdx = Math.min(bodyPoints.length - 1, Math.floor((orbIdx / totalOrbs) * bodyPoints.length));
    const pt = bodyPoints[segIdx];
    const scatter = 20;
    const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
    room.foods.push({
      id,
      x: pt.x + (Math.random() - 0.5) * scatter,
      y: pt.y + (Math.random() - 0.5) * scatter,
      size: orb.size,
      value: orb.value,
      isStarChip: false,
      color: orb.color,
      glowColor: orb.glowColor,
      orbSize: orb.orbSize,
    });
    orbIdx++;
  }
}

/**
 * Drop exactly 10 Star collectibles at the exact death position.
 * Each star = carried chips ÷ 10 (floating point, all equal).
 * Stars do NOT scatter — they appear at the death position.
 * ONLY for real players. Bots never drop stars.
 */
export function dropStarsAtDeath(
  room: ArenaRoom,
  x: number,
  y: number,
  chips: number,
): void {
  if (chips <= 0) return;

  const valuePerStar = chips / STAR_DROP_COUNT; // all 10 stars have the exact same value

  for (let i = 0; i < STAR_DROP_COUNT; i++) {
    const id = `food-${room.arena.id}-${room.foodIdCounter++}`;
    // Tiny offset to prevent exact overlap (1px each) — still visually "at death position"
    const offsetX = (i % 5 - 2) * 2;
    const offsetY = (Math.floor(i / 5) - 0.5) * 2;
    room.foods.push({
      id,
      x: x + offsetX,
      y: y + offsetY,
      size: 12,
      value: valuePerStar,
      isStarChip: true,
      color: '#fbbf24',
      glowColor: '#f59e0b',
    });
  }
}

/**
 * Force one bot into self-destruct state to make room for a new human player.
 * If no bots available, does nothing.
 */
export function displaceBotForPlayer(room: ArenaRoom): void {
  if (room.bots.size === 0) return;
  // Pick a random harvesting bot to self-destruct
  const candidates = [...room.bots.values()].filter(b => !b.isDead && b.botState === 'harvesting');
  if (candidates.length === 0) return;
  const bot = candidates[Math.floor(Math.random() * candidates.length)];
  bot.botState = 'selfDestruct';
  bot.wantsBoost = false; // NEVER boost during self-destruct — go slowly
}

// Legacy alias for backward compat with index.ts
export const dropFoodAtBody = dropScoreOrbsAtBody;
export const dropStarChipsAtBody = dropStarsAtDeath;

// ----------------------------------------------------------------------------
// Snake movement
// ----------------------------------------------------------------------------

/**
 * Move a snake one tick. Server-authoritative: only desiredAngle from client.
 * Returns an array of food orbs to drop (from boost tail shedding).
 */
export function tickSnakeMovement(
  snake: SnakeBase,
  desiredAngle: number,
  wantsBoost: boolean,
): Vec2[] {
  if (snake.points.length === 0) return [];
  if (snake.isDead) return [];

  const droppedFood: Vec2[] = [];
  snake.wantsBoost = wantsBoost;

  // 1) Turn — rate-limited, bigger snakes turn slower.
  const turnRate = Math.max(TURN_MIN, TURN_BASE - snake.score * TURN_SCORE_FACTOR);
  snake.angle = turnToward(snake.angle, desiredAngle, turnRate);

  // 2) Speed: extracting < normal < boost.
  let speed = BASE_SPEED;
  if (snake.isExtracting) {
    speed = EXTRACT_GLIDE_SPEED;
  } else if (wantsBoost && snake.points.length > BOOST_MIN_LENGTH && snake.score > INITIAL_SPAWN_SCORE) {
    speed = BOOST_SPEED;
    snake.boostFrameCounter++;
    if (snake.boostFrameCounter >= BOOST_DROP_INTERVAL) {
      snake.boostFrameCounter = 0;
      if (snake.points.length > BOOST_MIN_LENGTH + 1 && snake.score > INITIAL_SPAWN_SCORE + 1) {
        // Record tail position BEFORE popping (for food drop)
        const tail = snake.points[snake.points.length - 1];
        droppedFood.push({ x: tail.x, y: tail.y });
        snake.points.pop();
        snake.score = Math.max(INITIAL_SPAWN_SCORE, snake.score - 1);
      }
    }
  } else {
    snake.wantsBoost = false;
    snake.boostFrameCounter = 0;
  }

  // 3) Move head.
  const head = snake.points[0];
  const nx = head.x + Math.cos(snake.angle) * speed;
  const ny = head.y + Math.sin(snake.angle) * speed;

  // 4) Unshift new head.
  snake.points.unshift({ x: nx, y: ny });

  // 5) Body length = INITIAL_BODY_LENGTH + floor((score - INITIAL_SPAWN_SCORE) / 4)
  //    Growth rate = 1/4 of food value eaten (per rules).
  const targetLen = Math.min(MAX_BODY_LENGTH, INITIAL_BODY_LENGTH + Math.max(0, Math.floor((snake.score - INITIAL_SPAWN_SCORE) / 4)));
  while (snake.points.length > targetLen) snake.points.pop();

  // 6) Size formula.
  snake.size = SIZE_BASE + Math.sqrt(snake.score) * SIZE_SCORE_FACTOR;

  return droppedFood;
}

// ----------------------------------------------------------------------------
// Bot AI
// ----------------------------------------------------------------------------
// Bot AI — personality-driven behavior
// ----------------------------------------------------------------------------

/**
 * Per-bot AI tick. Each bot's personality drives distinct behavior:
 *
 *  - **scavenger**  — cautious edge-dweller. Stays away from center & players.
 *                     Only eats food far from danger. Won't chase anything.
 *  - **opportunist** — balanced. Eats food, evades players at medium range,
 *                     occasionally chases smaller snakes if confident.
 *  - **hunter**      — aggressive. Actively chases smaller snakes (head-on
 *                     intimidation), seeks food aggressively, boosts to close gaps.
 *  - **extractor**   — efficient food vacuum. Prioritizes dense food clusters,
 *                     boosts toward high-value orbs. Less evasive (focused).
 *  - **coward**      — extremely skittish. Flees at 2× evade radius, erratic
 *                     direction changes, never chases, fastest reaction time.
 */
export function tickBot(bot: BotSession, room: ArenaRoom, now: number): void {
  if (bot.points.length === 0 || bot.isDead) return;

  const head = bot.points[0];
  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const mapRadius = getDynamicMapRadius(Math.max(1, realPlayerCount), now);

  // --- Self-destruct state: navigate to nearest wall (all personalities behave same) ---
  if (bot.botState === 'selfDestruct') {
    const awayFromCenter = Math.atan2(head.y - room.mapCenterY, head.x - room.mapCenterX);
    bot.desiredAngle = awayFromCenter;
    bot.wantsBoost = false;

    if (now >= bot.nextThinkAt) {
      bot.nextThinkAt = now + 120;
      const foodQuery = room.grid.queryRadius(head.x, head.y, BOT_FOOD_SCAN_RADIUS);
      let bestFood: GridItem | null = null;
      let bestFoodDist = Infinity;
      for (const item of foodQuery.values()) {
        if (item.kind !== 'food' || (item.value ?? 0) <= 0 || item.isStarChip) continue;
        const d = dist(head.x, head.y, item.x, item.y);
        if (d < bestFoodDist) { bestFoodDist = d; bestFood = item; }
      }
      if (bestFood && bestFoodDist < 120) {
        const foodAngle = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
        bot.desiredAngle = turnToward(awayFromCenter, foodAngle, 0.03);
      }
    }
    tickSnakeMovement(bot, bot.desiredAngle, false);
    return;
  }

  // --- Personality-driven AI ---
  const shouldBoost = bot.personality === 'hunter' || bot.personality === 'extractor';
  const thinkInterval = bot.personality === 'coward' ? 80
    : bot.personality === 'hunter' ? 100
    : bot.personality === 'extractor' ? 90
    : 130 + Math.floor(Math.random() * 80);

  if (now >= bot.nextThinkAt) {
    bot.nextThinkAt = now + thinkInterval;

    // ── Shared: scan nearby food ──
    let bestFood: GridItem | null = null;
    let bestFoodDist = Infinity;
    let bestFoodValue = 0;
    const foodQuery = room.grid.queryRadius(head.x, head.y, BOT_FOOD_SCAN_RADIUS);
    for (const item of foodQuery.values()) {
      if (item.kind !== 'food' || (item.value ?? 0) <= 0 || item.isStarChip) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < bestFoodDist || (d < bestFoodDist + 50 && (item.value ?? 0) > bestFoodValue)) {
        bestFoodDist = d;
        bestFood = item;
        bestFoodValue = item.value ?? 0;
      }
    }

    // ── Shared: scan nearest human player ──
    let nearPlayerDist = Infinity;
    let nearPlayerAngle = 0;
    let nearPlayerSize = 0;
    let nearPlayerHx = 0;
    let nearPlayerHy = 0;
    let nearPlayerVx = 0;
    let nearPlayerVy = 0;
    for (const p of room.players.values()) {
      if (p.isDead || p.matchSettling || p.points.length === 0) continue;
      const ph = p.points[0];
      const d = dist(head.x, head.y, ph.x, ph.y);
      if (d < nearPlayerDist) {
        nearPlayerDist = d;
        nearPlayerAngle = Math.atan2(ph.y - head.y, ph.x - head.x);
        nearPlayerSize = p.size;
        nearPlayerHx = ph.x;
        nearPlayerHy = ph.y;
        nearPlayerVx = Math.cos(p.angle) * BASE_SPEED;
        nearPlayerVy = Math.sin(p.angle) * BASE_SPEED;
      }
    }

    // ── Shared: scan nearby body segments (collision threat) ──
    let threatX = 0;
    let threatY = 0;
    let threatDist = Infinity;
    const threatQuery = room.grid.queryRadius(head.x, head.y, 150);
    for (const item of threatQuery.values()) {
      if (item.kind !== 'segment' || item.snakeId === bot.id || item.segIdx === 0) continue;
      const d = dist(head.x, head.y, item.x, item.y);
      if (d < threatDist) { threatDist = d; threatX = item.x; threatY = item.y; }
    }

    // ── Shared: scan nearby bot snakes (for hunter chase) ──
    let preySnake: SnakeBase | null = null;
    let preyDist = Infinity;
    if (bot.personality === 'hunter') {
      for (const otherBot of room.bots.values()) {
        if (otherBot.id === bot.id || otherBot.isDead || otherBot.points.length === 0) continue;
        if (otherBot.size >= bot.size) continue; // only chase smaller bots
        const oh = otherBot.points[0];
        const d = dist(head.x, head.y, oh.x, oh.y);
        if (d < 600 && d < preyDist) { preyDist = d; preySnake = otherBot; }
      }
    }

    const evadeRadius = bot.personality === 'coward' ? BOT_EVADE_RADIUS * 2
      : bot.personality === 'hunter' ? BOT_EVADE_RADIUS * 0.6
      : bot.personality === 'extractor' ? BOT_EVADE_RADIUS * 0.8
      : BOT_EVADE_RADIUS;

    let desired: number;

    switch (bot.personality) {
      // ──────────────────────────────────────────────────
      // SCAVENGER: cautious edge-dweller, avoids confrontation
      // ──────────────────────────────────────────────────
      case 'scavenger': {
        const distFromCenter = Math.hypot(head.x - room.mapCenterX, head.y - room.mapCenterY);
        const prefersEdge = distFromCenter < mapRadius * 0.6; // prefer outer ring

        // Priority 1: Immediate body threat
        if (threatDist < 120) {
          desired = Math.atan2(head.y - threatY, head.x - threatX);
        }
        // Priority 2: Evasion of human players (large radius)
        else if (nearPlayerDist < evadeRadius * 1.2) {
          desired = Math.atan2(head.y - nearPlayerHy, head.x - nearPlayerHx);
          // Erratic evasion: add random jitter
          desired += (Math.random() - 0.5) * 0.6;
        }
        // Priority 3: Move toward edge if too close to center
        else if (prefersEdge && nearPlayerDist > evadeRadius) {
          const awayFromCenter = Math.atan2(head.y - room.mapCenterY, head.x - room.mapCenterX);
          desired = awayFromCenter + (Math.random() - 0.5) * 0.3;
        }
        // Priority 4: Seek food (only if safe)
        else if (bestFood && nearPlayerDist > evadeRadius) {
          desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
        }
        // Priority 5: Wander near edges
        else {
          desired = bot.angle + (Math.random() - 0.5) * 0.3;
        }
        break;
      }

      // ──────────────────────────────────────────────────
      // OPPORTUNIST: balanced, sometimes chases if confident
      // ──────────────────────────────────────────────────
      case 'opportunist': {
        const isConfident = bot.size > nearPlayerSize && nearPlayerDist < 400;

        if (threatDist < 140) {
          desired = Math.atan2(head.y - threatY, head.x - threatX);
        }
        // Chase smaller player if confident
        else if (isConfident && Math.random() > 0.4) {
          desired = Math.atan2(nearPlayerHy - head.y, nearPlayerHx - head.x);
        }
        // Evade larger player
        else if (nearPlayerDist < evadeRadius && bot.size <= nearPlayerSize) {
          const futurePx = nearPlayerHx + nearPlayerVx * 8;
          const futurePy = nearPlayerHy + nearPlayerVy * 8;
          const futureD = dist(head.x, head.y, futurePx, futurePy);
          if (futureD < evadeRadius) {
            const perpAngle = nearPlayerAngle + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
            desired = perpAngle;
          } else {
            desired = Math.atan2(head.y - nearPlayerHy, head.x - nearPlayerHx);
          }
        }
        else if (bestFood) {
          desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
        }
        else {
          desired = bot.angle + (Math.random() - 0.5) * 0.4;
        }
        break;
      }

      // ──────────────────────────────────────────────────
      // HUNTER: aggressive, chases smaller snakes, boosts
      // ──────────────────────────────────────────────────
      case 'hunter': {
        // Priority 1: Body threat (still dodge)
        if (threatDist < 120) {
          desired = Math.atan2(head.y - threatY, head.x - threatX);
        }
        // Priority 2: Chase smaller bot prey
        else if (preySnake && preyDist < 400) {
          const preyHead = preySnake.points[0];
          const interceptAngle = Math.atan2(preyHead.y - head.y, preyHead.x - head.x);
          desired = interceptAngle;
          bot.wantsBoost = bot.points.length > BOOST_MIN_LENGTH && preyDist < 300;
        }
        // Priority 3: Chase smaller human player
        else if (nearPlayerDist < 500 && bot.size > nearPlayerSize) {
          desired = Math.atan2(nearPlayerHy - head.y, nearPlayerHx - head.x);
          bot.wantsBoost = bot.points.length > BOOST_MIN_LENGTH && nearPlayerDist < 350;
        }
        // Priority 4: Aggressive food seeking
        else if (bestFood) {
          desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
          bot.wantsBoost = bot.points.length > BOOST_MIN_LENGTH && bestFoodDist < 200;
        }
        // Priority 5: Aggressive wander toward center (where action is)
        else {
          const toCenter = Math.atan2(room.mapCenterY - head.y, room.mapCenterX - head.x);
          desired = toCenter + (Math.random() - 0.5) * 0.3;
        }
        break;
      }

      // ──────────────────────────────────────────────────
      // EXTRACTOR: efficient food vacuum, focused eating
      // ──────────────────────────────────────────────────
      case 'extractor': {
        // Priority 1: Body threat
        if (threatDist < 130) {
          desired = Math.atan2(head.y - threatY, head.x - threatX);
        }
        // Priority 2: Evasion (but only at close range — less skittish)
        else if (nearPlayerDist < evadeRadius * 0.8) {
          desired = Math.atan2(head.y - nearPlayerHy, head.x - nearPlayerHx);
        }
        // Priority 3: Prioritize high-value food
        else if (bestFood) {
          desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
          // Boost toward high-value food
          bot.wantsBoost = bot.points.length > BOOST_MIN_LENGTH && bestFoodValue >= 3 && bestFoodDist < 250;
        }
        // Priority 4: Move toward food-dense areas (toward center)
        else {
          const toCenter = Math.atan2(room.mapCenterY - head.y, room.mapCenterX - head.x);
          desired = toCenter + (Math.random() - 0.5) * 0.2;
        }
        break;
      }

      // ──────────────────────────────────────────────────
      // COWARD: extremely skittish, erratic, high evade
      // ──────────────────────────────────────────────────
      case 'coward': {
        // Priority 1: Body threat — PANIC
        if (threatDist < 160) {
          desired = Math.atan2(head.y - threatY, head.x - threatX);
          desired += (Math.random() - 0.5) * 0.8; // erratic panic
        }
        // Priority 2: Far-range player evasion
        else if (nearPlayerDist < evadeRadius) {
          // Run directly away, but with random zigzag
          const awayAngle = Math.atan2(head.y - nearPlayerHy, head.x - nearPlayerHx);
          const zigzag = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
          desired = awayAngle + zigzag;
        }
        // Priority 3: Only eat food if very safe (no players nearby)
        else if (bestFood && nearPlayerDist > evadeRadius * 1.5) {
          desired = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
        }
        // Priority 4: Nervous wander (frequent small turns)
        else {
          desired = bot.angle + (Math.random() - 0.5) * 0.6;
        }
        break;
      }

      default:
        desired = bot.angle + (Math.random() - 0.5) * 0.3;
    }

    // Edge avoidance: if near map boundary, turn back toward center
    const distFromCenter = Math.hypot(head.x - room.mapCenterX, head.y - room.mapCenterY);
    if (distFromCenter > mapRadius - 300) {
      const toCenter = Math.atan2(room.mapCenterY - head.y, room.mapCenterX - head.x);
      desired = turnToward(desired, toCenter, MAX_TURN_PER_TICK * 2);
    }

    bot.desiredAngle = desired;
  }

  // Check self-destruct threshold
  if (bot.score >= BOT_SELF_DESTRUCT_THRESHOLD && bot.botState === 'harvesting') {
    bot.botState = 'selfDestruct';
  }

  // Personality-based boosting (hunters and extractors boost; others don't)
  const canBoost = shouldBoost && bot.points.length > BOOST_MIN_LENGTH;
  tickSnakeMovement(bot, bot.desiredAngle, canBoost && bot.wantsBoost);
}

// ----------------------------------------------------------------------------
// Collision detection
// ----------------------------------------------------------------------------

/** A pending death detected during collision iteration. */
export interface PendingDeath {
  deadId: string;
  killerId?: string;
  cause: 'body' | 'wall' | 'headOn';
}

/**
 * Detect head-to-body collisions via spatial grid.
 * Head hits any foreign body segment → that head's owner dies.
 */
export function detectCollisions(room: ArenaRoom, now: number): PendingDeath[] {
  const deaths: PendingDeath[] = [];
  const seenDead = new Set<string>();

  const allSnakes: SnakeBase[] = collectAllSnakes(room);
  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const mapRadius = getDynamicMapRadius(Math.max(1, realPlayerCount), now);

  for (const snake of allSnakes) {
    if (snake.isDead) continue;
    if (snake.points.length === 0) continue;
    if (now < snake.spawnProtectedUntil) continue;
    if (seenDead.has(snake.id)) continue;

    const head = snake.points[0];

    // Wall collision
    const distFromCenter = Math.hypot(head.x - room.mapCenterX, head.y - room.mapCenterY);
    if (distFromCenter > mapRadius) {
      deaths.push({ deadId: snake.id, killerId: 'wall', cause: 'wall' });
      seenDead.add(snake.id);
      continue;
    }

    // Head-to-body collision (with neck protection)
    const queryR = snake.size + 30;
    const nearby = room.grid.queryRadius(head.x, head.y, queryR);

    for (const item of nearby.values()) {
      if (item.kind !== 'segment') continue;
      if (item.snakeId === snake.id) continue;
      if (item.segIdx === 0) continue; // head-to-head handled separately
      // Neck protection: skip first N segments behind the head (close-call safety)
      if (item.segIdx <= NECK_PROTECTION_SEGS) continue;
      const d = dist(head.x, head.y, item.x, item.y);
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
 * Detect head-on (head-to-head) collisions.
 * Rules:
 *   A) No boost / both boosting → higher score survives
 *   B) Smaller boosting, larger steady → smaller survives
 *   C) Both boosting → higher score survives (same as A)
 *   Tie → both die
 */
export function detectHeadOnCollisions(room: ArenaRoom, now: number): PendingDeath[] {
  const deaths: PendingDeath[] = [];
  const seenDead = new Set<string>();

  const allSnakes: SnakeBase[] = collectAllSnakes(room);
  const headMap = new Map<string, SnakeBase>();
  for (const s of allSnakes) {
    if (s.isDead || s.points.length === 0 || now < s.spawnProtectedUntil) continue;
    headMap.set(s.id, s);
  }

  const processed = new Set<string>();
  for (const snakeA of allSnakes) {
    if (snakeA.isDead || snakeA.points.length === 0 || now < snakeA.spawnProtectedUntil) continue;
    if (seenDead.has(snakeA.id)) continue;
    if (processed.has(snakeA.id)) continue;

    const headA = snakeA.points[0];
    const queryR = snakeA.size + 20;
    const nearby = room.grid.queryRadius(headA.x, headA.y, queryR);

    for (const item of nearby.values()) {
      if (item.kind !== 'segment') continue;
      if (item.segIdx !== 0) continue; // only heads
      const snakeB = headMap.get(item.snakeId ?? '');
      if (!snakeB || snakeB.isDead || snakeB.id === snakeA.id) continue;
      if (seenDead.has(snakeB.id)) continue;
      if (processed.has(snakeB.id)) continue;

      const headB = snakeB.points[0];
      const d = dist(headA.x, headA.y, headB.x, headB.y);
      if (d < (snakeA.size + snakeB.size) * HEAD_ON_HIT_FACTOR) {
        processed.add(snakeA.id);
        processed.add(snakeB.id);

        const aBoosting = snakeA.wantsBoost;
        const bBoosting = snakeB.wantsBoost;
        const aScore = snakeA.score;
        const bScore = snakeB.score;

        let loserId: string | null = null;

        if (aScore === bScore) {
          // Tie: both die
          deaths.push({ deadId: snakeA.id, killerId: snakeB.id, cause: 'headOn' });
          deaths.push({ deadId: snakeB.id, killerId: snakeA.id, cause: 'headOn' });
          seenDead.add(snakeA.id);
          seenDead.add(snakeB.id);
        } else if (aScore > bScore) {
          // A is bigger
          if (bBoosting && !aBoosting) {
            // Rule B: smaller boosting vs larger steady → smaller survives
            loserId = snakeA.id;
          } else {
            // Rule A/C: bigger survives
            loserId = snakeB.id;
          }
        } else {
          // B is bigger
          if (aBoosting && !bBoosting) {
            // Rule B: smaller boosting vs larger steady → smaller survives
            loserId = snakeB.id;
          } else {
            // Rule A/C: bigger survives
            loserId = snakeA.id;
          }
        }

        if (loserId && aScore !== bScore) {
          const winnerId = loserId === snakeA.id ? snakeB.id : snakeA.id;
          deaths.push({ deadId: loserId, killerId: winnerId, cause: 'headOn' });
          seenDead.add(loserId);
        }
        break;
      }
    }
  }

  return deaths;
}

// ----------------------------------------------------------------------------
// Food eating
// ----------------------------------------------------------------------------

/**
 * Eat food via spatial grid.
 * Regular food: snake.score += value (1, 3, or 5). ALL snakes eat.
 * Star chips: carriedChips += value ONLY. NO score change. ONLY real players.
 * Bots NEVER collect star chips.
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
          // Star chips do NOT affect score — they only add to carried chips.
        } else {
          // Regular food orb: ALL snakes eat, score += value.
          snake.score += item.value ?? 1;
        }
        // Zero BOTH the grid item and the real food object.
        item.value = 0;
        if (item.foodRef) item.foodRef.value = 0;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Snapshot
// ----------------------------------------------------------------------------

/** Iterator: yield every snake (player + bot) in the room. */
export function collectAllSnakes(room: ArenaRoom): SnakeBase[] {
  const out: SnakeBase[] = [];
  for (const p of room.players.values()) out.push(p);
  for (const b of room.bots.values()) out.push(b);
  return out;
}

/**
 * Build the broadcast GameSnapshot for an arena.
 */
export function buildSnapshot(room: ArenaRoom, viewerId?: string): GameSnapshot {
  const snakes: SnakeSnapshot[] = [];
  const now = Date.now();
  const realPlayerCount = [...room.players.values()].filter(p => !p.isDead && !p.matchSettling).length;
  const mapRadius = getDynamicMapRadius(Math.max(1, realPlayerCount), now);

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
      isBoosting: snake.wantsBoost,
      botState: snake.botState,
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
    glowColor: f.glowColor,
    orbSize: f.orbSize,
  }));

  // Arena leaderboard: real players by carriedChips desc
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

  const yourRank = viewerId ? sorted.findIndex(p => p.id === viewerId) + 1 : 0;
  const commissionRate = realPlayerCount <= 3 ? 0 : 0.35;

  return {
    arenaId: room.arena.id,
    tick: room.tick,
    snakes,
    foods,
    worldSize: WORLD_SIZE,
    mapRadius,
    mapCenterX: room.mapCenterX,
    mapCenterY: room.mapCenterY,
    leaderId: room.leaderId,
    leaderChips: room.leaderChips,
    realPlayerCount,
    yourRank: yourRank > 0 ? yourRank : 0,
    arenaLeaderboard,
    commissionRate,
  };
}

/**
 * Recompute the arena leader (highest carriedChips).
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

/** Re-populate food up to target. */
export function replenishFood(room: ArenaRoom): void {
  if (room.foods.some((f) => f.value <= 0)) {
    room.foods = room.foods.filter((f) => f.value > 0);
  }
  let guard = 0;
  while (room.foods.length < FOOD_COUNT_TARGET && guard < 50) {
    room.foods.push(spawnRandomFood(room));
    guard++;
  }
}

/** Expire chat bubbles. */
export function expireChat(room: ArenaRoom, now: number): void {
  for (const snake of collectAllSnakes(room)) {
    if (snake.chatExpiry && now > snake.chatExpiry) {
      snake.chatMessage = undefined;
      snake.chatExpiry = undefined;
    }
  }
}

// Re-export
export { TICK_MS };
