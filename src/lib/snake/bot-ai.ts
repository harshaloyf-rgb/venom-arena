// ============================================================================
// Bot AI — 6 distinct bot personality types with unique behaviors.
// Shared by both offline and online modes.
// ============================================================================

import type { GameState, Snake, FoodOrb } from './types';
import { BASE_SPEED, SPAWN_RADIUS, INITIAL_SPAWN_RADIUS, SNAKE_RADIUS, BOOST_MIN_SCORE } from './config';

// ─── Bot Types ──────────────────────────────────────────────────────────────

export type BotType = 'hunter' | 'gatherer' | 'ambusher' | 'kamikaze' | 'wanderer' | 'opportunist';

export const BOT_TYPE_LABELS: Record<BotType, string> = {
  hunter: 'Hunter',
  gatherer: 'Gatherer',
  ambusher: 'Ambusher',
  kamikaze: 'Kamikaze',
  wanderer: 'Wanderer',
  opportunist: 'Opportunist',
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
  hunter: number;
  gatherer: number;
  ambusher: number;
  kamikaze: number;
  wanderer: number;
  opportunist: number;
}

/** Default balanced mix: 13 bots */
export const DEFAULT_BOT_MIX: BotSpawnConfig = {
  hunter: 2,
  gatherer: 3,
  ambusher: 1,
  kamikaze: 2,
  wanderer: 3,
  opportunist: 2,
};

// ─── Bot AI State (per-instance, stored in module-level Map) ─────────────────

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
  // Shared
  targetAngle: number;
  wantBoost: boolean;
  /** Recalculate target every N ticks to save CPU */
  retargetTimer: number;
  // Type-specific
  hunter?: HunterState;
  ambusher?: AmbusherState;
  wanderAngle: number;
  wanderChangeTimer: number;
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
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

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

/** Find nearest food */
function findNearestFood(
  hx: number, hy: number, foods: FoodOrb[], maxDistSq: number,
): { x: number; y: number; distSq: number } | null {
  let best: { x: number; y: number; distSq: number } | null = null;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const dSq = distSq(hx, hy, f.x, f.y);
    if (dSq < maxDistSq && (!best || dSq < best.distSq)) {
      best = { x: f.x, y: f.y, distSq: dSq };
    }
  }
  return best;
}

/** Find food cluster center (average position of nearby food) */
function findFoodCluster(
  hx: number, hy: number, foods: FoodOrb[], radius: number,
): { x: number; y: number } | null {
  let sumX = 0, sumY = 0, count = 0;
  const rSq = radius * radius;
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (distSq(hx, hy, f.x, f.y) < rSq) {
      sumX += f.x;
      sumY += f.y;
      count++;
    }
  }
  if (count < 3) return null;
  return { x: sumX / count, y: sumY / count };
}

/** Check if any larger snake is within danger radius */
function findDanger(
  snake: Snake, snakes: Map<string, Snake>, dangerDistSq: number,
): { id: string; x: number; y: number; distSq: number } | null {
  const hx = snake.path.headX;
  const hy = snake.path.headY;
  let best: { id: string; x: number; y: number; distSq: number } | null = null;

  for (const [id, other] of snakes) {
    if (id === snake.id || !other.alive) continue;
    if (other.score > snake.score * 1.3) { // 30% bigger = danger
      const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
      if (dSq < dangerDistSq && (!best || dSq < best.distSq)) {
        best = { id, x: other.path.headX, y: other.path.headY, distSq: dSq };
      }
    }
  }
  return best;
}

/** Flee angle: move AWAY from a threat */
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
  // Blend: 60% avoid, 40% current
  return normalizeAngle(avoidAngle * 0.6 + currentAngle * 0.4);
}

// ─── Bot Type Behaviors ─────────────────────────────────────────────────────

const SIGHT_RANGE_SQ = 800 * 800;
const CHASE_RANGE_SQ = 600 * 600;
const STRIKE_RANGE_SQ = 250 * 250;
const FLEE_RANGE_SQ = 500 * 500;
const FOOD_SEEK_RANGE_SQ = 1500 * 1500;
const CLUSTER_RANGE = 600;
const RETARGET_INTERVAL = 15; // ticks
const WALL_BOUNDARY = SPAWN_RADIUS;

function updateHunter(snake: Snake, data: BotAIData, state: GameState): void {
  const hs = data.hunter!;
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Check for danger first (flee from much larger snakes)
  const danger = findDanger(snake, state.snakes, FLEE_RANGE_SQ);
  if (danger) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = true;
    hs.circling = false;
    return;
  }

  // Find or validate target
  if (data.retargetTimer <= 0) {
    const prey = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ);
    if (prey) {
      hs.targetId = prey.id;
    } else {
      hs.targetId = null;
      hs.circling = false;
    }
    data.retargetTimer = RETARGET_INTERVAL;
  }

  if (!hs.targetId) {
    // No prey — seek food
    const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
    data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
    data.wantBoost = false;
    return;
  }

  const target = state.snakes.get(hs.targetId);
  if (!target || !target.alive) {
    hs.targetId = null;
    hs.circling = false;
    data.wantBoost = false;
    return;
  }

  const tx = target.path.headX;
  const ty = target.path.headY;
  const dSq = distSq(hx, hy, tx, ty);

  if (dSq > CHASE_RANGE_SQ) {
    // Far away: boost toward prey
    // Predict where prey will be
    const predictTicks = 15;
    const predX = tx + Math.cos(target.angle) * BASE_SPEED * predictTicks;
    const predY = ty + Math.sin(target.angle) * BASE_SPEED * predictTicks;
    data.targetAngle = angleTo(hx, hy, predX, predY);
    data.wantBoost = true;
    hs.circling = false;
  } else if (dSq > STRIKE_RANGE_SQ) {
    // Medium range: circle around prey
    if (!hs.circling) {
      hs.circling = true;
      hs.circleDir = Math.random() < 0.5 ? 1 : -1;
      hs.circleTicks = 0;
    }
    hs.circleTicks++;
    // Aim ahead of the prey, then curve around
    const aheadDist = 100;
    const aheadX = tx + Math.cos(target.angle) * aheadDist;
    const aheadY = ty + Math.sin(target.angle) * aheadDist;
    const angleToAhead = angleTo(hx, hy, aheadX, aheadY);
    // Add perpendicular offset to circle
    const perpOffset = (hs.circleTicks < 30 ? 0.4 : 0.8) * hs.circleDir;
    data.targetAngle = normalizeAngle(angleToAhead + perpOffset);
    data.wantBoost = hs.circleTicks < 20; // initial burst, then coast to circle
  } else {
    // Close range: cut off — aim in front of prey
    const cutDist = 60;
    const cutX = tx + Math.cos(target.angle) * cutDist;
    const cutY = ty + Math.sin(target.angle) * cutDist;
    data.targetAngle = angleTo(hx, hy, cutX, cutY);
    data.wantBoost = true;
  }
}

function updateGatherer(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Always flee from danger
  const danger = findDanger(snake, state.snakes, FLEE_RANGE_SQ);
  if (danger) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = true;
    return;
  }

  // Find food cluster (preferred) or nearest food
  if (data.retargetTimer <= 0) {
    data.retargetTimer = RETARGET_INTERVAL * 2; // less frequent retargeting
  }

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
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  if (hs.cooldown > 0) {
    hs.cooldown--;
    // Retreat: move away from last position
    data.targetAngle = angleTo(hs.waitX, hs.waitY, hx, hy);
    data.wantBoost = false;
    return;
  }

  // Flee from danger
  const danger = findDanger(snake, state.snakes, FLEE_RANGE_SQ);
  if (danger && danger.distSq < STRIKE_RANGE_SQ) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = true;
    hs.waiting = false;
    return;
  }

  if (hs.waiting) {
    // Check if prey is in strike range
    const prey = findNearestSnake(snake, state.snakes, STRIKE_RANGE_SQ);
    if (prey && prey.score < snake.score * 1.5) {
      // STRIKE!
      data.targetAngle = angleTo(hx, hy, prey.x, prey.y);
      data.wantBoost = true;
      hs.waiting = false;
      hs.struck = true;
      hs.cooldown = 60; // retreat for 60 ticks after striking
      return;
    }
    // Stay near wait position, gentle drift
    const dToWait = Math.sqrt(distSq(hx, hy, hs.waitX, hs.waitY));
    if (dToWait > 50) {
      data.targetAngle = angleTo(hx, hy, hs.waitX, hs.waitY);
      data.wantBoost = false;
    } else {
      // Slow circle near position
      data.targetAngle = data.wanderAngle;
      data.wantBoost = false;
    }
  } else {
    // Find a food cluster to ambush near
    if (data.retargetTimer <= 0) {
      const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE * 2);
      if (cluster) {
        hs.waitX = cluster.x;
        hs.waitY = cluster.y;
        hs.waiting = true;
      } else {
        // Wander toward food
        const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
        data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
      }
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
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Always chase nearest snake
  if (data.retargetTimer <= 0) {
    data.retargetTimer = 5; // retarget frequently
  }

  const prey = findNearestSnake(snake, state.snakes, SIGHT_RANGE_SQ * 2);
  if (prey) {
    data.targetAngle = angleTo(hx, hy, prey.x, prey.y);
    data.wantBoost = snake.score >= BOOST_MIN_SCORE;
  } else {
    // No snakes: boost toward nearest food aggressively
    const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
    data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
    data.wantBoost = false;
  }
}

function updateWanderer(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Slight flee from immediate danger
  const danger = findDanger(snake, state.snakes, 300 * 300);
  if (danger) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = false;
    return;
  }

  // Wander: slowly change direction
  data.wanderChangeTimer--;
  if (data.wanderChangeTimer <= 0) {
    // Bias toward nearby food
    const food = findNearestFood(hx, hy, state.foods, 800 * 800);
    if (food && Math.random() < 0.4) {
      data.wanderAngle = angleTo(hx, hy, food.x, food.y) + (Math.random() - 0.5) * 0.8;
    } else {
      data.wanderAngle += (Math.random() - 0.5) * 1.5;
    }
    data.wanderChangeTimer = 30 + Math.floor(Math.random() * 60);
  }

  data.targetAngle = data.wanderAngle;
  data.wantBoost = false;
}

function updateOpportunist(snake: Snake, data: BotAIData, state: GameState): void {
  const hx = snake.path.headX;
  const hy = snake.path.headY;

  // Flee from larger snakes
  const danger = findDanger(snake, state.snakes, FLEE_RANGE_SQ);
  if (danger) {
    data.targetAngle = fleeAngle(hx, hy, danger.x, danger.y);
    data.wantBoost = true;
    return;
  }

  // Find weak prey (smaller snakes)
  if (data.retargetTimer <= 0) {
    data.retargetTimer = RETARGET_INTERVAL;
  }

  let weakTarget: { id: string; x: number; y: number; distSq: number } | null = null;
  for (const [id, other] of state.snakes) {
    if (id === snake.id || !other.alive) continue;
    // Only target smaller snakes
    if (other.score < snake.score * 0.7) {
      const dSq = distSq(hx, hy, other.path.headX, other.path.headY);
      if (dSq < CHASE_RANGE_SQ && (!weakTarget || dSq < weakTarget.distSq)) {
        weakTarget = { id, x: other.path.headX, y: other.path.headY, distSq: dSq };
      }
    }
  }

  if (weakTarget) {
    // Chase weak prey
    data.targetAngle = angleTo(hx, hy, weakTarget.x, weakTarget.y);
    data.wantBoost = weakTarget.distSq < STRIKE_RANGE_SQ; // boost to finish off
  } else {
    // No weak prey: seek food (prefer clusters = likely death drops)
    const cluster = findFoodCluster(hx, hy, state.foods, CLUSTER_RANGE);
    if (cluster) {
      data.targetAngle = angleTo(hx, hy, cluster.x, cluster.y);
    } else {
      const food = findNearestFood(hx, hy, state.foods, FOOD_SEEK_RANGE_SQ);
      data.targetAngle = food ? angleTo(hx, hy, food.x, food.y) : data.wanderAngle;
    }
    data.wantBoost = false;
  }
}

// ─── Main Update Dispatch ────────────────────────────────────────────────────

const BOT_UPDATERS: Record<BotType, (snake: Snake, data: BotAIData, state: GameState) => void> = {
  hunter: updateHunter,
  gatherer: updateGatherer,
  ambusher: updateAmbusher,
  kamikaze: updateKamikaze,
  wanderer: updateWanderer,
  opportunist: updateOpportunist,
};

/**
 * Update all bot AI states and return input for each bot.
 * Called once per game tick BEFORE moving bots.
 */
export function updateAllBotAI(state: GameState): void {
  for (const [id, snake] of state.snakes) {
    if (!snake.isBot || !snake.alive) continue;

    const data = getBotData(id);
    if (!data) continue;

    // Decrement retarget timer
    data.retargetTimer--;

    // Update wander angle for all types
    data.wanderChangeTimer = Math.max(0, data.wanderChangeTimer - 1);

    // Run type-specific AI
    BOT_UPDATERS[data.type](snake, data, state);

    // Wall avoidance (all types)
    data.targetAngle = wallAvoidAngle(
      snake.path.headX, snake.path.headY,
      data.targetAngle, WALL_BOUNDARY,
    );

    // Apply to snake
    snake.targetAngle = data.targetAngle;
  }
}

/** Get the boost flag for a bot (called when moving) */
export function getBotBoost(snakeId: string): boolean {
  return getBotData(snakeId)?.wantBoost ?? false;
}

// ─── Bot Spawning ────────────────────────────────────────────────────────────

let nameCounters: Record<BotType, number> = {
  hunter: 0, gatherer: 0, ambusher: 0, kamikaze: 0, wanderer: 0, opportunist: 0,
};

function pickBotName(type: BotType): string {
  const names = BOT_NAMES[type];
  const idx = nameCounters[type] % names.length;
  nameCounters[type]++;
  return names[idx];
}

function createBotAIData(type: BotType): BotAIData {
  const data: BotAIData = {
    type,
    targetAngle: Math.random() * Math.PI * 2,
    wantBoost: false,
    retargetTimer: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderChangeTimer: Math.floor(Math.random() * 30),
  };

  if (type === 'hunter') {
    data.hunter = { targetId: null, circling: false, circleDir: 1, circleTicks: 0 };
  }
  if (type === 'ambusher') {
    data.ambusher = { waiting: false, waitX: 0, waitY: 0, struck: false, cooldown: 0 };
  }

  return data;
}

/** Find a safe spawn position away from all snakes */
function findBotSpawnPos(state: GameState): { x: number; y: number } {
  const radius = INITIAL_SPAWN_RADIUS * 0.8;
  for (let attempt = 0; attempt < 20; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 400 + Math.random() * (radius - 400);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    let safe = true;
    const safeDistSq = 400 * 400;
    for (const [, s] of state.snakes) {
      if (!s.alive) continue;
      if (distSq(x, y, s.path.headX, s.path.headY) < safeDistSq) {
        safe = false;
        break;
      }
    }
    if (safe) return { x, y };
  }
  const a = Math.random() * Math.PI * 2;
  const d = 800 + Math.random() * (radius - 800);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}

/** Import createSnake from engine to avoid circular dep — we pass a factory */
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
      const startScore = 20 + Math.floor(Math.random() * 80);

      const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, type);
      snake.isBot = true;
      snake.isPlayer = false;

      state.snakes.set(id, snake);
      setBotData(id, createBotAIData(type));
    }
  }
}

/** Respawn dead bots to maintain population */
export function respawnDeadBots(
  state: GameState,
  config: BotSpawnConfig = DEFAULT_BOT_MIX,
  createSnakeFn: (id: string, name: string, score: number, x: number, y: number, now: number, botType: BotType) => Snake,
): void {
  const targetCount =
    config.hunter + config.gatherer + config.ambusher +
    config.kamikaze + config.wanderer + config.opportunist;

  let aliveBots = 0;
  for (const [, s] of state.snakes) {
    if (s.isBot && s.alive) aliveBots++;
  }

  if (aliveBots >= targetCount) return;

  // Only respawn 1 per tick to avoid frame spikes
  const deficit = targetCount - aliveBots;
  const toSpawn = Math.min(deficit, 1);

  const types: BotType[] = ['hunter', 'gatherer', 'ambusher', 'kamikaze', 'wanderer', 'opportunist'];
  const counts = [config.hunter, config.gatherer, config.ambusher, config.kamikaze, config.wanderer, config.opportunist];

  // Count alive per type
  const alivePerType: Record<BotType, number> = { hunter: 0, gatherer: 0, ambusher: 0, kamikaze: 0, wanderer: 0, opportunist: 0 };
  for (const [id, s] of state.snakes) {
    if (s.isBot && s.alive) {
      const data = getBotData(id);
      if (data) alivePerType[data.type]++;
    }
  }

  // Find which type is most below target
  let bestType: BotType = 'wanderer';
  let biggestDeficit = -Infinity;
  for (let t = 0; t < types.length; t++) {
    const deficit_t = counts[t] - alivePerType[types[t]];
    if (deficit_t > biggestDeficit) {
      biggestDeficit = deficit_t;
      bestType = types[t];
    }
  }

  if (biggestDeficit > 0) {
    const now = Date.now();
    const pos = findBotSpawnPos(state);
    const id = `bot-${bestType}-${Date.now()}`;
    const name = pickBotName(bestType);
    const startScore = 20 + Math.floor(Math.random() * 80);

    const snake = createSnakeFn(id, name, startScore, pos.x, pos.y, now, bestType);
    snake.isBot = true;
    snake.isPlayer = false;

    state.snakes.set(id, snake);
    setBotData(id, createBotAIData(bestType));
  }
}

/** Clean up bot data when a bot is permanently removed */
export function removeBot(snakeId: string): void {
  removeBotData(snakeId);
}

/** Get the bot type for a snake */
export function getBotType(snakeId: string): BotType | undefined {
  return getBotData(snakeId)?.type;
}

/** Get total target bot count from config */
export function getTotalBotCount(config: BotSpawnConfig = DEFAULT_BOT_MIX): number {
  return config.hunter + config.gatherer + config.ambusher + config.kamikaze + config.wanderer + config.opportunist;
}
