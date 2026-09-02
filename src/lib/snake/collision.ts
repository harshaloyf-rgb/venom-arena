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
import { collectFreezeAnchors, nearestAnchorDistSq, isFreezeDistSq, type FreezeAnchor } from './freeze';
import { getBotIsHunter } from './bot-ai';

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
/** Head-dot offset from head center (inlined in hot loops — T3 zero-alloc). */
const DOT_OFF = SNAKE_RADIUS * DOT_DIST_FACTOR;
/** T3: single-player fallback anchor (no per-call allocation). */
const _singleAnchorScratch: FreezeAnchor[] = [{ x: 0, y: 0 }];
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
// G1 (Tier-2): handles DEGENERATE segments (zero length). Frozen bots don't
// move, so their swept head line collapses to a point. A moving head's line
// must still register a hit when it passes through a frozen head's dot:
// degenerate-vs-segment becomes a point-to-segment distance test against
// SNAKE_RADIUS (the head dot's physical size). Without this, flying through
// a frozen bot's head would silently pass — a new pass-through exploit.

export function segsIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): boolean {
  const d1x = p2x - p1x, d1y = p2y - p1y;
  const d2x = p4x - p3x, d2y = p4y - p3y;
  const len1Sq = d1x * d1x + d1y * d1y;
  const len2Sq = d2x * d2x + d2y * d2y;

  // Degenerate cases (frozen snakes)
  if (len1Sq < 1e-10 && len2Sq < 1e-10) {
    // Two points: collide only if effectively coincident
    const ddx = p1x - p3x, ddy = p1y - p3y;
    return ddx * ddx + ddy * ddy <= SNAKE_RADIUS * SNAKE_RADIUS;
  }
  if (len1Sq < 1e-10) {
    // Point p1 vs segment p3→p4: within head-dot radius of the other line?
    return distPointToSegSq(p1x, p1y, p3x, p3y, p4x, p4y) <= SNAKE_RADIUS * SNAKE_RADIUS;
  }
  if (len2Sq < 1e-10) {
    return distPointToSegSq(p3x, p3y, p1x, p1y, p2x, p2y) <= SNAKE_RADIUS * SNAKE_RADIUS;
  }

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
  // T3 (Tier-3): ALL alive real players — collision culling is measured
  // against the NEAREST player, not one arbitrary player. The online server
  // passes every connected player; with a single anchor, bots near ANOTHER
  // player were culled from the body hash entirely (pass-through hole).
  playerAnchors?: FreezeAnchor[],
): CollisionResult {
  const scratch = _scratch;
  const VIEWPORT_COLLISION_RANGE_SQ = 2000 * 2000;
  // PERF: Clear per-tick caches
  _tailIdxCache.clear();
  // T3: body-hash insert range tightened from 12000px to 5000px.
  // With G1 freeze, heads beyond 2000px are static; a static snake's body
  // trails at most ~2600px behind its head (computeBodyLength(1e6) ≈ 324
  // segments × 8px). Range = freeze(2000) + max trail(~2600) + margin(400)
  // = 5000px guarantees every body pixel that can reach the 2000px live
  // zone still has its snake inserted. 12000² → 5000² removes ~85% of the
  // frozen-body hash inserts.
  const BODY_HASH_RANGE_SQ = (2000 + 3000) * (2000 + 3000);
  const hasPlayerRef = playerX !== undefined && playerY !== undefined;

  // T3: resolve anchor list — explicit anchors, else single player, else
  // collect from the snakes map (covers all callers).
  let anchors: FreezeAnchor[];
  if (playerAnchors !== undefined && playerAnchors.length > 0) {
    anchors = playerAnchors;
  } else if (hasPlayerRef) {
    _singleAnchorScratch[0].x = playerX!;
    _singleAnchorScratch[0].y = playerY!;
    anchors = _singleAnchorScratch;
  } else {
    anchors = collectFreezeAnchors(snakes);
  }
  const hasAnchors = anchors.length > 0;

  // ── Build body spatial hash (broad phase) ──
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    if (hasAnchors && snake.isBot) {
      if (nearestAnchorDistSq(anchors, snake.path.headX, snake.path.headY) > BODY_HASH_RANGE_SQ) continue;
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
  // T3: inlined head-dot math (getHeadDot allocated {x,y} per snake per tick)
  headHash.clear();
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    scratch.x = snake.path.headX + Math.cos(snake.angle) * DOT_OFF;
    scratch.y = snake.path.headY + Math.sin(snake.angle) * DOT_OFF;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  // Reuse pre-allocated Sets/Maps (Issue #6 GC fix)
  const deadSnakes = _deadSnakesSet;
  deadSnakes.clear();
  const killEvents: KillEvent[] = [];

  // ═══════════════ PASS 1: HEAD-ON-HEAD ═══════════════
  // T3 zero-alloc + freeze-aware rewrite:
  //  - head dots computed inline (getHeadDot/getPrevHeadDot allocated 2-4K
  //    {x,y} objects per tick)
  //  - pairs processed in CANONICAL order (snake.id < otherId) — the pair is
  //    seen from exactly one side, so the hohChecked Set + `${a}|${b}` string
  //    keys (~2-4K allocations/tick) are GONE. Symmetry is guaranteed: the
  //    head hash query radius is the same from both sides.
  //  - FROZEN bots skip the outer loop: they don't move, so no crossing can
  //    START from their side; movers still detect frozen heads via the hash
  //    (degenerate-segment branch in segsIntersect keeps the kill live).
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    if (hasAnchors && snake.isBot && !getBotIsHunter(snake.id)
        && isFreezeDistSq(nearestAnchorDistSq(anchors, snake.path.headX, snake.path.headY))) {
      continue; // frozen — no self-initiated movement, no crossings from this side
    }

    // Inline head dot (movement END point)
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    const dotX = hx + Math.cos(snake.angle) * DOT_OFF;
    const dotY = hy + Math.sin(snake.angle) * DOT_OFF;

    // Inline previous head dot (movement START point)
    let prevDotX = dotX, prevDotY = dotY;
    if (snake.path.length >= 2) {
      const pX = snake.path.getX(1);
      const pY = snake.path.getY(1);
      const dx = hx - pX, dy = hy - pY;
      const pAngle = (dx * dx + dy * dy > 0.01) ? Math.atan2(dy, dx) : snake.angle;
      prevDotX = pX + Math.cos(pAngle) * DOT_OFF;
      prevDotY = pY + Math.sin(pAngle) * DOT_OFF;
    }

    const nearby = headHash.query(dotX, dotY, SNAKE_RADIUS * 4);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id || deadSnakes.has(otherId)) continue;
      // Canonical pair order: process only from the smaller id — exactly once.
      if (!(snake.id < otherId)) continue;

      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      // Inline other snake's head dot + prev dot
      const ohx = otherSnake.path.headX;
      const ohy = otherSnake.path.headY;
      const otherDotX = ohx + Math.cos(otherSnake.angle) * DOT_OFF;
      const otherDotY = ohy + Math.sin(otherSnake.angle) * DOT_OFF;
      let otherPrevDotX = otherDotX, otherPrevDotY = otherDotY;
      if (otherSnake.path.length >= 2) {
        const opX = otherSnake.path.getX(1);
        const opY = otherSnake.path.getY(1);
        const odx = ohx - opX, ody = ohy - opY;
        const opAngle = (odx * odx + ody * ody > 0.01) ? Math.atan2(ody, odx) : otherSnake.angle;
        otherPrevDotX = opX + Math.cos(opAngle) * DOT_OFF;
        otherPrevDotY = opY + Math.sin(opAngle) * DOT_OFF;
      }

      // Only movement line crossing — no proximity death (eyes can touch)
      if (segsIntersect(
        prevDotX, prevDotY, dotX, dotY,
        otherPrevDotX, otherPrevDotY, otherDotX, otherDotY,
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
  // survives. Equal length = both die. This matches classic .io convention:
  // the body-owner has right-of-way; shorter snake is the aggressor.

  // Collect all head→body hits as (attackerId, bodyOwnerId) pairs
  const h2bHits: Array<[string, string]> = [];

  // E5 fix: the PASS-2 broad-phase query uses a fixed SNAKE_RADIUS*8 (+3 entity
  // radius ≈ 27px reach), but the narrow-phase crawl threshold grows with the
  // target's bodyRadius (3 + bodyR - 2). At score ≳800K, bodyRadius ≈ 23 →
  // needed reach ≈ 27.4px — the fixed query could miss a lethal crawl overlap.
  // Track the largest grown body radius once per tick and extend the query.
  let maxBodyR = SNAKE_RADIUS;
  for (const [, s] of snakes) {
    if (s.alive && (s.bodyRadius || SNAKE_RADIUS) > maxBodyR) maxBodyR = s.bodyRadius || SNAKE_RADIUS;
  }

  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    // T3: inlined dot math (no {x,y} allocations per snake per tick)
    const hx = snake.path.headX;
    const hy = snake.path.headY;
    const dotX = hx + Math.cos(snake.angle) * DOT_OFF;
    const dotY = hy + Math.sin(snake.angle) * DOT_OFF;
    // Head CENTER for proximity (crawl detection) — symmetric, no dot-offset bias
    const hcx = hx;
    const hcy = hy;
    let prevHcx = hcx, prevHcy = hcy;
    let prevDotX = dotX, prevDotY = dotY;
    if (snake.path.length >= 2) {
      prevHcx = snake.path.getX(1);
      prevHcy = snake.path.getY(1);
      const dx = hx - prevHcx, dy = hy - prevHcy;
      const pAngle = (dx * dx + dy * dy > 0.01) ? Math.atan2(dy, dx) : snake.angle;
      prevDotX = prevHcx + Math.cos(pAngle) * DOT_OFF;
      prevDotY = prevHcy + Math.sin(pAngle) * DOT_OFF;
    }

    // Broad phase: find which snakes have body near this head
    const nearX = (hcx + prevHcx) * 0.5;
    const nearY = (hcy + prevHcy) * 0.5;
    // E5: fixed 8× base radius was marginal vs grown crawl thresholds — extend by
    // the largest grown body radius so mega-snakes can't tunnel the broad phase.
    const nearby = bodyHash.query(nearX, nearY, SNAKE_RADIUS * 8 + (maxBodyR - SNAKE_RADIUS));
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

      // P2 FIX #8 + T3: Skip expensive narrow-phase for bot-vs-bot pairs
      // where BOTH are far from EVERY player's viewport (nearest-anchor).
      if (hasAnchors && snake.isBot && otherSnake.isBot) {
        if (nearestAnchorDistSq(anchors, hcx, hcy) > VIEWPORT_COLLISION_RANGE_SQ
            && nearestAnchorDistSq(anchors, otherSnake.path.headX, otherSnake.path.headY) > VIEWPORT_COLLISION_RANGE_SQ) {
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
          prevDotX, prevDotY, dotX, dotY,
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
