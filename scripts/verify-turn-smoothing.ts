// ============================================================================
// verify-turn-smoothing.ts — numerical proof for FIX NET-3 (Catmull-Rom path)
//
// Simulates a snake sweeping a turn at server cadence (3px/tick, snapshot
// every 3 ticks = 20Hz head samples ~9px apart) at the REAL minimum turn
// radii from config.ts: minTurnRadius = max(17, 2.2 x bodyRadius):
//   r=17   (small snake, bodyRadius 8)  — worst case, ~31deg per 9px chord
//   r=28.6 (mid snake,  bodyRadius 13)
//   r=55   (big snake,  bodyRadius 25)
// Rebuilds the dense path exactly like RemoteSnakeManager.rebuildPath does:
//   (a) OLD: linear chords between entries  -> inscribed polygon ("V" kinks)
//   (b) NEW: uniform Catmull-Rom through the entries
// Metric: max corner angle between consecutive DENSE (3px) path points.
// A smooth arc has a geometric floor of 2*asin(1.5/r) per 3px step — any
// polyline sampled at 3px cannot go below it. PASS: CR within 1.5x of the
// floor AND <= 50% of the linear kink (corners dissolved into curvature).
// ============================================================================

const SPEED = 3;            // BASE_SPEED px/tick
const SNAP_EVERY = 3;       // server broadcasts every 3rd tick
const DENSE_STEP = SPEED;   // client rebuild step (~3px)
const RADII = [17, 28.6, 55]; // max(17, 2.2 x bodyRadius) for br=8/13/25

// ── rebuildPath replica ──
function linearPath(entries: { x: number; y: number }[]) {
  const pts: { x: number; y: number }[] = [entries[0]];
  for (let i = 0; i < entries.length - 1; i++) {
    const dx = entries[i + 1].x - entries[i].x;
    const dy = entries[i + 1].y - entries[i].y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) continue;
    const steps = Math.max(1, Math.round(dist / DENSE_STEP));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      pts.push({ x: entries[i].x + dx * t, y: entries[i].y + dy * t });
    }
  }
  return pts;
}

function crPath(entries: { x: number; y: number }[]) {
  const pts: { x: number; y: number }[] = [entries[0]];
  for (let i = 0; i < entries.length - 1; i++) {
    const p1 = entries[i], p2 = entries[i + 1];
    const p0 = i > 0 ? entries[i - 1] : p1;
    const p3 = i + 2 < entries.length ? entries[i + 2] : p2;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (dist < 0.01) continue;
    const steps = Math.max(1, Math.round(dist / DENSE_STEP));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      pts.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return pts;
}

// ── Metrics ──
function maxCornerAngle(pts: { x: number; y: number }[]): number {
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d1x = pts[i].x - pts[i - 1].x, d1y = pts[i].y - pts[i - 1].y;
    const d2x = pts[i + 1].x - pts[i].x, d2y = pts[i + 1].y - pts[i].y;
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    if (l1 < 0.01 || l2 < 0.01) continue;
    const cos = (d1x * d2x + d1y * d2y) / (l1 * l2);
    const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (ang > worst) worst = ang;
  }
  return worst;
}

function maxRadialDeviation(pts: { x: number; y: number }[], R: number): number {
  // True circle center: (0, R). Ignore endpoints (start tangent clamps).
  let worst = 0;
  for (const p of pts) {
    const d = Math.abs(Math.hypot(p.x, p.y - R) - R);
    if (d > worst) worst = d;
  }
  return worst;
}

let allPass = true;
for (const R of RADII) {
  // ── Server side: 20Hz head samples along a half-circle arc ──
  const heads: { x: number; y: number }[] = [];
  let traveled = 0;
  let tick = 0;
  while (traveled <= R * Math.PI) {
    if (tick % SNAP_EVERY === 0) {
      const a = traveled / R;
      heads.push({ x: R * Math.sin(a), y: R * (1 - Math.cos(a)) });
    }
    traveled += SPEED;
    tick++;
  }

  const lin = linearPath(heads);
  const cr = crPath(heads);
  const linCorner = maxCornerAngle(lin);
  const crCorner = maxCornerAngle(cr);
  const floor = 2 * Math.asin(1.5 / R) * 180 / Math.PI; // dense-polyline floor
  const linDev = maxRadialDeviation(lin, R);
  const crDev = maxRadialDeviation(cr, R);
  const ok = crCorner <= floor * 1.5 && crCorner <= linCorner * 0.5;
  if (!ok) allPass = false;
  console.log(
    `r=${R}px  corners: linear=${linCorner.toFixed(1)}deg  catmull-rom=${crCorner.toFixed(1)}deg  (floor=${floor.toFixed(1)}deg)  ` +
    `radial-dev: linear=${linDev.toFixed(2)}px  cr=${crDev.toFixed(2)}px  ${ok ? 'OK' : 'FAIL'}`,
  );
}
console.log(allPass ? 'TURN_SMOOTHING_PASS' : 'TURN_SMOOTHING_FAIL');
process.exit(allPass ? 0 : 1);
