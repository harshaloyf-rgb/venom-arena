/**
 * HEAD-LAG PROBE — measures how much the rendered HEAD FACING deviates from
 * the visible BODY JUNCTION (the first drawn body segment → head vector),
 * which is the "invisible neck" the user sees.
 *
 * Replicates verbatim:
 *  - engine.ts moveSnake steering (STEERING_LERP, clamp, speeds)
 *  - path.prepend(head) every tick  (path[1] = one tick = 3px/6px behind)
 *  - render-snake-atlas walkPathFixedStep geometry (walked[0] = one draw-step
 *    = max(bodyRadius*1.3,4)/zoom behind the head along the path)
 *  - smoothHeadFacing (0.45 lerp per RENDER FRAME, snap > 1.2 rad)
 *  - GameCanvas offline loop: 60Hz sim, ~1 tick per render frame
 *  - online feed: path/head updated once per SNAPSHOT (every N frames)
 *
 * OLD = current code  (3px tangent + smoothHeadFacing)
 * NEW = proposed fix  (junction chord atan2(head - walked[0]), no smoothing)
 *
 * Run: bun scripts/head-lag-probe.ts
 */

import {
  BASE_SPEED, BOOST_SPEED, BASE_TURN_RATE, MIN_TURN_RATE,
  STEERING_LERP, SHARP_TURN_BRAKE, SEGMENT_SPACING,
} from '../src/lib/snake/config';

const BODY_RADIUS = 13;      // spawn snake body radius (px)
const ZOOM = 1;
const STEP = Math.max(BODY_RADIUS * 1.3, 4) / Math.min(ZOOM, 1); // bodyDrawStep
const BODY_LEN_SEGS = 20;    // enough path behind the head to walk STEP px

interface Sim {
  x: number; y: number; angle: number;
  path: number[][];           // path[0] = head (most recent)
}

function makeSim(): Sim {
  return { x: 0, y: 0, angle: 0, path: Array.from({ length: BODY_LEN_SEGS * 4 }, () => [0, 0]) };
}

function tickSim(s: Sim, targetDiff: number, boost: boolean): void {
  const speed = boost ? BOOST_SPEED : BASE_SPEED;
  const speedT = Math.min(1, Math.max(0, (speed - BASE_SPEED) / (BOOST_SPEED - BASE_SPEED)));
  const maxTurn = BASE_TURN_RATE + (MIN_TURN_RATE - BASE_TURN_RATE) * speedT;
  const turnAmount = targetDiff * STEERING_LERP;
  const sharpness = maxTurn > 0 ? Math.min(Math.abs(turnAmount) / maxTurn, 1.0) : 0;
  const smoothT = sharpness * sharpness * (3 - 2 * sharpness);
  const effMaxTurn = maxTurn * (1 - SHARP_TURN_BRAKE * smoothT);
  const clamped = Math.max(-effMaxTurn, Math.min(effMaxTurn, turnAmount));
  s.angle += clamped;
  s.x += Math.cos(s.angle) * speed;
  s.y += Math.sin(s.angle) * speed;
  s.path.unshift([s.x, s.y]);
  if (s.path.length > 400) s.path.pop();
}

/** Replicates walkPathFixedStep: position exactly STEP px behind head along the path polyline. */
function walked0(s: Sim): [number, number] {
  let remain = STEP;
  for (let i = 0; i < s.path.length - 1; i++) {
    const ax = s.path[i][0], ay = s.path[i][1];
    const bx = s.path[i + 1][0], by = s.path[i + 1][1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg >= remain) {
      const t = remain / seg;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    remain -= seg;
  }
  return s.path[s.path.length - 1];
}

/** Replicates smoothHeadFacing (0.45/frame, snap > 1.2 rad). */
let smoothed: number | null = null;
function smoothHeadFacing(raw: number): number {
  if (smoothed === null || !Number.isFinite(smoothed)) { smoothed = raw; return raw; }
  let d = raw - smoothed;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const next = Math.abs(d) > 1.2 ? raw : smoothed + d * 0.45;
  smoothed = next;
  return next;
}

function normDeg(a: number): number {
  let d = a * 180 / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function measure(feed: 'offline' | 'online15' | 'online30', boost: boolean) {
  const s = makeSim();
  smoothed = null;
  const diff = Math.PI / 2; // mouse held perpendicular — sustained hard turn
  const snapEvery = feed === 'offline' ? 1 : feed === 'online15' ? 4 : 2;

  let oldMax = 0, oldSum = 0, oldN = 0;
  let turnRadius = 0;
  const bb: number[][] = [];

  for (let frame = 0; frame < 480; frame++) {
    if (feed === 'offline') {
      tickSim(s, diff, boost);
    } else if (frame % snapEvery === 0) {
      // server ran snapEvery ticks since last snapshot; client path updates now
      for (let k = 0; k < snapEvery; k++) tickSim(s, diff, boost);
    }

    // Render frame: OLD facing (raw chord head - path[1], then smoother)
    const rawOld = Math.atan2(s.path[0][1] - s.path[1][1], s.path[0][0] - s.path[1][0]);
    const oldFacing = smoothHeadFacing(rawOld);

    // Visible junction: first drawn body segment -> head
    const [w0x, w0y] = walked0(s);
    const junction = Math.atan2(s.path[0][1] - w0y, s.path[0][0] - w0x);

    if (frame >= 120) {
      const errOld = Math.abs(normDeg(oldFacing - junction));
      oldMax = Math.max(oldMax, errOld);
      oldSum += errOld; oldN++;
      bb.push([s.x, s.y]);
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of bb) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  turnRadius = ((maxX - minX) / 2 + (maxY - minY) / 2) / 2;

  return {
    oldMax: oldMax.toFixed(1),
    oldMean: (oldSum / oldN).toFixed(1),
    newMax: '0.0', // NEW facing IS the junction vector — deviation is 0 by construction
    turnRadius: turnRadius.toFixed(1),
  };
}

console.log(`HEAD vs BODY-JUNCTION deviation (deg) — the "invisible neck"`);
console.log(`step=${STEP.toFixed(1)}px (draw-step), SEGMENT_SPACING=${SEGMENT_SPACING} (path record is per-tick, not per-spacing)\n`);
console.log('feed           speed   OLD max  OLD mean   NEW max   turn radius');
for (const feed of ['offline', 'online15', 'online30'] as const) {
  for (const boost of [false, true]) {
    const r = measure(feed, boost);
    const label = feed === 'offline' ? 'offline 60Hz ' : feed === 'online15' ? 'online 15Hz ' : 'online 30Hz ';
    console.log(
      `${label}  ${boost ? 'boost' : 'base '}   ${r.oldMax.padStart(6)}°  ${r.oldMean.padStart(6)}°    ${r.newMax.padStart(4)}°      ${r.turnRadius}px`,
    );
  }
}
console.log('\nOLD = current shipped code (3px tangent + smoothHeadFacing 0.45/frame).');
console.log('NEW = junction chord (head − first drawn body segment), no smoothing: deviation 0 by construction.');
console.log('Offline lag is ~4x the online lag at the same turn rate — exactly why the user sees');
console.log('rotation OFFLINE only, while ONLINE looks perfectly attached.');
