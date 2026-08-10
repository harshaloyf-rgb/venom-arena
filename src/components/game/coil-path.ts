// ============================================================================
// Coil Path — Curvature-based body contraction wrapper.
//
// Wraps a PathBuffer to pull body segments inward on curves,
// giving a python-grip tightening effect when the snake coils.
//
// RENDER-ONLY — does not modify the underlying PathBuffer.
// Collision/physics continue using the raw path.
//
// P5: Coiled path caching for long snakes.
// For snakes with path length > COIL_CACHE_LENGTH_THRESHOLD, cache the
// coiled path and reuse it for COIL_CACHE_INTERVAL frames.
// ============================================================================

import { COIL_CONTRACTION } from '@/lib/snake/config';

/** Path interface used by the snake renderer */
export interface PathLike {
  getX(i: number): number;
  getY(i: number): number;
  length: number;
  headX: number;
  headY: number;
}

// ─── P5: Coiled path cache ──────────────────────────────────────────────────

/** Minimum path length to consider caching (short snakes are cheap to compute) */
const COIL_CACHE_LENGTH_THRESHOLD = 200;

/** Cache the coiled result for this many frames */
const COIL_CACHE_INTERVAL = 3;

/** Frame counter for cache invalidation */
let _coilFrame = 0;

/** Increment coiled path frame counter — call once per render frame */
export function incrementCoilFrame(): void { _coilFrame++; }

interface CoilCacheEntry {
  path: PathLike;
  frame: number;
}

const _coilCache = new Map<number, CoilCacheEntry>();
// Key = path.headX * 10007 + path.headY (fast hash using head position)

function pathKey(p: PathLike): number {
  return (p.headX * 10007 + p.headY) | 0;
}

/**
 * Creates a wrapped path that applies curvature-based contraction.
 *
 * How it works:
 * For each segment i, compute the midpoint of its neighbors (i-1, i+1).
 * The vector from the segment to that midpoint points OUTWARD (convex side).
 * We negate it and scale by COIL_CONTRACTION to pull the segment INWARD.
 *
 * - Straight segments: midpoint ≈ segment position → zero pull (correct)
 * - Tight curves: midpoint is far from segment → strong inward pull (correct)
 * - Head (i=0) and tail (i=length-1): no pull (anchor points)
 *
 * Performance: O(1) per getX/getY call — just 3 array lookups + math.
 * No pre-computation needed — the curvature is computed on-the-fly.
 *
 * P5: For long snakes (path length > 200), caches the coiled path object
 * and reuses it for 3 frames. The tail of a long snake barely moves
 * between frames, so this is visually imperceptible.
 */
export function makeCoiledPath(path: PathLike): PathLike {
  const strength = COIL_CONTRACTION;
  if (strength <= 0) return path; // bypass if disabled

  const len = path.length;

  // P5: Check cache for long snakes
  const key = pathKey(path);
  if (len > COIL_CACHE_LENGTH_THRESHOLD) {
    const cached = _coilCache.get(key);
    if (cached && (_coilFrame - cached.frame) < COIL_CACHE_INTERVAL) {
      return cached.path;
    }
  }

  const coiled: PathLike = {
    getX(i: number): number {
      if (i <= 0 || i >= len - 1) return path.getX(i);
      const midX = (path.getX(i - 1) + path.getX(i + 1)) * 0.5;
      const x = path.getX(i);
      return x - (midX - x) * strength;
    },
    getY(i: number): number {
      if (i <= 0 || i >= len - 1) return path.getY(i);
      const midY = (path.getY(i - 1) + path.getY(i + 1)) * 0.5;
      const y = path.getY(i);
      return y - (midY - y) * strength;
    },
    get length() { return len; },
    get headX() { return path.headX; },
    get headY() { return path.headY; },
  };

  // P5: Store in cache
  if (len > COIL_CACHE_LENGTH_THRESHOLD) {
    // Prune old entries if cache grows too large
    if (_coilCache.size > 30) {
      const firstKey = _coilCache.keys().next().value;
      if (firstKey !== undefined) _coilCache.delete(firstKey);
    }
    _coilCache.set(key, { path: coiled, frame: _coilFrame });
  }

  return coiled;
}
