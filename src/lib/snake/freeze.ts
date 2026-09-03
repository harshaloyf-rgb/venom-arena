// ============================================================================
// G1: BOT HARD FREEZE (Tier-2 flagship optimization)
// ============================================================================
// Bots farther than BOT_FREEZE_DIST from EVERY real player are FROZEN:
//   - no AI (not even lite AI)
//   - no movement (moveSnake skipped)
//   - no food eating / magnet pulls
//   - no score growth
// They are static world geometry until a player comes within range.
//
// WHY: with 999 bots spread over a 29,000px-radius map, >90% are beyond the
// ~2000px view distance at any moment. Skipping their per-tick simulation
// removes the dominant offline/server cost (moveSnake xN, headHash inserts,
// eating queries) while being invisible to players — frozen bots are outside
// everyone's view.
//
// RULES:
//   - Reference = NEAREST ALIVE REAL PLAYER (multiplayer-safe: the online
//     server hosts many players; freezing relative to one arbitrary player
//     would freeze bots that sit next to another player).
//   - Hunter bots (bot-ai isHunter) are EXEMPT — they hunt the player from
//     anywhere on the map; freezing them would break that behavior. Callers
//     check hunter status via bot-ai (getBotIsHunter) so this module stays
//     dependency-free (no import cycles).
//   - When NO player is alive, ALL non-hunter bots freeze (nothing is visible
//     anyway — death screen / empty server). Hunters keep wandering.
//   - Frozen snakes that end up OUTSIDE the pulsing boundary still die —
//     callers apply the boundary check cheaply (distSq vs radiusSq).
//
// This module is pure: imports only types, safe for engine / bot-ai /
// collision / game-server to share without cycles.
// ============================================================================

import type { Snake } from './types';

/** Freeze radius (world px). Bots beyond this distance from every player freeze. */
export const BOT_FREEZE_DIST = 2000;
export const BOT_FREEZE_DIST_SQ = BOT_FREEZE_DIST * BOT_FREEZE_DIST;

export interface FreezeAnchor {
  x: number;
  y: number;
}

// Scratch reused per collection — valid until the next collectFreezeAnchors()
// call. Each consumer collects once per tick and finishes using the array
// before any other consumer collects, so sharing is safe and zero-alloc.
const _anchors: FreezeAnchor[] = [];

/**
 * Collect alive real players as freeze anchors (offline: 1 player;
 * online server: every connected alive player).
 * Accepts either the snakes Map or a values() iterable.
 * Reuses a scratch array — do NOT retain the returned array across calls.
 */
export function collectFreezeAnchors(snakes: Map<string, Snake> | Iterable<Snake>): FreezeAnchor[] {
  _anchors.length = 0;
  const it = snakes instanceof Map ? snakes.values() : snakes;
  let deadPlayerHead: FreezeAnchor | null = null;
  for (const s of it) {
    if (s.isBot || !s.isPlayer) continue;
    if (s.alive) {
      const x = s.path.headX;
      const y = s.path.headY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      _anchors.push({ x, y });
    } else if (!deadPlayerHead) {
      // FIX OFF-15: remember where the player DIED — during the 5s
      // elimination screen the old code returned zero anchors, so EVERY bot
      // hard-froze mid-chase while the killer's red highlight kept animating
      // (the world read as a frame hitch). Anchoring on the death spot keeps
      // the surrounding arena alive through the death flow.
      const x = s.path.headX;
      const y = s.path.headY;
      if (Number.isFinite(x) && Number.isFinite(y)) deadPlayerHead = { x, y };
    }
  }
  if (_anchors.length === 0 && deadPlayerHead) {
    _anchors.push(deadPlayerHead);
  }
  return _anchors;
}

/**
 * Squared distance from (x, y) to the NEAREST anchor.
 * Returns Infinity when there are no anchors (no alive players).
 */
export function nearestAnchorDistSq(anchors: FreezeAnchor[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const dx = anchors[i].x - x;
    const dy = anchors[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Find the nearest anchor and write its coordinates into out (mutated).
 * Returns the squared distance (Infinity when no anchors; out untouched then).
 * Used where callers need both the distance AND the nearest player position
 * (e.g. hunter steering in bot AI).
 */
export function nearestAnchor(
  anchors: FreezeAnchor[], x: number, y: number,
  out: { x: number; y: number },
): number {
  let best = Infinity;
  let bx = 0, by = 0;
  for (let i = 0; i < anchors.length; i++) {
    const dx = anchors[i].x - x;
    const dy = anchors[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < best) { best = d; bx = anchors[i].x; by = anchors[i].y; }
  }
  if (Number.isFinite(best)) { out.x = bx; out.y = by; }
  return best;
}

/**
 * G1 core predicate: is a bot at distSq from its nearest player frozen?
 * Hunter exemption is applied by CALLERS (they know bot identity).
 */
export function isFreezeDistSq(distSq: number): boolean {
  return distSq > BOT_FREEZE_DIST_SQ;
}
