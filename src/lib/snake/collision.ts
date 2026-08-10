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
//      Uses SNAKE_RADIUS so collision triggers when head center enters
//      the body surface, with 1px grace inside.
//
//   Head-on-head: movement line crossing only (eyes can touch, no proximity).
//
// ORDER: Head-on-head checked FIRST to prevent false double-kills on neck
// segments. Head-to-body checked SECOND, skips already-dead snakes.
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
// Head center dies when within (SNAKE_RADIUS - 1)px of spine =
// 1px grace inside the body surface (surface is at SNAKE_RADIUS from spine).
// This catches parallel crawling where swept line crossing misses.
const CRAWL_HIT_DIST_SQ = (SNAKE_RADIUS - 1) * (SNAKE_RADIUS - 1); // 25 for R=6

// ─── Module-level scratch (avoids per-tick allocation) ──────────────────────

const _scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };

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
): CollisionResult {
  const scratch = _scratch;

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
    const dot = getHeadDot(snake);
    scratch.x = dot.x;
    scratch.y = dot.y;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const killEvents: KillEvent[] = [];

  // ══════════════════════════════════════════════════════════════════════════
  // PASS 1: HEAD-ON-HEAD (checked FIRST)
  // ══════════════════════════════════════════════════════════════════════════
  // Movement line crossing only — eyes can touch without dying.
  // Resolved with proper rules: boost wins, then longer snake wins, then tie.
  // Once resolved, both snakes are in deadSnakes, so PASS 2 skips them.

  const hohChecked = new Set<string>(); // prevent double-processing pairs

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
        const lenA = snake.path.length;
        const lenB = otherSnake.path.length;
        const aBoost = snake.boosting;
        const bBoost = otherSnake.boosting;

        if (HEAD_ON_HEAD_BOOST_WINS && aBoost !== bBoost) {
          // Boosting snake wins
          const loserId = aBoost ? otherId : snake.id;
          const loserName = aBoost ? otherSnake.name : snake.name;
          const winnerId = aBoost ? snake.id : otherId;
          const winnerName = aBoost ? snake.name : otherSnake.name;
          deadSnakes.add(loserId);
          const loser = snakes.get(loserId)!;
          killEvents.push({ victimId: loserId, victimName: loserName, killerId: winnerId, killerName: winnerName, score: loser.score, timestamp: now });
        } else if (lenA > lenB) {
          // Longer snake wins
          deadSnakes.add(otherId);
          killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
        } else if (lenB > lenA) {
          // Longer snake wins
          deadSnakes.add(snake.id);
          killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        } else {
          // Same length: both die
          deadSnakes.add(snake.id);
          deadSnakes.add(otherId);
          killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
          killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PASS 2: HEAD-TO-BODY (checked SECOND, skips head-on-head victims)
  // ══════════════════════════════════════════════════════════════════════════
  // Swept line-segment intersection + point-to-segment proximity.
  // No neck skip — ALL body segments are checked. No crawl exploit.
  // Snakes already dead from head-on-head are skipped.

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
    const checkedSnakes = new Set<string>();

    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id || checkedSnakes.has(otherId)) continue;
      checkedSnakes.add(otherId);

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      // Narrow phase: two independent detection methods.
      // Starts from segment 1 (first body point, no neck skip).
      const len = otherSnake.path.length;
      let hit = false;
      // Midpoint of head CENTER movement
      const midHcx = (prevHcx + hcx) * 0.5;
      const midHcy = (prevHcy + hcy) * 0.5;
      for (let j = 1; j < len - 1; j++) {
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
        //    Uses body-radius-based threshold (1px grace inside surface).
        if (distPointToSegSq(hcx, hcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ
          || distPointToSegSq(prevHcx, prevHcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ
          || distPointToSegSq(midHcx, midHcy, sx, sy, ex, ey) <= CRAWL_HIT_DIST_SQ) {
          hit = true;
          break;
        }
      }

      if (hit) {
        deadSnakes.add(snake.id);
        killEvents.push({
          victimId: snake.id, victimName: snake.name,
          killerId: otherId, killerName: otherSnake.name,
          score: snake.score, timestamp: now,
        });
        break;
      }
    }
  }

  return { deadIds: deadSnakes, killEvents };
}
