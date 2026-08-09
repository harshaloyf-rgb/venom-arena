// ============================================================================
// Vec2 — Minimal math utilities for 2D vectors. No side effects.
// ============================================================================

/** Squared distance using raw coordinates — no object allocation */
export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}
