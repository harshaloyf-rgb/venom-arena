// ============================================================================
// Collision Detection — SHARED collision logic for both offline and online modes.
//
// Handles snake-to-body and head-on-head collision detection using spatial hashing.
// Both modes use identical collision logic — edit here to change both at once.
// ============================================================================

import type { Snake } from './types';
import { SpatialHash, type SpatialEntity } from './spatial-hash';
import { distSq } from './vec2';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS, NECK_PROTECTION, HEAD_ON_HEAD_BOOST_WINS } from './config';

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

const COLLISION_DIST_SQ = SNAKE_RADIUS * 2 * SNAKE_RADIUS * 2;
const DOT_DIST_FACTOR = 0.75;

// ─── Module-level scratch (avoids per-tick allocation) ──────────────────────

const _scratch: SpatialEntity = { x: 0, y: 0, radius: 0, id: 0 };

// ─── Collision Detection ───────────────────────────────────────────────────

/**
 * Check all snake-to-snake collisions (head-to-body + head-on-head).
 * Uses spatial hashing for O(n) broad phase, then distance checks for narrow phase.
 *
 * @param snakes  - Map of all living/dead snakes
 * @param bodyHash - Spatial hash for body segments (reused between ticks, caller clears)
 * @param headHash - Spatial hash for head collision points (reused between ticks, caller clears)
 * @param now     - Current timestamp (for spawn protection)
 * @returns CollisionResult with dead snake IDs and kill events
 */
export function checkCollisions(
  snakes: Map<string, Snake>,
  bodyHash: SpatialHash,
  headHash: SpatialHash,
  now: number,
): CollisionResult {
  const scratch = _scratch;

  // ── Build body segment spatial hash (every 2nd segment for perf) ──
  bodyHash.clear();
  scratch.radius = SNAKE_RADIUS;
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    // Skip body segments from recently spawned snakes — their body is
    // invisible to the player and causes surprise deaths
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    const len = snake.path.length;
    scratch.id = snake.id;
    // Skip head (i=0) and neck segments (NECK_PROTECTION) so that:
    // - Head-on-head collisions fall through to the dedicated handler (Bug 5)
    // - Neck segments don't cause phantom kills (Bug 3)
    const bodyStart = NECK_PROTECTION;
    for (let i = bodyStart; i < len; i += 2) {
      scratch.x = snake.path.getX(i);
      scratch.y = snake.path.getY(i);
      bodyHash.insert(scratch);
    }
  }

  // ── Build head collision point hash (offset forward by bodyRadius * 0.75) ──
  headHash.clear();
  for (const [, snake] of snakes) {
    if (!snake.alive) continue;
    scratch.x = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;
    scratch.y = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;
    scratch.radius = SNAKE_RADIUS;
    scratch.id = snake.id;
    headHash.insert(scratch);
  }

  const deadSnakes = new Set<string>();
  const killEvents: KillEvent[] = [];

  // ── Head-to-body collisions ──
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;

    const nearby = bodyHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const entity = nearby[i];
      const otherId = entity.id as string;
      if (otherId === snake.id) continue;
      if (distSq(dotX, dotY, entity.x, entity.y) <= COLLISION_DIST_SQ) {
        deadSnakes.add(snake.id);
        const killer = snakes.get(otherId);
        killEvents.push({
          victimId: snake.id, victimName: snake.name,
          killerId: otherId, killerName: killer?.name ?? 'Unknown',
          score: snake.score, timestamp: now,
        });
        break;
      }
    }
  }

  // ── Head-on-head collisions ──
  for (const [, snake] of snakes) {
    if (!snake.alive || deadSnakes.has(snake.id)) continue;
    if (now - snake.spawnTime < SPAWN_PROTECTION_MS) continue;
    const dotX = snake.path.headX + Math.cos(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;
    const dotY = snake.path.headY + Math.sin(snake.angle) * snake.bodyRadius * DOT_DIST_FACTOR;

    const nearby = headHash.query(dotX, dotY, SNAKE_RADIUS * 2);
    for (let i = 0; i < nearby.length; i++) {
      const otherId = nearby[i].id as string;
      if (otherId === snake.id || deadSnakes.has(otherId)) continue;
      const otherSnake = snakes.get(otherId);
      if (!otherSnake || !otherSnake.alive) continue;
      if (now - otherSnake.spawnTime < SPAWN_PROTECTION_MS) continue;

      const otherDotX = otherSnake.path.headX + Math.cos(otherSnake.angle) * otherSnake.bodyRadius * DOT_DIST_FACTOR;
      const otherDotY = otherSnake.path.headY + Math.sin(otherSnake.angle) * otherSnake.bodyRadius * DOT_DIST_FACTOR;
      const dx = dotX - otherDotX;
      const dy = dotY - otherDotY;
      if (dx * dx + dy * dy > COLLISION_DIST_SQ) continue;

      const lenA = snake.path.length;
      const lenB = otherSnake.path.length;
      const aBoost = snake.boosting;
      const bBoost = otherSnake.boosting;

      // Bug 6 fix: if one snake is boosting and the other isn't, boosting wins
      if (HEAD_ON_HEAD_BOOST_WINS && aBoost !== bBoost) {
        const loserId = aBoost ? otherId : snake.id;
        const loserName = aBoost ? otherSnake.name : snake.name;
        const winnerId = aBoost ? snake.id : otherId;
        const winnerName = aBoost ? snake.name : otherSnake.name;
        deadSnakes.add(loserId);
        const loser = snakes.get(loserId)!;
        killEvents.push({ victimId: loserId, victimName: loserName, killerId: winnerId, killerName: winnerName, score: loser.score, timestamp: now });
      } else if (lenA > lenB) {
        deadSnakes.add(otherId);
        killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
      } else if (lenB > lenA) {
        deadSnakes.add(snake.id);
        killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
      } else {
        // Same length — both die
        deadSnakes.add(snake.id);
        deadSnakes.add(otherId);
        killEvents.push({ victimId: snake.id, victimName: snake.name, killerId: otherId, killerName: otherSnake.name, score: snake.score, timestamp: now });
        killEvents.push({ victimId: otherId, victimName: otherSnake.name, killerId: snake.id, killerName: snake.name, score: otherSnake.score, timestamp: now });
      }
    }
  }

  return { deadIds: deadSnakes, killEvents };
}
