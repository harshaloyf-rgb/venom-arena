// ============================================================================
// Bot AI — 6 distinct bot personality types with unique behaviors.
// Shared by both offline and online modes.
// PERFORMANCE: food scans are capped at MAX_FOOD_SAMPLE to avoid O(bots × food).
// ============================================================================

import type { GameState, Snake, FoodOrb } from './types';
import { BASE_SPEED, SPAWN_RADIUS, INITIAL_SPAWN_RADIUS, BOOST_MIN_SCORE } from './config';

// ─── Bot Types ──────────────────────────────────────────────────────────────

export type BotType = 'hunter' | 'gatherer' | 'ambusher' | 'kamikaze' | 'wanderer' | 'opportunist';

export const BOT_TYPE_LABELS: Record<BotType, string> = {
  hunter: 'Hunter', gatherer: 'Gatherer', ambusher: 'Ambusher',
  kamikaze: 'Kamikaze', wanderer: 'Wanderer', opportunist: 'Opportunist',
};

/** Color palette per bot type: [bodyColor, headColor] */
export const BOT_TYPE_COLORS: Record<BotType, [string, string]> = {
  hunter:     ['#ef4444', '#fca5a5'],
  gatherer:   ['#22c55e', '#86efac'],
  ambusher:   ['#eab308', '#fde047'],
  kamikaze:   ['#f97316', '#fdba74'],
  wanderer:   ['#8b5cf6', '#c4b5fd'],
  opportunist: ['#06b6d4', '#67e8f9'],
};

// ─── Bot Names ──────────────────────────────────────────────────────────────

const BOT_NAMES: Record<BotType, string[]> = {
  hunter: ['Viper', 'Cobra', 'Mamba', 'Taipan', 'Adder', 'Krait', 'Fang', 'Striker', 'Razor', 'Fury'],
  gatherer: ['Nibbles', 'Munch', 'Grazer', 'Harvest', 'Bloom', 'Sprout', 'Patch', 'Clover', 'Meadow', 'Dew'],
  ambusher: ['Shadow', 'Phantom', 'Lurk', 'Stalker', 'Trap', 'Snare', 'Vine', 'Hush', 'Drift', 'Wraith'],
  kamikaze: ['Blaze', 'Crash', 'Rush', 'Dash', 'Bolt', 'Flash', 'Scorch', 'Burn', 'Spark', 'Nova'],
  wanderer: ['Drift', 'Cloud', 'Breeze', 'Wisp', 'Gale', 'Mist', 'Fog', 'Daze', 'Float', 'Zen'],
  opportunist: ['Sly', 'Coyote', 'Jackal', 'Raven', 'Fox', 'Bandit', 'Rogue', 'Thief', 'Vulture', 'Marauder'],
};

// ─── Bot Spawn Mix ──────────────────────────────────────────────────────────

export interface BotSpawnConfig {
  hunter: number; gatherer: number; ambusher: number;
  kamikaze: number; wanderer: number; opportunist: number;
}

/** Default balanced mix: 13 bots */
export const DEFAULT_BOT_MIX: BotSpawnConfig = {
  hunter: 2, gatherer: 3, ambusher: 1, kamikaze: 2, wanderer: 3, opportunist: 2,
};

// ─── Performance Constants ───────────────────────────────────────────────────

/** Max food items to scan per bot per tick (prevents O(bots × 10000)) */
const MAX_FOOD_SAMPLE = 120;
/** Max food items to scan for cluster detection */
const MAX_CLUSTER_SAMPLE = 150;

// ─── Bot AI State (per-instance) ────────────────────────────────────────────

interface HunterState {
  targetId: string | null;
  circling: boolean;
  circleDir: 1 | -1;
  circleTicks: number;
}

interface AmbusherState {
  waiting: boolean;
  waitX: number;
  waitY: number;
  struck: boolean;
  cooldown: number;
}

interface BotAIData {
  type: BotType;
  targetAngle: number;
  wantBoost: boolean;
  retargetTimer: number;
  hunter?: HunterState;
  ambusher?: AmbusherState;
  wanderAngle: number;
  wanderChangeTimer: number;
  /** Cached danger flee angle (only recalculated every DANGER_CHECK_INTERVAL ticks) */
  dangerAngle: number | null;
  dangerTimer: number;
}

// Module-level bot state storage
const botStates = new Map<string, BotAIData>();

function getBotData(snakeId: string): BotAIData | undefined {
  return botStates.get(snakeId);
}

function setBotData(snakeId: string, data: BotAIData): void {
  botStates.set(snakeId, data);
}

function removeBotData(snakeId: string): void {
  botStates.delete(snakeId);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1; const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// ─── Optimized Food Scanning ────────────────────────────────────────────────

/** Sample a random subset of food array for scanning (avoids O(n) on full array) */
function sampleFood(foods: FoodOrb[], maxCount: number): FoodOrb[] {
  const len = foods.length;
  if (len <= maxCount) return foods;
  const sampled: FoodOrb[] = new Array(maxCount);
  for (let i = 0; i < maxCount; i++) {
    sampled[i] = foods[Math.floor(Math.random() * len)];
  }
  return sampled;
}

/** Find nearest food from a sampled set */
function findNearestFood(
  hx: number, hy: number, foods: FoodOrb[], maxDistSq: number,
): { x: number; y: number; distSq: number } | null {
  const sampled = sampleFood(foods, MAX_FOOD_SAMPLE);
  let best: { x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < sampled.length; i++) {
    const f = sampled[i];
    const dSq = distSq(hx, hy, f.x, f.y);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { x: f.x, y: f.y, distSq: dSq };
    }
  }
  return best;
}

/** Find food cluster center from a sampled set */
function findFoodCluster(
  hx: number, hy: number, foods: FoodOrb[], radius: number,
): { x: number; y: number } | null {
  const sampled = sampleFood(foods, MAX_CLUSTER_SAMPLE);
  const rSq = radius * radius;
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < sampled.length; i++) {
    const f = sampled[i];
    if (distSq(hx, hy, f.x, f.y) < rSq) {
      sumX += f.x; sumY += f.y; count++;
    }
  }
  if (count < 3) return null;
  return { x: sumX / count, y: sumY / count };
}

// ─── Snake Scanning ─────────────────────────────────────────────────────────

/** Find nearest alive snake (excluding self) within maxDistSq */
function findNearestSnake(
  snake: Snake, snakes: Map<string, Snake>, maxDistSq: number,
): { id: string; x: number; y: number; score: number; distSq: number } | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  let best: { id: string; x: number; y: number; score: number; distSq: number } | null = null;
  for (const [id, other] of snakes) {
    if (id === snake.id || !other.alive) continue;
    const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { id, x: other.path.headX, y: other.path.headY, score: other.score, distSq: dSq };
    }
  }
  return best;
}

/** Check danger (cached — only recalculated every N ticks) */
const DANGER_CHECK_INTERVAL = 10; // ticks between danger recalculations

function checkDangerCached(snake: Snake, data: BotAIData, snakes: Map<string, Snake>, dangerDistSq: number): { x: number; y: number } | null {
  data.dangerTimer--;
  if (data.dangerTimer <= 0) {
    data.dangerTimer = DANGER_CHECK_INTERVAL;
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    let bestDist = Infinity;
    let bestX = 0, bestY = 0;
    let found = false;
    for (const [id, other] of snakes) {
      if (id === snake.id || !other.alive) continue;
      if (other.score > snake.score * 1.3) {
        const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
        if (dSq < dangerDistSq && dSq < bestDist) {
          bestDist = dSq; bestX = other.path.headX; bestY = other.path.headY; found = true;
        }
      }
    }
    data.dangerAngle = found ? angleTo(bestX, bestY, hx, hy) : null;
  }
  return data.dangerAngle !== null ? { x: snake.path.headX + Math.cos(data.dangerAngle) * 10, y: snake.path.headY + Math.sin(data.dangerAngle) * 10 } : null;
}

function fleeAngle(fromX: number, fromY: number, threatX: number, threatY: number): number {
  return angleTo(threatX, threatY, fromX, fromY);
}

/** Avoid wall: steer away from arena boundary */
function wallAvoidAngle(x: number, y: number, currentAngle: number, boundary: number): number {
  const margin = 600;
  let steerX = 0, steerY = 0;
  if (x > boundary - margin) steerX -= 1;
  if (x < -boundary + margin) steerX += 1;
  if (y > boundary - margin) steerY -= 1;
  if (y < -boundary + margin) steerY += 1;
  if (steerX === 0 && steerY === 0) return currentAngle;
  const avoidAngle = Math.atan2(steerY, steerX);
  return normalizeAngle(avoidAngle * 0.6 + currentAngle * 0.4);
}

// ─── Bot Type Behaviors ─────────────────────────────────────────────────────

const SIGHT_RANGE_SQ = 800 * 800;
const CHASE_RANGE_SQ = 600 * 600;
const STRIKE_RANGE_SQ = 250 * 250;
const FLEE_RANGE_SQ = 500 * 500;
const FOOD_SEEK_RANGE_SQ = 1200 * 1200;
const CLUSTER_RANGE = 500;
const RETARGET_INTERVAL = 30; // ticks (was 15)
const WALL_BOUNDARY = SPAWN_RADIUS;

function updateHunter(snake: Snake, data: BotAIData, state: GameState): void {
  const hs = data.hunter!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Check cached danger
  const danger = checkDangerCached(snake, data, state.snakes, FLEE_RANGE_SQ);
  if (danger) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = true;
    hs.circling = false;
    return;
  }

  // Find or validate target (only on retarget)
  if (data.retargetTimer <= 0) {
    const prey = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ);
    hs.targetId = prey ? prey.id : null;
    if (!prey) hs.circling = false;
    data.retargetTimer = RETARGET_INTERVAL;
  }

  if (!hs.targetId) {
    const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
    data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
    data.wantBoost = false;
    return;
  }

  const target = state.snakes.get(hs.targetId);
  if (!target || !target.alive) { hs.targetId = null; hs.circling = false; data.wantBoost = false; return; }

  const tx = target.path.headX; const ty = target.path.headY;
  const dSq = distSq(hx, hy, tx, ty);

  if (dSq > CHASE_RANGE_SQ) {
    const predictTicks = 15;
    data.targetAngle = angleTo(hx, hy, tx + Math.cos(target.angle) * BASE_SPEED * predictTicks, ty + Math.sin(target.angle) * BASE_SPEED * predictTicks);
    data.wantBoost = true;
    hs.circling = false;
  } else if (dSq > STRIKE_RANGE_SQ) {
    if (!hs.circling) { hs.circling = true; hs.circleDir = Math.random() < 0.5 ? 1 : -1; hs.circleTicks = 0; }
    hs.circleTicks++;
    const aheadX = tx + Math.cos(target.angle) * 100;
    const aheadY = ty + Math.sin(target.angle) * 100;
    const perpOffset = (hs.circleTicks < 30 ? 0.4 : 0.8) * hs.circleDir;
    data.targetAngle = normalizeAngle(angleTo(hx, hy, aheadX, aheadY) + perpOffset);
    data.wantBoost = hs.circleTicks < 20;
  } else {
    data.targetAngle = angleTo(hx, hy, tx + Math.cos(target.angle) * 60, ty + Math.sin(target.angle) * 60);
    data.wantBoost = true;
  }
}

function updateGatherer(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX; const hy = snake.path.headY;

  const danger = checkDangerCached(snake, data, state.snakes, FLEE_RANGE_SQ);
  if (danger) { data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y); data.wantBoost = true; return; }

  if (data.retargetTimer <= 0) { data.retargetTimer = RETARGET_INTERVAL * 2; }

  const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
  if (cluster) {
    data.targetAngle = angleTo(hx, hy, cluster.x, cluster.y);
  } else {
    const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
    data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
  }
  data.wantBoost = false;
}

function updateAmbusher(snake: Snake, data: BotAIData, state: GameState): void {
  const hs = data.ambusher!;
  const hx = snake.path.headX; const hy = snake.path.headY;

  if (hs.cooldown > 0) { hs.cooldown--; data.targetAngle = angleTo(hs.waitX, hs.waitY, hx, hy); data.wantBoost = false; return; }

  const danger = checkDangerCached(snake, data, state.snakes, STRIKE_RANGE_SQ);
  if (danger) { data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y); data.wantBoost = true; hs.waiting = false; return; }

  if (hs.waiting) {
    const prey = findNearestSnake(snake, state.snakes, STRIKE_RANGE_SQ);
    if (prey && prey.score < snake.score * 1.5) {
      data.targetAngle = angleTo(hx, hy, prey.x, prey.y);
      data.wantBoost = true; hs.waiting = false; hs.struck = true; hs.cooldown = 60;
      return;
    }
    const dToWait = Math.sqrt(distSq(hx, hy, hs.waitX, hs.waitY));
    data.targetAngle = dToWait > 50 ? angleTo(hx, hy, hs.waitX, hs.waitY) : data.wanderAngle;
    data.wantBoost = false;
  } else {
    if (data.retargetTimer <= 0) {
      const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE * 2);
      if (cluster) { hs.waitX = cluster.x; hs.waitY = cluster.y; hs.waiting = true; }
      else { const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ); data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle; }
      data.retargetTimer = RETARGET_INTERVAL * 2;
    }
    if (!hs.waiting) {
      const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
      data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
    }
    data.wantBoost = false;
  }
}

function updateKamikaze(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX; const hy = snake.path.headY;
  if (data.retargetTimer <= 0) { data.retargetTimer = 15; } // was 5

  const prey = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ * 2);
  if (prey) { data.targetAngle = angleTo(hx, hy, prey.x, prey.y); data.wantBoost = snake.score >= BOOST_MIN_SCORE; }
  else { const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ); data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle; data.wantBoost = false; }
}

function updateWanderer(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX; const hy = snake.path.headY;

  // Only check danger every DANGER_CHECK_INTERVAL ticks (via cached system)
  const danger = checkDangerCached(snake, data, state.snakes, 300 * 300);
  if (danger) { data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y); data.wantBoost = false; return; }

  data.wanderChangeTimer--;
  if (data.wanderChangeTimer <= 0) {
    const food = findNearestFood(hx, hy, state.foods, 600 * 600);
    if (food && Math.random() < 0.4) { data.wanderAngle = angleTo(hx, hy, food.x, food.y) + (Math.random() - 0.5) * 0.8; }
    else { data.wanderAngle += (Math.random() - 0.5) * 1.5; }
    data.wanderChangeTimer = 60 + Math.floor(Math.random() * 90); // was 30-60
  }
  data.targetAngle = data.wanderAngle;
  data.wantBoost = false;
}

function updateOpportunist(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX; const hy = snake.path.headY;

  const danger = checkDangerCached(snake, data, state.snakes, FLEE_RANGE_SQ);
  if (danger) { data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y); data.wantBoost = true; return; }

  if (data.retargetTimer <= 0) { data.retargetTimer = RETARGET_INTERVAL; }

  let weakTarget: { x: number; y: number; distSq: number } | null = null;
  for (const [id, other] of state.snakes) {
    if (id === snake.id || !other.alive) continue;
    if (other.score < snake.score * 0.7) {
      const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
      if (dSq < CHASE_RANGE_SQ && (!weakTarget || dSq < weakTarget.distSq)) {
        weakTarget = { x: other.path.headX, y: other.path.headY, distSq: dSq };
      }
    }
  }

  if (weakTarget) { data.targetAngle = angleTo(hx, hy, weakTarget.x, weakTarget.y); data.wantBoost = weakTarget.distSq < STRIKE_RANGE_SQ; }
  else {
    const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
    if (cluster) { data.targetAngle = angleTo(hx, hy, cluster.x, cluster.y); }
    else { const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ); data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle; }
    data.wantBoost = false;
  }
}

// ─── Main Update Dispatch ────────────────────────────────────────────────────

const BOT_UPDATERS: Record<BotType, (snake: Snake, data: BotAIData, state: GameState) => void> = {
  hunter: updateHunter, gatherer: updateGatherer, ambusher: updateAmbusher,
  kamikaze: updateKamikaze, wanderer: updateWanderer, opportunist: updateOpportunist,
};

export function updateAllBotAI(state: GameState): void {
  for (const [id, snake] of state.snakes) {
    if (!snake.isBot || !snake.alive) continue;
    const data = getBotData(id);
    if (!data) continue;
    data.retargetTimer--;
    data.wanderChangeTimer = Math.max(0, data.wanderChangeTimer - 1);
    BOT_UPDATERS[data.type](snake, data, state);
    data.targetAngle = wallAvoidAngle(snake.path.headX, snake.path.headY, data.targetAngle, WALL_BOUNDARY);
    snake.targetAngle = data.targetAngle;
  }
}

export function getBotBoost(snakeId: string): boolean {
  return getBotData(snakeId)?.wantBoost ?? false;
}

// ─── Bot Spawning ────────────────────────────────────────────────────────────

let nameCounters: Record<BotType, number> = { hunter: 0, gatherer: 0, ambusher: 0, kamikaze: 0, wanderer: 0, opportunist: 0 };

function pickBotName(type: BotType): string {
  const names = BOT_NAMES[type];
  const idx = nameCounters[type] % names.length;
  nameCounters[type]++;
  return names[idx];
}

function createBotAIData(type: BotType): BotAIData {
  const data: BotAIData = {
    type, targetAngle: Math.random() * Math.PI * 2, wantBoost: false,
    retargetTimer: 0, wanderAngle: Math.random() * Math.PI * 2,
    wanderChangeTimer: Math.floor(Math.random() * 30),
    dangerAngle: null, dangerTimer: 0,
  };
  if (type === 'hunter') data.hunter = { targetId: null, circling: false, circleDir: 1, circleTicks: 0 };
  if (type === 'ambusher') data.ambusher = { waiting: false, waitX: 0, waitY: 0, struck: false, cooldown: 0 };
  return data;
}

/** Find a safe spawn position — 1000px minimum distance from all snakes */
function findBotSpawnPos(state: GameState): { x: number; y: number } {
  const radius = INITIAL_SPAWN_RADIUS * 0.8;
  const SAFE_DIST_SQ = 1000 * 1000; // was 400 — too close, caused surprise deaths
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 800 + Math.random() * (radius - 800); // start farther out
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    let safe = true;
    for (const [, s] of state.snakes) {
      if (!s.alive) continue;
      if (distSq(x, y, s.path.headX, s.path.headY) < SAFE_DIST_SQ) { safe = false; break; }
    }
    if (safe) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  const d = 1200 + Math.random() * (radius - 1200);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

export function spawnBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const now = Date.now();
  let botIndex = 0;
  const types: BotType[] = ['hunter', 'gatherer', 'ambusher', 'kamikaze', 'wanderer', 'opportunist'];
  const counts = [config.hunter, config.gatherer, config.ambusher, config.kamikaze, config.wanderer, config.opportunist];

  for (let t = 0; t < types.length; t++) {
    for (let i = 0; i < counts[t]; i++) {
      const type = types[t];
      const pos = findBotSpawnPos(state);
      const id = `bot-${type}-${botIndex++}`;
      const name = pickBotName(type);
      const startScore = 0; // start at 0 — small body, less collision risk for player

      const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, type);
      snake.isBot = true;
      snake.isPlayer = false;

      state.snakes.set(id, snake);
      setBotData(id, createBotAIData(type));
    }
  }
}

export function respawnDeadBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const targetCount = config.hunter + config.gatherer + config.ambusher + config.kamikaze + config.wanderer + config.opportunist;
  let aliveBots = 0;
  for (const [, s] of state.snakes) { if (s.isBot && s.alive) aliveBots++; }
  if (aliveBots >= targetCount) return;

  const types: BotType[] = ['hunter', 'gatherer', 'ambusher', 'kamikaze', 'wanderer', 'opportunist'];
  const counts = [config.hunter, config.gatherer, config.ambusher, config.kamikaze, config.wanderer, config.opportunist];
  const alivePerType: Record<BotType, number> = { hunter: 0, gatherer: 0, ambusher: 0, kamikaze: 0, wanderer: 0, opportunist: 0 };
  for (const [id, s] of state.snakes) { if (s.isBot && s.alive) { const data = getBotData(id); if (data) alivePerType[data.type]++; } }

  let bestType: BotType = 'wanderer';
  let biggestDeficit = -Infinity;
  for (let t = 0; t < types.length; t++) {
    const deficit_t = counts[t] - alivePerType[types[t]];
    if (deficit_t > biggestDeficit) { biggestDeficit = deficit_t; bestType = types[t]; }
  }

  if (biggestDeficit > 0) {
    const now = Date.now();
    const pos = findBotSpawnPos(state);
    const id = `bot-${bestType}-${Date.now()}`;
    const name = pickBotName(bestType);
    const snake = createSnakeFn(id, name, 0, pos.x, pos.y, now, bestType); // score 0
    snake.isBot = true; snake.isPlayer = false;
    state.snakes.set(id, snake);
    setBotData(id, createBotAIData(bestType));
  }
}

export function removeBot(snakeId: string): void { removeBotData(snakeId); }
export function getBotType(snakeId: string): BotType | undefined { return getBotData(snakeId)?.type; }
export function getTotalBotCount(config: BotSpawnConfig = DEFAULT_BOT_MIX): number {
  return config.hunter + config.gatherer + config.ambusher + config.kamikaze + config.wanderer + config.opportunist;
}
