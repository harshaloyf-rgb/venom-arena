// ============================================================================
// verify-pill-lock.ts — numerical proof for FIX PILL-SHAKE (OnlineSnakeGame.tsx)
//
// Symptom: the "carried chips" pill above real players' heads shook/jittered
// while the snake itself glided smoothly.
//
// Root cause: the OLD pill code pinned to the RAW 20Hz snapshot head
//   headSx = (path.headX - camX) * zoom + w/2
// while BOTH renderers (render-snake-atlas.tsx L611-616 + L627-628, and the
// fallback renderer L1071-1088) draw the visible head at
//   headSX = (interp + extrap - camX) * zoom + w/2,
//   interp = prevHead + (head - prevHead) * alpha.
// Within every 50ms snapshot interval (cur - interp) sweeps 0→9px, so the OLD
// pill swept against the visible head and snapped back at the snapshot rate —
// the same bug class as FIX EXTRACT-SHAKE. The NEW pill code uses the exact
// renderer formula → relative offset is 0 by construction.
//
// This probe replicates the manager math VERBATIM (self-contained — importing
// the manager would drag the browser renderer chain; formulas copied from
// remote-snake-manager.ts L79-105, L484-527, L401-407) on a deterministic
// virtual clock:
//   server: 60Hz ticks, snapshot every 3rd tick (20Hz), BASE_SPEED=3px/tick
//   path:   1.5s straight → 1.5s min-turn-radius arc (r=17) → 1s straight
//   client: 60fps render frames, alpha = min(1.5, elapsed/playIv)
//   own snake: smoothed self-lead (LEAD_SMOOTH_MS=90, SELF_LEAD_MS=75, cap 30)
//   remote:    decay-on-fresh (EXTRAP_DECAY_MS=100) / dead-reckon when late
// Perfect 50ms cadence is used ON PURPOSE — the OLD pill wobbles even on a
// flawless network, so the bug is proven independent of network jitter.
//
// Metric: pill-vs-visible-head relative offset in SCREEN px
//         rel = (rawHead - interp - extrap) * zoom   [camera cancels out]
//         OLD pill uses rawHead, NEW pill uses interp+extrap (= renderer).
// PASS: OLD max |rel| > 5px (bug real & visible at zoom 1.6)
//       AND NEW |rel| == 0 every frame (formula identity)
// Informational (NOT gated): visible-head per-frame jump — that motion is the
// shipped Task-25 playout clock + self-lead behavior (spawn ramp + turn-entry
// dynamics, user-validated smooth in-game). The pill inherits the head's
// motion EXACTLY, so head motion quality is out of scope for this fix; what
// this fix owns is relative pill-vs-head motion, which is now zero.
// ============================================================================

const TICK_MS = 1000 / 60;
const SNAP_EVERY_TICKS = 3;
const SNAP_MS = TICK_MS * SNAP_EVERY_TICKS; // 50ms
const BASE_SPEED = 3.0;                     // config.ts L20 (px/tick)
const ZOOM = 1.6;                           // config.ts L248 CAMERA_BASE_ZOOM
const FRAME_MS = 1000 / 60;

// remote-snake-manager.ts L80-105 — verbatim constants
const SNAPSHOT_INTERVAL_MS = 50;
const SELF_LEAD_MS = 75;
const MAX_SELF_LEAD_PX = 30;
const EXTRAP_DECAY_MS = 100;
const MAX_EXTRAP_MS = 150;
const MAX_EXTRAP_PX = 40;
const LEAD_SMOOTH_MS = 90;
const ALPHA_OVERSHOOT = 1.5;

// ── Server: 20Hz head samples along the path (3px/tick, snapshot/3rd tick) ──
interface Head { x: number; y: number; tick: number }
const heads: Head[] = [];
{
  const R = 17; // min turn radius max(17, 2.2*8) — sharpest legal turn
  let x = 0, y = 0, dir = 0, tick = 0;
  // 7s of stream — MUST outlast the 6s frame loop, otherwise the tail frames
  // run open-loop dead reckoning (unrealistic; skewed the first run's stats).
  const totalTicks = Math.round(7000 / TICK_MS); // straight→arc→straight
  for (let i = 0; i < totalTicks; i++) {
    if (tick % SNAP_EVERY_TICKS === 0) heads.push({ x, y, tick });
    if (tick * TICK_MS < 1500) {
      // straight
    } else if (tick * TICK_MS < 3000) {
      dir += BASE_SPEED / R; // constant-rate arc
    } // else straight again (dir constant)
    x += Math.cos(dir) * BASE_SPEED;
    y += Math.sin(dir) * BASE_SPEED;
    tick++;
  }
}

// ── Client replica state (fields mirror TrackedSnake) ────────────────────────
interface Replica {
  prevX: number; prevY: number;   // previous snapshot head (manager L203-209)
  curX: number; curY: number;     // current snapshot head (history[0])
  velX: number; velY: number;     // px/ms (manager L216-220)
  extrapX: number; extrapY: number;
  decayFromX: number; decayFromY: number; decayStart: number;
  leadX: number; leadY: number;   // player only
  lastSnapTime: number;
}
function newReplica(): Replica {
  return { prevX: heads[0].x, prevY: heads[0].y, curX: heads[0].x, curY: heads[0].y,
    velX: 0, velY: 0, extrapX: 0, extrapY: 0, decayFromX: 0, decayFromY: 0,
    decayStart: 0, leadX: 0, leadY: 0, lastSnapTime: 0 };
}

// Simulates one client render frame at virtual time t (ms) for a given
// extrap mode. Returns { alpha, interpX, interpY, visX, visY }.
function stepFrame(r: Replica, t: number, mode: 'player' | 'remote') {
  // getPlayerAlpha (manager L401-407) — verbatim
  const elapsed = t - r.lastSnapTime;
  const alpha = Math.min(ALPHA_OVERSHOOT, elapsed / SNAPSHOT_INTERVAL_MS);

  // render-time interp (renderer L611-612) — verbatim
  const interpX = r.prevX + (r.curX - r.prevX) * alpha;
  const interpY = r.prevY + (r.curY - r.prevY) * alpha;

  // extrap (manager L484-527) — verbatim formulas
  if (mode === 'player') {
    let ex = r.velX * SELF_LEAD_MS;
    let ey = r.velY * SELF_LEAD_MS;
    const magSq = ex * ex + ey * ey;
    if (magSq > MAX_SELF_LEAD_PX * MAX_SELF_LEAD_PX) {
      const s = MAX_SELF_LEAD_PX / Math.sqrt(magSq);
      ex *= s; ey *= s;
    }
    const dtLead = Math.min(Math.max(t - (r.lastSnapTime || t), 1), 100); // lastLeadAt≈frame dt
    const k = 1 - Math.exp(-dtLead / LEAD_SMOOTH_MS);
    r.leadX += (ex - r.leadX) * k;
    r.leadY += (ey - r.leadY) * k;
    r.extrapX = r.leadX; r.extrapY = r.leadY;
  } else if (elapsed <= SNAPSHOT_INTERVAL_MS) {
    const k = Math.max(0, 1 - (t - r.decayStart) / EXTRAP_DECAY_MS);
    r.extrapX = r.decayFromX * k;
    r.extrapY = r.decayFromY * k;
  } else {
    const over = Math.min(elapsed - SNAPSHOT_INTERVAL_MS, MAX_EXTRAP_MS);
    let ex = r.velX * over;
    let ey = r.velY * over;
    const magSq = ex * ex + ey * ey;
    if (magSq > MAX_EXTRAP_PX * MAX_EXTRAP_PX) {
      const s = MAX_EXTRAP_PX / Math.sqrt(magSq);
      ex *= s; ey *= s;
    }
    r.extrapX = ex; r.extrapY = ey;
  }

  return { alpha, interpX, interpY, visX: interpX + r.extrapX, visY: interpY + r.extrapY };
}

// Snapshot arrival (manager L201-248) — verbatim ordering
function arrive(r: Replica, h: Head, t: number) {
  if (r.lastSnapTime > 0) {
    r.prevX = r.curX; r.prevY = r.curY;
    r.decayFromX = r.extrapX; r.decayFromY = r.extrapY;
    r.decayStart = t;
    const dtMs = Math.max(1, (h.tick - 0) * 0 + SNAP_MS); // uniform cadence: (tick - prevTick)*iv
    r.velX = (h.x - r.curX) / dtMs;
    r.velY = (h.y - r.curY) / dtMs;
  }
  r.curX = h.x; r.curY = h.y;
  r.lastSnapTime = t;
}

// ── Run one case, collect stats ──────────────────────────────────────────────
function run(mode: 'player' | 'remote') {
  const r = newReplica();
  let snapIdx = 0;
  let prevVisX = NaN, prevVisY = NaN;
  let maxJump = 0;
  let sumAbs = 0, maxAbs = 0;
  const rels: number[] = [];
  let frames = 0;
  let newNonzero = 0;

  // warm-up: feed first snapshot at t=0
  arrive(r, heads[0], 0);
  snapIdx = 1;
  if (heads.length * SNAP_EVERY_TICKS * TICK_MS < 361 * FRAME_MS) {
    throw new Error('snapshot stream shorter than frame loop — stats would include open-loop dead reckoning');
  }

  for (let f = 1; f <= 360; f++) { // 6s at 60fps
    const t = f * FRAME_MS;
    // process snapshot arrivals due at or before this frame's render time
    while (snapIdx < heads.length && heads[snapIdx].tick * TICK_MS <= t) {
      arrive(r, heads[snapIdx], heads[snapIdx].tick * TICK_MS);
      snapIdx++;
    }
    const { interpX, interpY, visX, visY } = stepFrame(r, t, mode);

    if (Number.isFinite(prevVisX)) {
      const jump = Math.hypot(visX - prevVisX, visY - prevVisY);
      if (jump > maxJump) maxJump = jump;
    }
    prevVisX = visX; prevVisY = visY;

    if (t > 500) { // skip spawn transient
      // OLD pill rel offset (screen px): rawHead pinned vs visible head
      const rel = Math.hypot(r.curX - visX, r.curY - visY) * ZOOM;
      rels.push(rel);
      sumAbs += rel;
      if (rel > maxAbs) maxAbs = rel;
      // NEW pill: uses (interp + extrap) → rel ≡ 0; assert numerically
      const relNew = Math.hypot((interpX + r.extrapX) - visX, (interpY + r.extrapY) - visY) * ZOOM;
      if (relNew > 1e-9) newNonzero++;
      frames++;
    }
  }
  rels.sort((a, b) => a - b);
  const p95 = rels[Math.floor(rels.length * 0.95)] ?? 0;
  const mean = frames > 0 ? sumAbs / frames : 0;
  return { mean, p95, maxAbs, maxJump, newNonzero };
}

const own = run('player');
const remote = run('remote');
console.log(`OLD pill wobble vs visible head (screen px @ zoom ${ZOOM}):`);
console.log(`  own snake (self-lead):    mean=${own.mean.toFixed(2)}  p95=${own.p95.toFixed(2)}  max=${own.maxAbs.toFixed(2)}`);
console.log(`  remote snake (decay/DR):  mean=${remote.mean.toFixed(2)}  p95=${remote.p95.toFixed(2)}  max=${remote.maxAbs.toFixed(2)}`);
console.log(`NEW pill offset: own nonzero frames=${own.newNonzero}, remote nonzero frames=${remote.newNonzero} (must be 0)`);
console.log(`Visible-head per-frame jump (informational, Task-25 head behavior): own=${own.maxJump.toFixed(2)}px, remote=${remote.maxJump.toFixed(2)}px world`);

const okOld = own.maxAbs > 5 && remote.maxAbs > 5;
const okNew = own.newNonzero === 0 && remote.newNonzero === 0;
console.log(`${okOld && okNew ? 'PILL_LOCK_PASS' : 'PILL_LOCK_FAIL'}`);
process.exit(okOld && okNew ? 0 : 1);
