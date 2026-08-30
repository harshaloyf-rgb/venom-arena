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
// ============================================================================

import type { Snake } from './types';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { SPAWN_PROTECTION_MS, HEAD_ON_HEAD_BOOST_WINS, SNAKE_RADIUS, SEGMENT_SPACING } from './config';

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
// headRadius + bodyRadius. We allow 2px grace so collision triggers at
// (headR + bodyR - 2). Previously used fixed SNAKE_RADIUS=3 for BOTH
// radii, causing pass-through on larger snakes (bodyRadius grows to 10+).
// Now computed per-snake pair in the narrow phase below.
// This constant is only used as a MINIMUM threshold (for degenerate cases).
const MIN_CRAWL_HIT_DIST_SQ = (2 * SNAKE_RADIUS - 2) * (2 * SNAKE_RADIUS - 2); // 16 for R=3

// ─── Module-level scratch (avoids per-tick allocation) ──────────────────────

const _scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };
// Pre-allocated Sets/Maps — cleared each tick, never re-allocated (Issue #6 GC fix)
const _deadSnakesSet = new Set<string>();
const _hohCheckedSet = new Set<string>();
const _checkedSnakesSet = new Set<string>();
const _h2bMap = new Map<string, string>();
// PERF: Cache visualTailIdx per tick — avoids recomputing the sqrt-walk
// for the same snake in both body hash build AND narrow phase.
const _tailIdxCache = new Map<string, number>();

// ─── Visual tail boundary (matches renderer exactly) ───────────────────────
// The renderer (walkPathFixedStep) draws the body by walking the path from
// head and accumulating actual pixel distance. It stops at visualLenPx =
// computeBodyLength(score) * SEGMENT_SPACING. When a snake boosts (6 px/tick
// vs 3 px/tick), path points are further apart so fewer path indices cover
// the same visual length. This function returns the last path index whose
// segment (idx, idx+1) starts within the visual body — matching the renderer.
// Without this, collision checks invisible stretched tail during/after boost.

function getVisualTailIdx(
  getX: (i: number) => number,
  getY: (i: number) => number,
  pathLen: number,
  visualLenPx: number,
): number {
  if (pathLen < 2) return 0;
  let acc = 0;
  for (let i = 0; i < pathLen - 1; i++) {
    const dx = getX(i + 1) - getX(i);
    const dy = getY(i + 1) - getY(i);
    acc += Math.sqrt(dx * dx + dy * dy);
    if (acc > visualLenPx) return i;
  }
  return pathLen - 2;
}

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

// ─── Get head dot position (offset forward from head center) ───────────────

function getHeadDot(snake: Snake): { x: number; y: number } {
  return {
    x: snake.path.headX + Math.cos(snake.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR,
    y: snake.path.headY + Math.sin(snake.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR,
  };
}

// ─── Get PREVIOUS head dot position (from path history) ────────────────────

function getPrevHeadDot(snake: Snake): { x: number; y: number } {
  if (snake.path.length < 2) {
    // No history yet — use current position as fallback
    return getHeadDot(snake);
  }
  const prevHX = snake.path.getX(1);
  const prevHY = snake.path.getY(1);
  // Estimate previous angle from the direction path[1] → path[0]
  const dx = snake.path.headX - prevHX;
  const dy = snake.path.headY - prevHY;
  const prevAngle = (dx * dx + dy * dy > 0.01) ? Math.atan2(dy, dx) : snake.angle;
  return {
    x: prevHX + Math.cos(prevAngle) * SNAKE_RADIUS * DOT_DIST_FACTOR,
    y: prevHY + Math.sin(prevAngle) * SNAKE_RADIUS * DOT_DIST_FACTOR,
  };
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
  // P2 FIX #8: Viewport culling — skip expensive narrow-phase for bot pairs
  // far from the player (player can't see them, so precision doesn't matter).
  playerX?: number,
  playerY?: number,
): CollisionResult {
  const scratch = _scratch;
  const VIEWPORT_COLLISION_RANGE_SQ = 2000 * 2000;
  // PERF: Clear per-tick caches
  _tailIdxCache.clear();
  // FIX: Body hash optimization — skip segments for bots far from the player.
  // Increased from 5000 to 8000: a snake with bodyLength 200 at SEGMENT_SPACING=8
  // has a body that extends 1600px behind its head. At 5000px range, a bot
  // whose head is at 5001px but whose body trails to 3401px was fully excluded.
  const BODY_HASH_RANGE_SQ = 8000 * 8000;
  const hasPlayerRef = playerX !== undefined && playerY !== undefined;

  // ── Build body spatial hash (broad phase) ──
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    if (hasPlayerRef && snake.isBot) {
      const dx = snake.path.headX - playerX!;
      const dy = snake.path.headY - playerY!;
      if (dx * dx + dy * dy > BODY_HASH_RANGE_SQ) continue;
    }
    // PERF: Use cached visual tail idx (avoids sqrt-walk every tick).
    // Recompute only when score changed (cachedVisualTailIdx === -1).
    let maxIdx = snake.cachedVisualTailIdx;
    if (maxIdx < 0) {
      const visualLenPx = snake.cachedBodyLength * SEGMENT_SPACING;
      maxIdx = getVisualTailIdx(
        (i) => snake.path.getX(i),
        (i) => snake.path.getY(i),
        snake.path.length,
        visualLenPx,
      );
      snake.cachedVisualTailIdx = maxIdx;
    }
    // Cache for narrow phase reuse
    _tailIdxCache.set(snake.id, maxIdx);
    scratch.id = snake.id;
    for (let i = 1; i <= maxIdx; i++) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      bodyHash.insert(scratch);
    }
  }

  // ── Build head hash (for head-on-head broad phase) ──
  headHash.clear();
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    const dot = getHeadDot(snake);
    scratch.x = dot.x;
    scratch.y = dot.y;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  // Reuse pre-allocated Sets/Maps (Issue #6 GC fix)
  const deadSnakes = _deadSnakesSet;
  deadSnakes.clear();
  const hohChecked = _hohCheckedSet;
  hohChecked.clear();
  const killEvents: KillEvent[] = [];

  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const dot = getHeadDot(snake);
    const prevDot = getPrevHeadDot(snake);

    const nearby = headHash.query(dot.x, dot.y, SNAKE_RADIUS * 4);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id || deadSnakes.has(otherId)) continue;
      // Prevent checking the same pair twice (A→B and B→A)
      const pairKey = snake.id < otherId ? `${snake.id}|${otherId}` : `${otherId}|${snake.id}`;
      if (hohChecked.has(pairKey)) continue;
      hohChecked.add(pairKey);

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const otherDot = getHeadDot(otherSnake);
      const otherPrevDot = getPrevHeadDot(otherSnake);

      // Only movement line crossing — no proximity death (eyes can touch)
      if (segsIntersect(
        prevDot.x, prevDot.y, dot.x, dot.y,
        otherPrevDot.x, otherPrevDot.y, otherDot.x, otherDot.y,
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
        deadSnakes.add(victim.id);
        killEvents.push({ victimId: victim.id, victimName: victim.name, killerId: killer.id, killerName: killer.name, score: victim.score, timestamp: now });
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASS 2: HEAD-TO-BODY (checked SECOND, skips head-on-head victims)
  // ══════════════════════════════════════════════════════════════════════════
  // Swept line-segment intersection + point-to-segment proximity.
  // No neck skip — ALL body segments are checked. No crawl exploit.
  // Snakes already dead from head-on-head are skipped.
  //
  // MUTUAL KILL RESOLUTION: If both A hits B's body AND B hits A's body
  // in the same tick (common in head-on approaches where each head enters
  // the other's neck zone), only the shorter snake dies. Longer snake
  // survives. Equal length = both die. This matches slither.io convention:
  // the body-owner has right-of-way; shorter snake is the aggressor.

  // Collect all head→body hits as (attackerId, bodyOwnerId) pairs
  const h2bHits: Array<[string, string]> = [];

  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const dot = getHeadDot(snake);
    const prevDot = getPrevHeadDot(snake);
    // Head CENTER for proximity (crawl detection) — symmetric, no dot-offset bias
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
    const checkedSnakes = _checkedSnakesSet;
    checkedSnakes.clear();

    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id || checkedSnakes.has(otherId)) continue;
      checkedSnakes.add(otherId);

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive || deadSnakes.has(otherId)) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      // P2 FIX #8: Skip expensive narrow-phase for bot-vs-bot pairs
      // where BOTH are far from the player viewport.
      if (playerX !== undefined && playerY !== undefined
          && snake.isBot && otherSnake.isBot) {
        const dxA = hcx - playerX;
        const dyA = hcy - playerY;
        const dxB = otherSnake.path.headX - playerX;
        const dyB = otherSnake.path.headY - playerY;
        if (dxA * dxA + dyA * dyA > VIEWPORT_COLLISION_RANGE_SQ
            && dxB * dxB + dyB * dyB > VIEWPORT_COLLISION_RANGE_SQ) {
          continue;
        }
      }

      // Narrow phase: two independent detection methods.
      // Starts from segment 1 (first body point, no neck skip).
      // PERF: Use cached tailIdx from body hash build (avoids sqrt walk).
      const maxCheckIdx = _tailIdxCache.get(otherId) ?? otherSnake.path.length - 2;
      let hit = false;
      // Midpoint of head CENTER movement
      const midHcx = (prevHcx + hcx) * 0.5;
      const midHcy = (prevHcy + hcy) * 0.5;
      // FIX: Use actual body radius of the target snake, not fixed SNAKE_RADIUS.
      // A snake with score 500 has bodyRadius ~10, so collision surface is
      // headRadius(3) + bodyRadius(10) - 2grace = 11px from spine.
      // Previously was always 4px (using SNAKE_RADIUS=3 for both), causing
      // players to pass through large snakes.
      const otherBodyR = otherSnake.bodyRadius || SNAKE_RADIUS;
      const crawlDist = SNAKE_RADIUS + otherBodyR - 2;
      const crawlDistSq = crawlDist * crawlDist;
      for (let j = 1; j <= maxCheckIdx; j++) {
        const sx = otherSnake.path.getX(j);
        const sy = otherSnake.path.getY(j);
        const ex = otherSnake.path.getX(j + 1);
        const ey = otherSnake.path.getY(j + 1);
        // 1. LINE CROSSING: head DOT swept line vs body SPINE segment.
        //    Catches perpendicular/angled approaches (tunneling prevention).
        //    No distance threshold — any geometric crossing = death.
        if (segsIntersect(
          prevDot.x, prevDot.y, dot.x, dot.y,
          sx, sy, ex, ey,
        )) {
          hit = true;
          break;
        }
        // 2. PROXIMITY: head CENTER vs body SPINE segment.
        //    Catches parallel crawling where lines don't cross.
        //    Threshold: headRadius + bodyRadius - 2px grace.
        if (distPointToSegSq(hcx, hcy, sx, sy, ex, ey) <= crawlDistSq
          || distPointToSegSq(prevHcx, prevHcy, sx, sy, ex, ey) <= crawlDistSq
          || distPointToSegSq(midHcx, midHcy, sx, sy, ex, ey) <= crawlDistSq) {
          hit = true;
          break;
        }
      }

      if (hit) {
        h2bHits.push([snake.id, otherId]);
        break; // one kill per attacker per tick
      }
    }
  }

  // ── Resolve head-to-body hits with mutual-kill protection ──
  const h2bMapScratch = _h2bMap;
  h2bMapScratch.clear();
  for (const [attackerId, bodyOwnerId] of h2bHits) {
    h2bMapScratch.set(attackerId, bodyOwnerId);
  }

  for (const [attackerId, bodyOwnerId] of h2bHits) {
    const attacker = snakes.get(attackerId)!;
    const bodyOwner = snakes.get(bodyOwnerId)!;
    // Check if bodyOwner also hit attacker's body (mutual kill)
    const reverseBodyOwnerId = h2bMapScratch.get(bodyOwnerId);
    if (reverseBodyOwnerId === attackerId) {
      // Mutual: both heads are in each other's bodies.
      // Longer snake survives, shorter dies. Equal = both die.
      const lenA = attacker.path.length;
      const lenB = bodyOwner.path.length;
      if (lenA > lenB) {
        // Attacker is longer → body owner (shorter) dies
        if (!deadSnakes.has(bodyOwnerId)) {
          deadSnakes.add(bodyOwnerId);
          killEvents.push({ victimId: bodyOwnerId, victimName: bodyOwner.name, killerId: attackerId, killerName: attacker.name, score: bodyOwner.score, timestamp: now });
        }
      } else if (lenB > lenA) {
        // Body owner is longer → attacker (shorter) dies
        if (!deadSnakes.has(attackerId)) {
          deadSnakes.add(attackerId);
          killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
        }
      } else {
        // Same length: both die
        if (!deadSnakes.has(attackerId)) {
          deadSnakes.add(attackerId);
          killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
        }
        if (!deadSnakes.has(bodyOwnerId)) {
          deadSnakes.add(bodyOwnerId);
          killEvents.push({ victimId: bodyOwnerId, victimName: bodyOwner.name, killerId: attackerId, killerName: attacker.name, score: bodyOwner.score, timestamp: now });
        }
      }
    } else {
      // One-sided: attacker's head hit body, normal kill
      if (!deadSnakes.has(attackerId)) {
        deadSnakes.add(attackerId);
        killEvents.push({ victimId: attackerId, victimName: attacker.name, killerId: bodyOwnerId, killerName: bodyOwner.name, score: attacker.score, timestamp: now });
      }
    }
  }

  return { deadIds: deadSnakes, killEvents };
}
