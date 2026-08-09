// ============================================================================
// Coil Path — Curvature-based body contraction wrapper.
//
// Wraps a PathBuffer to pull body segments inward on curves,
// giving a python-grip tightening effect when the snake coils.
//
// RENDER-ONLY — does not modify the underlying PathBuffer.
// Collision/physics continue using the raw path.
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
 */
export function makeCoiledPath(path: PathLike): PathLike {
  const strength = COIL_CONTRACTION;
  if (strength <= 0) return path; // bypass if disabled

  const len = path.length;

  return {
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
}
