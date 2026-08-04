// ============================================================================
// Snapshot Builder — Converts full GameState into a downsampled ArenaSnapshot
// for efficient network broadcast at BROADCAST_RATE (20Hz).
//
// Phase B: Server-side. Called once per server tick to produce the
// compact payload sent to all clients.
// ============================================================================

import type {
  GameState, ArenaSnapshot, SnakeSnapshot, Snake, FoodSize, TurnMetadata,
} from './types';
import { PathBuffer } from './pool';
import {
  BASE_SPEED,
  BODY_DOWNSAMPLE_INTERVAL,
  FOOD_DOWNSAMPLE_RADIUS,
  MAX_SNAKES_PER_SNAPSHOT,
  SPATIAL_CELL_SIZE,
} from './config';

// ── Inner curl (corner-cutting) visual offset ─────────────────────────
const SNAPSHOT_CURL_FACTOR = 6.0;

/**
 * Compute inner curl offset for path index i. Pure function, no side effects.
 * Returns [offsetX, offsetY] to add to the base position.
 */
function curlOffset(
  path: { getX: (i: number) => number; getY: (i: number) => number; length: number },
  i: number,
): [number, number] {
  const len = path.length;
  if (len < 3 || i < 1) return [0, 0];

  const ax = path.getX(i - 1);
  const ay = path.getY(i - 1);
  const cx = path.getX(i);
  const cy = path.getY(i);

  let bx: number, by: number;
  if (i < len - 1) {
    bx = path.getX(i + 1);
    by = path.getY(i + 1);
  } else {
    const dx = cx - ax;
    const dy = cy - ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01) return [0, 0];
    bx = cx + (dx / d) * BASE_SPEED;
    by = cy + (dy / d) * BASE_SPEED;
  }

  const v1x = cx - bx;
  const v1y = cy - by;
  const v2x = ax - cx;
  const v2y = ay - cy;

  const cross = v1x * v2y - v1y * v2x;
  if (Math.abs(cross) < 0.001) return [0, 0];

  const dot = v1x * v2x + v1y * v2y;
  const turnAngle = Math.atan2(Math.abs(cross), dot);

  const travelX = ax - bx;
  const travelY = ay - by;
  const travelLen = Math.sqrt(travelX * travelX + travelY * travelY);
  if (travelLen < 0.01) return [0, 0];

  const invLen = 1 / travelLen;
  let normX: number, normY: number;
  if (cross > 0) {
    normX = -travelY * invLen;
    normY = travelX * invLen;
  } else {
    normX = travelY * invLen;
    normY = -travelX * invLen;
  }

  const offset = turnAngle * SNAPSHOT_CURL_FACTOR;
  return [normX * offset, normY * offset];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Squared distance for food radius check (avoids sqrt). */
function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/** Check if a point is within radius of any player position. */
function nearAnyPlayer(
  x: number,
  y: number,
  players: ReadonlyArray<{ x: number; y: number }>,
  radiusSq: number,
): boolean {
  for (let i = 0; i < players.length; i++) {
    if (distSq(x, y, players[i].x, players[i].y) <= radiusSq) {
      return true;
    }
  }
  return false;
}

// ─── buildSnapshot ────────────────────────────────────────────────────────────

/**
 * Convert the full game state into a downsampled ArenaSnapshot for broadcast.
 *
 * - Body paths are downsampled by BODY_DOWNSAMPLE_INTERVAL.
 * - Only food within FOOD_DOWNSAMPLE_RADIUS of any player is included.
 * - Snakes are sorted: player first, then by score descending.
 * - Limited to MAX_SNAKES_PER_SNAPSHOT snakes.
 */
export function buildSnapshot(
  state: GameState,
  playersNear: ReadonlyArray<{ x: number; y: number }>,
): ArenaSnapshot {
  const foodRadiusSq = FOOD_DOWNSAMPLE_RADIUS * FOOD_DOWNSAMPLE_RADIUS;

  // Collect all alive snakes and sort: player first, then by score desc.
  const aliveSnakes: Snake[] = [];
  for (const [, snake] of state.snakes) {
    if (snake.alive) aliveSnakes.push(snake);
  }
  aliveSnakes.sort((a, b) => {
    // Player always first.
    if (a.isPlayer && !b.isPlayer) return -1;
    if (!a.isPlayer && b.isPlayer) return 1;
    // Then by score descending.
    return b.score - a.score;
  });

  // Limit to max snakes per snapshot.
 const cappedSnakes = aliveSnakes.slice(0, MAX_SNAKES_PER_SNAPSHOT);

  // Build snake snapshots.
  const snakeSnapshots: SnakeSnapshot[] = [];
  for (const snake of cappedSnakes) {
    const snap = buildSnakeSnapshot(snake, state.tickCount);
    snakeSnapshots.push(snap);
  }

  // Filter food near any player.
  const filteredFoods: Array<{ id: number; x: number; y: number; size: FoodSize; value: number }> = [];
  for (let i = 0; i < state.foods.length; i++) {
    const f = state.foods[i];
    if (nearAnyPlayer(f.x, f.y, playersNear, foodRadiusSq)) {
      filteredFoods.push({
        id: f.id,
        x: f.x,
        y: f.y,
        size: f.size,
        value: f.value,
      });
    }
  }

  // Star chips (all included — they're already in the extraction zone).
  const starChips = state.starChips.map(c => ({
    id: c.id,
    x: c.x,
    y: c.y,
    value: c.value,
  }));

  return {
    tick: state.tickCount,
    timestamp: Date.now(),
    snakes: snakeSnapshots,
    foods: filteredFoods,
    starChips,
    extraction: { ...state.extractionZone },
  };
}

// ─── buildSnakeSnapshot ──────────────────────────────────────────────────────

/** Build a downsampled SnakeSnapshot from a full Snake. */
function buildSnakeSnapshot(snake: Snake, tickCount: number): SnakeSnapshot {
  const pathLen = snake.path.length;

  // Downsample body: include every BODY_DOWNSAMPLE_INTERVAL-th segment.
  // Index 0 = head, index 1..N = body (head already stored as hx/hy).
  const bodyCount = Math.ceil((pathLen - 1) / BODY_DOWNSAMPLE_INTERVAL);
  const bodyX = new Float32Array(bodyCount);
  const bodyY = new Float32Array(bodyCount);

  let bodyIdx = 0;
  for (let i = 1; i < pathLen; i += BODY_DOWNSAMPLE_INTERVAL) {
    // Apply inner curl offset (purely visual, computed fresh each snapshot)
    const [ox, oy] = curlOffset(snake.path, i);
    bodyX[bodyIdx] = snake.path.getX(i) + ox;
    bodyY[bodyIdx] = snake.path.getY(i) + oy;
    bodyIdx++;
  }

  // Build turn metadata if spiral is active.
  let turn: TurnMetadata | undefined;
  if (snake.spiral.active) {
    turn = {
      tick: tickCount,
      snakeId: snake.id,
      isSpiral: true,
      startAngle: snake.spiral.startAngle,
      direction: snake.spiral.direction,
      theta: snake.spiral.theta,
      expectedDuration: 0, // Populated by higher-level logic if known.
    };
  }

  return {
    id: snake.id,
    name: snake.name,
    hx: snake.path.headX,
    hy: snake.path.headY,
    angle: snake.angle,
    length: pathLen,
    score: snake.score,
    alive: snake.alive,
    color: snake.color,
    headColor: snake.headColor,
    bodyRadius: snake.bodyRadius,
    boosting: snake.boosting,
    skinId: snake.skinId,
    rarity: snake.rarity,
    bodyX,
    bodyY,
    bodyLen: bodyIdx,
    turn,
  };
}

// ─── snapshotToSnake ─────────────────────────────────────────────────────────

/**
 * Reconstruct a partial Snake from a SnakeSnapshot (client-side).
 * The caller must provide a PathBuffer separately since the snapshot
 * contains downsampled body data.
 *
 * Returns a Partial<Snake> — the caller should merge with defaults
 * for fields not present in the snapshot (e.g. targetAngle, isBot).
 */
export function snapshotToSnake(snapshot: SnakeSnapshot): Partial<Snake> {
  // Rebuild a PathBuffer from the downsampled body.
  const totalLen = snapshot.bodyLen + 1;
  const path = new PathBuffer(totalLen);
  path.headSegIdx = 0;
  path.length = 0;

  // Head at index 0.
  path.data[0] = snapshot.hx;
  path.data[1] = snapshot.hy;
  path.length = 1;

  // Body segments follow.
  for (let i = 0; i < snapshot.bodyLen; i++) {
    const base = (i + 1) * 2;
    path.data[base] = snapshot.bodyX[i];
    path.data[base + 1] = snapshot.bodyY[i];
  }
  path.length = totalLen;

  return {
    id: snapshot.id,
    name: snapshot.name,
    path,
    angle: snapshot.angle,
    prevAngle: snapshot.angle,
    speed: 0, // Not known from snapshot; estimated by ExtrapolationEngine.
    score: snapshot.score,
    alive: snapshot.alive,
    color: snapshot.color,
    headColor: snapshot.headColor,
    bodyRadius: snapshot.bodyRadius,
    boosting: snapshot.boosting,
    skinId: snapshot.skinId,
    rarity: snapshot.rarity,
    spiral: {
      active: snapshot.turn?.isSpiral ?? false,
      startAngle: snapshot.turn?.startAngle ?? 0,
      theta: snapshot.turn?.theta ?? 0,
      ticksElapsed: 0,
      a: 1.0,
      b: 0.05,
      direction: snapshot.turn?.direction ?? 1,
    },
  };
}
