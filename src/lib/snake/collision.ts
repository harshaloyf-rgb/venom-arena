// ============================================================================
// Collision Detection — SHARED collision logic for both offline and online modes.
//
// Two detection methods, each with its own geometry:
//
//   1. SWEPT LINE CROSSING (tunneling prevention)
//      Head DOT movement line vs body SPINE segment line.
//      Catches perpendicular/angled approaches where the head passes through.
//      Exact: any crossing = death (no distance threshold needed).
//
//   2. PROXIMITY (parallel crawling detection)
//      Head CENTER vs body SPINE segment.
//      Catches parallel movement where lines don't cross but the head
//      is physically inside the other snake's body cylinder.
//      Threshold: 2*R-2 = 10px (2px grace before surfaces touch).
//
//   Head-on-head: movement line crossing only (eyes can touch, no proximity).
//
// ORDER: Head-on-head checked FIRST to prevent false double-kills on neck
// segments. Head-to-body checked SECOND, skips already-dead snakes.
//
// PERF: All containers are module-level singletons, cleared each tick.
// No per-tick Set/Map/Array allocation — eliminates GC pauses with 1000 bots.
// ============================================================================

import type { Snake } from './types';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { SPAWN_PROTECTION_MS, HEAD_ON_HEAD_BOOST_WINS, SNAKE_RADIUS } from './config';

// ─── Types ──────────────────────────────────────────────────────────────────

/** A kill event emitted when a snake dies from collision */
export interface KillEvent {
  victimId: string;
  victimName: string;
  killerId: string;
  killerName: string;
  score: number;
  timestamp: number;
}

/** Result of a collision check pass */
export interface CollisionResult {
  deadIds: Set<string>;
  killEvents: KillEvent[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DOT_DIST_FACTOR = 0.75;
// Proximity uses head CENTER (not dot) against body spine.
// Head surface touches body surface when center-to-spine distance <=
// 2 * SNAKE_RADIUS (= 12px). We allow 2px grace so collision
// triggers at 10px (= (2*R - 2)² = 100). This catches parallel
// crawling where swept line crossing misses (parallel lines never cross).
const CRAWL_HIT_DIST_SQ = (2 * SNAKE_RADIUS - 2) * (2 * SNAKE_RADIUS - 2); // 100 for R=6

// ─── Module-level singletons (ZERO per-tick allocation) ───────────────────

const _scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
const _aliveSnakes: Snake[] = [];
const _deadSnakes = new Set<string>();
const _killEvents: KillEvent[] = [];
const _h2bHits: [string, string][] = [];
const _h2bMap = new Map<string, string>();
const _checkedSnakes = new Set<string>();

// Scratch objects for head dot positions (avoids per-call {x,y} allocation)
const _headDot = { x: 0, y: 0 };
const _prevHeadDot = { x: 0, y: 0 };
const _otherHeadDot = { x: 0, y: 0 };
const _otherPrevHeadDot = { x: 0, y: 0 };

// ─── 2D cross product ──────────────────────────────────────────────────────

function cross2d(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

// ─── Segment-segment intersection ──────────────────────────────────────────
// Returns true if segment (p1→p2) crosses segment (p3→p4).

function segsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): boolean {
  const d1x = p2x - p1x, d1y = p2y - p1y;
  const d2x = p4x - p3x, d2y = p4y - p3y;
  const d3x = p3x - p1x, d3y = p3y - p1y;

  const denom = cross2d(d1x, d1y, d2x, d2y);
  if (Math.abs(denom) < 1e-10) return false; // parallel

  const t = cross2d(d3x, d3y, d2x, d2y) / denom;
  const u = cross2d(d3x, d3y, d1x, d1y) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ─── Point-to-segment squared distance ────────────────────────────────────
// Returns the squared distance from point (px,py) to segment (ax,ay)→(bx,by).
// Used to detect parallel crawling: if a head dot stays close to a body
// segment without the movement lines actually crossing.

function distPointToSegSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-10) return apx * apx + apy * apy; // degenerate segment
  let t = (apx * abx + apy * aby) / lenSq;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  const cx = ax + t * abx - px;
  const cy = ay + t * aby - py;
  return cx * cx + cy * cy;
}

// ─── Get head dot position into scratch object (no allocation) ─────────────

function fillHeadDot(out: { x: number; y: number }, snake: Snake): void {
  out.x = snake.path.headX + Math.cos(snake.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
  out.y = snake.path.headY + Math.sin(snake.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
}

// ─── Get PREVIOUS head dot position into scratch object (no allocation) ───

function fillPrevHeadDot(out: { x: number; y: number }, snake: Snake): void {
  if (snake.path.length < 2) {
    fillHeadDot(out, snake);
    return;
  }
  const prevHX = snake.path.getX(1);
  const prevHY = snake.path.getY(1);
  const dx = snake.path.headX - prevHX;
  const dy = snake.path.headY - prevHY;
  const prevAngle = (dx * dx + dy * dy > 0.01) ? Math.atan2(dy, dx) : snake.angle;
  out.x = prevHX + Math.cos(prevAngle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
  out.y = prevHY + Math.sin(prevAngle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
}

// ─── Collision Detection ───────────────────────────────────────────────────

/**
 * Check all snake-to-snake collisions using swept line-segment intersection.
 *
 * ORDER: Head-on-head is resolved FIRST, then head-to-body.
 * This prevents false double-kills where both snakes die from hitting
 * each other's neck segments during a head-on approach.
 */
export function checkCollisions(
  snakes: Map<string, Snake>,
  bodyHash: SpatialHash,
  headHash: SpatialHash,
  now: number,
): CollisionResult {
  const scratch = _scratch;

  // ── Reuse module-level containers (clear, don't reallocate) ──
  _aliveSnakes.length = 0;
  _deadSnakes.clear();
  _killEvents.length = 0;
  _h2bHits.length = 0;
  _h2bMap.clear();

  for (const [, snake] of snakes) {
    if (snake.alive) _aliveSnakes.push(snake);
  }

  // ── Build body spatial hash (broad phase) ──
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    const len = snake.path.length;
    scratch.id = snake.id;
    for (let i = 1; i < len; i++) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      bodyHash.insert(scratch);
    }
  }

  // ── Build head hash (for head-on-head broad phase) ──
  headHash.clear();
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    fillHeadDot(scratch, snake);
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASS 1: HEAD-ON-HEAD (checked FIRST)
  // ══════════════════════════════════════════════════════════════════════════
  // Movement line crossing only — eyes can touch without dying.
  // Resolved with proper rules: boost wins, then longer snake wins, then tie.
  // No pair-key Set needed: only process where snake.id < otherId.

  for (const [, snake] of snakes) {
    if (!snake.alive || _deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    fillHeadDot(_headDot, snake);
    fillPrevHeadDot(_prevHeadDot, snake);

    const nearby = headHash.query(_headDot.x, _headDot.y, SNAKE_RADIUS * 4);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      // Only process each pair once: smaller ID is always the initiator
      if (otherId <= snake.id || _deadSnakes.has(otherId)) continue;

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      fillHeadDot(_otherHeadDot, otherSnake);
      fillPrevHeadDot(_otherPrevHeadDot, otherSnake);

      // Only movement line crossing — no proximity death (eyes can touch)
      if (segsIntersect(
        _prevHeadDot.x, _prevHeadDot.y, _headDot.x, _headDot.y,
        _otherPrevHeadDot.x, _otherPrevHeadDot.y, _otherHeadDot.x, _otherHeadDot.y,
      )) {
        const scoreA = snake.score;
        const scoreB = otherSnake.score;
        const aBoost = snake.boosting;
        const bBoost = otherSnake.boosting;

        // Determine winner — there is ALWAYS exactly one winner (never both die).
        // Priority: boost > higher score > deterministic ID tiebreaker.
        let winnerIsA: boolean;
        if (HEAD_ON_HEAD_BOOST_WINS && aBoost !== bBoost) {
          winnerIsA = aBoost; // boosting snake wins
        } else if (scoreA !== scoreB) {
          winnerIsA = scoreA > scoreB; // higher score wins
        } else {
          winnerIsA = snake.id < otherId; // deterministic ID tiebreaker
        }

        const victim = winnerIsA ? otherSnake : snake;
        const killer = winnerIsA ? snake : otherSnake;
        _deadSnakes.add(victim.id);
        _killEvents.push({ victimId: victim.id, victimName: victim.name, killerId: killer.id, killerName: killer.name, score: victim.score, timestamp: now });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASS 2: HEAD-TO-BODY (checked SECOND, skips head-on-head victims)
  // ══════════════════════════════════════════════════════════════════════════

  for (const [, snake] of snakes) {
    if (!snake.alive || _deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    fillHeadDot(_headDot, snake);
    fillPrevHeadDot(_prevHeadDot, snake);
    // Head CENTER for proximity (crawl detection)
    const hcx = snake.path.headX;
    const hcy = snake.path.headY;
    let prevHcx = hcx, prevHcy = hcy;
    if (snake.path.length >= 2) {
      prevHcx = snake.path.getX(1);
      prevHcy = snake.path.getY(1);
    }

    // Broad phase: find which snakes have body near this head
    const nearX = (hcx + prevHcx) * 0.5;
    const nearY = (hcy + prevHcy) * 0.5;
    const nearby = bodyHash.query(nearX, nearY, SNAKE_RADIUS * 6);
    _checkedSnakes.clear();

    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id || _checkedSnakes.has(otherId)) continue;
      _checkedSnakes.add(otherId);

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive || _deadSnakes.has(otherId)) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      // Narrow phase: two independent detection methods.
      const len = otherSnake.path.length;
      let hit = false;
      const midHcx = (prevHcx + hcx) * 0.5;
      const midHcy = (prevHcy + hcy) * 0.5;
      for (let j = 1; j < len - 1; j++) {
        const sx = otherSnake.path.getX(j);
        const sy = otherSnake.path.getY(j);
        const ex = otherSnake.path.getX(j + 1);
        const ey = otherSnake.path.getY(j + 1);
        if (segsIntersect(
          _prevHeadDot.x, _prevHeadDot.y, _headDot.x, _headDot.y,
          sx, sy, ex, ey,
        )) {
          hit = true;
          break;
        }
        if (distPointToSegSq(hcx, hcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ
          || distPointToSegSq(prevHcx, prevHcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ
          || distPointToSegSq(midHcx, midHcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ) {
          hit = true;
          break;
        }
      }

      if (hit) {
        _h2bHits.push([snake.id, otherId]);
        break; // one kill per attacker per tick
      }
    }
  }

  // ── Resolve head-to-body hits with mutual-kill protection ──
  for (let i = 0; i < _h2bHits.length; i++) {
    _h2bMap.set(_h2bHits[i][0], _h2bHits[i][1]);
  }

  for (let i = 0; i < _h2bHits.length; i++) {
    const attackerId = _h2bHits[i][0];
    const bodyOwnerId = _h2bHits[i][1];
    const attacker = snakes.get(attackerId)!;
    const bodyOwner = snakes.get(bodyOwnerId)!;
    const reverseBodyOwnerId = _h2bMap.get(bodyOwnerId);
    if (reverseBodyOwnerId === attackerId) {
      const lenA = attacker.path.length;
      const lenB = bodyOwner.path.length;
      if (lenA > lenB) {
        if (!_deadSnakes.has(bodyOwnerId)) {
          _deadSnakes.add(bodyOwnerId);
          _killEvents.push({ victimId: bodyOwnerId, victimName: bodyOwner.name, killerId: attackerId, killerName: attacker.name, score: bodyOwner.score, timestamp: now });
        }
      } else if (lenB > lenA) {
        if (!_deadSnakes.has(attackerId)) {
          _deadSnakes.add(attackerId);
          _killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
        }
      } else {
        if (!_deadSnakes.has(attackerId)) {
          _deadSnakes.add(attackerId);
          _killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
        }
        if (!_deadSnakes.has(bodyOwnerId)) {
          _deadSnakes.add(bodyOwnerId);
          _killEvents.push({ victimId: bodyOwnerId, victimName: bodyOwner.name, killerId: attackerId, killerName: attacker.name, score: bodyOwner.score, timestamp: now });
        }
      }
    } else {
      if (!_deadSnakes.has(attackerId)) {
        _deadSnakes.add(attackerId);
        _killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
      }
    }
  }

  return { deadIds: _deadSnakes, killEvents: _killEvents };
}
