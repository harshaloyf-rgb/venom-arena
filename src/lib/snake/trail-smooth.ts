// ============================================================================
// Trail Smoothing — Port of snek-game body physics for visual testing.
// ============================================================================
// Applies 3 effects from the snek-game.html slither.io clone:
//   1. Quadratic Bézier smoothing between path segments
//   2. Follow damping (CST=0.43) — body contracts toward the head
//   3. Tail contraction (smus) — tail segments rendered closer together
//
// This ONLY affects rendering. Physics (collision, food, boost) use the raw
// PathBuffer and are completely unchanged.
// ============================================================================

/** Follow damping constant (snek-game CST = 0.43) */
const CST = 0.43;

/** Bézier subdivisions per segment */
const SUBDIVS = 6;

/** Separation multipliers — tail segments are closer together (snek-game smus) */
const smus = new Float32Array(200);
for (let i = 0; i < 200; i++) {
  if (i < 4) {
    smus[i] = 1.0;
  } else {
    const n = i - 3;
    const mv = CST * Math.min(n, 4) / 4;
    smus[i] = 1.0 - mv;
  }
}

// ─── Pre-allocated buffers (avoid GC) ─────────────────────────────────────

let _smoothBufSize = 0;
let _sx: Float64Array = new Float64Array(0);
let _sy: Float64Array = new Float64Array(0);
let _cumLen: Float64Array = new Float64Array(0);

function ensureBuffers(size: number): void {
  if (_smoothBufSize >= size) return;
  _smoothBufSize = size;
  _sx = new Float64Array(size);
  _sy = new Float64Array(size);
  _cumLen = new Float64Array(size);
}

/**
 * Apply snek-game-style trail smoothing to walked body positions.
 * Modifies xs/ys/angles in place. Same count, same head/tail positions.
 *
 * @param xs  Walked X positions (head at index 0)
 * @param ys  Walked Y positions (head at index 0)
 * @param angles  Walked angles (recomputed after smoothing)
 * @param count  Number of walked segments
 */
export function smoothTrailInPlace(
  xs: Float64Array,
  ys: Float64Array,
  angles: Float64Array,
  count: number,
): void {
  if (count < 6) return;

  // ── Step 1: Quadratic Bézier smoothing ──
  // Original points are control points. The curve passes through midpoints
  // between consecutive original points (exactly how slither.io does it).
  const smoothLen = (count - 1) * SUBDIVS + 1;
  ensureBuffers(smoothLen);
  const sx = _sx;
  const sy = _sy;

  // First point stays at head
  sx[0] = xs[0];
  sy[0] = ys[0];

  for (let i = 0; i < count - 1; i++) {
    // P0 = midpoint before current (or current itself for i=0)
    const p0x = i > 0 ? (xs[i - 1] + xs[i]) * 0.5 : xs[i];
    const p0y = i > 0 ? (ys[i - 1] + ys[i]) * 0.5 : ys[i];
    // P1 = current point (Bézier control point)
    const p1x = xs[i];
    const p1y = ys[i];
    // P2 = midpoint after current
    const p2x = (xs[i] + xs[i + 1]) * 0.5;
    const p2y = (ys[i] + ys[i + 1]) * 0.5;

    for (let s = 1; s <= SUBDIVS; s++) {
      const t = s / SUBDIVS;
      const mt = 1 - t;
      const idx = i * SUBDIVS + s;
      // Quadratic Bézier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
      sx[idx] = mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x;
      sy[idx] = mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y;
    }
  }

  // ── Step 2: Follow damping (body contracts toward head) ──
  // In snek-game's addHeadPt(), each trailing point moves toward the next
  // (head-ward) point. First 4 segments ramp up: CST*n/4, then full CST.
  for (let i = smoothLen - 2; i >= 0; i--) {
    const n = smoothLen - 1 - i;
    const factor = n <= 4 ? CST * n / 4 : CST;
    sx[i] += (sx[i + 1] - sx[i]) * factor;
    sy[i] += (sy[i + 1] - sy[i]) * factor;
  }

  // ── Step 3: Resample back to original count with tail contraction ──
  // Compute cumulative arc length along the smoothed curve
  const cumLen = _cumLen;
  cumLen[0] = 0;
  for (let i = 1; i < smoothLen; i++) {
    const dx = sx[i] - sx[i - 1];
    const dy = sy[i] - sy[i - 1];
    cumLen[i] = cumLen[i - 1] + Math.sqrt(dx * dx + dy * dy);
  }
  const totalLen = cumLen[smoothLen - 1];
  if (totalLen < 1) return;

  // Compute target positions using smus separation multipliers
  // Head stays at position 0, tail at the end
  // Intermediate segments use smus[i] spacing (tail contracts)
  let totalWeight = 0;
  for (let i = 0; i < count - 1; i++) {
    totalWeight += smus[Math.min(i, 199)];
  }
  if (totalWeight < 0.01) return;
  const unitLen = totalLen / totalWeight;

  let targetDist = 0;
  let si = 1; // current index in smooth path
  xs[0] = sx[0]; // head stays
  ys[0] = sy[0];

  for (let i = 1; i < count - 1; i++) {
    targetDist += smus[Math.min(i, 199)] * unitLen;
    if (targetDist >= totalLen) {
      // Past the end — clamp to tail
      xs[i] = sx[smoothLen - 1];
      ys[i] = sy[smoothLen - 1];
      continue;
    }
    // Advance si to the segment containing targetDist
    while (si < smoothLen - 1 && cumLen[si] < targetDist) si++;
    // Linear interpolation within segment
    const segStart = cumLen[si - 1];
    const segEnd = cumLen[si];
    const t = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
    xs[i] = sx[si - 1] + (sx[si] - sx[si - 1]) * t;
    ys[i] = sy[si - 1] + (sy[si] - sy[si - 1]) * t;
  }
  // Tail point at the very end
  xs[count - 1] = sx[smoothLen - 1];
  ys[count - 1] = sy[smoothLen - 1];

  // ── Step 4: Recompute angles from smoothed positions ──
  for (let i = 0; i < count; i++) {
    const next = i < count - 1 ? i + 1 : i - 1;
    const dx = xs[next] - xs[i];
    const dy = ys[next] - ys[i];
    angles[i] = Math.atan2(dy, dx);
  }
}

/** Feature flag: enable trail smoothing for the player snake */
export const ENABLE_TRAIL_SMOOTHING = true;
