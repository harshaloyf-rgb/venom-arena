// ============================================================================
// ExtrapolationEngine — Smooths between 20Hz server snapshots at 60fps.
//
// Handles two modes:
// 1. Linear: angle lerp + position predict (normal movement)
// 2. Fibonacci spiral: r=a*e^(b*theta) during tight turns
//
// Phase B: Client-side only. Used in ONLINE mode where the server
// broadcasts at SERVER_TICK_RATE but the client renders at CLIENT_RENDER_FPS.
// ============================================================================

import type {
  ArenaSnapshot, SnakeSnapshot, TurnMetadata, SkinRarity, FoodSize,
} from './types';
import type { IPathBuffer } from './pool';
import { PathBuffer } from './pool';
import {
  SERVER_TICK_RATE,
  CLIENT_RENDER_FPS,
  MAX_EXTRAPOLATION_MS,
  ANGLE_LERP_SPEED,
  POSITION_PREDICT_FACTOR,
  BASE_SPEED,
  SPIRAL_A,
  SPIRAL_B,
  SEGMENT_SPACING,
} from './config';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Fully resolved renderable snake for the renderer. */
export interface RenderableSnake {
  id: string;
  name: string;
  headX: number;
  headY: number;
  angle: number;
  path: IPathBuffer;
  score: number;
  alive: boolean;
  color: string;
  headColor: string;
  bodyRadius: number;
  boosting: boolean;
  skinId: string;
  rarity: SkinRarity;
}

/** Downsampled food item from snapshot for rendering. */
export interface RenderableFood {
  id: number;
  x: number;
  y: number;
  size: FoodSize;
  value: number;
}

/** Star chip from snapshot for rendering. */
export interface RenderableStarChip {
  id: number;
  x: number;
  y: number;
  value: number;
}

// ─── Internal state ───────────────────────────────────────────────────────────

/** Per-snake extrapolation state, tracked between snapshots. */
interface ExtrapolatedSnake {
  // Anchor point — the last authoritative position from the server snapshot.
  anchorX: number;
  anchorY: number;
  anchorAngle: number;
  anchorTimestamp: number;
  // Previous snapshot position for speed estimation.
  prevX: number;
  prevY: number;
  prevTimestamp: number;
  // Estimated speed in px/s (from position delta or config default).
  speed: number;
  // Current extrapolated head position and angle (updated each frame).
  currentX: number;
  currentY: number;
  currentAngle: number;
  // Turn metadata from the last snapshot (undefined if no spiral active).
  turn: TurnMetadata | undefined;
  // Spiral extrapolation state — advanced each frame when turn is active.
  spiralTheta: number;
  spiralStartAngle: number;
  spiralDirection: 1 | -1;
  spiralA: number;
  spiralB: number;
  // Static visual fields (copied from snapshot).
  name: string;
  score: number;
  alive: boolean;
  color: string;
  headColor: string;
  bodyRadius: number;
  boosting: boolean;
  skinId: string;
  rarity: SkinRarity;
  // PathBuffer holding the body for rendering. Rebuilt on each snapshot.
  path: PathBuffer;
  // Last received snapshot tick.
  lastTick: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap angle difference into [-PI, PI]. */
function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distance between two points. */
function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Default speed in px/s when we can't estimate from deltas. */
const DEFAULT_SPEED = BASE_SPEED * SERVER_TICK_RATE;

/** Create a blank ExtrapolatedSnake with safe defaults. */
function createExtrapolatedSnake(): ExtrapolatedSnake {
  return {
    anchorX: 0, anchorY: 0, anchorAngle: 0, anchorTimestamp: 0,
    prevX: 0, prevY: 0, prevTimestamp: 0,
    speed: DEFAULT_SPEED,
    currentX: 0, currentY: 0, currentAngle: 0,
    turn: undefined,
    spiralTheta: 0, spiralStartAngle: 0, spiralDirection: 1,
    spiralA: SPIRAL_A, spiralB: SPIRAL_B,
    name: '', score: 0, alive: false,
    color: '#ffffff', headColor: '#ffffff',
    bodyRadius: 8, boosting: false,
    skinId: 'skin-default', rarity: 'common',
    path: new PathBuffer(200),
    lastTick: -1,
  };
}

/** Rebuild a PathBuffer from downsampled snapshot body data. */
function rebuildPath(es: ExtrapolatedSnake, snap: SnakeSnapshot): void {
  const totalLen = snap.bodyLen + 1; // +1 for the head position
  es.path.ensureCapacity(totalLen);
  es.path.length = 0;
  es.path.headSegIdx = 0;

  // Head at index 0
  es.path.data[0] = snap.hx;
  es.path.data[1] = snap.hy;
  es.path.length = 1;

  // Body segments (already downsampled, index 0 = nearest to head)
  for (let i = 0; i < snap.bodyLen; i++) {
    es.path.prepend(
      snap.bodyX[i],
      snap.bodyY[i],
    );
  }

  // Reverse: prepend adds to head, but body should trail behind.
  // Actually we need body AFTER head. Let me use direct buffer writes.
  // Reset and write in correct order: head=0, body=1..N
  es.path.length = 0;
  es.path.headSegIdx = 0;
  es.path.data[0] = snap.hx;
  es.path.data[1] = snap.hy;
  for (let i = 0; i < snap.bodyLen; i++) {
    const base = (i + 1) * 2;
    es.path.data[base] = snap.bodyX[i];
    es.path.data[base + 1] = snap.bodyY[i];
  }
  es.path.length = totalLen;
}

// ─── ExtrapolationEngine ─────────────────────────────────────────────────────

export class ExtrapolationEngine {
  /** Per-snake extrapolation state keyed by snake ID. */
  private readonly snakes = new Map<string, ExtrapolatedSnake>();

  /** Latest food from the most recent snapshot. */
  private latestFoods: RenderableFood[] = [];

  /** Latest star chips from the most recent snapshot. */
  private latestStarChips: RenderableStarChip[] = [];

  /** Extraction zone state from the latest snapshot. */
  extraction: { x: number; y: number; radius: number; active: boolean } = {
    x: 0, y: 0, radius: 0, active: false,
  };

  /** Last snapshot tick received. */
  lastSnapshotTick = -1;

  // ── Snapshot ingestion ────────────────────────────────────────────────────

  /**
   * Receive a new server snapshot and update internal state.
   * Called at SERVER_TICK_RATE (20Hz) from the network layer.
   */
  update(snapshot: ArenaSnapshot, now: number): void {
    this.lastSnapshotTick = snapshot.tick;

    // Update extraction zone.
    this.extraction = snapshot.extraction;

    // Update food list.
    this.latestFoods = snapshot.foods.map(f => ({
      id: f.id, x: f.x, y: f.y, size: f.size, value: f.value,
    }));

    // Update star chips.
    this.latestStarChips = snapshot.starChips.map(c => ({
      id: c.id, x: c.x, y: c.y, value: c.value,
    }));

    // Track which snake IDs are present in this snapshot.
    const aliveIds = new Set<string>();

    for (const snap of snapshot.snakes) {
      aliveIds.add(snap.id);
      let es = this.snakes.get(snap.id);

      if (!es) {
        es = createExtrapolatedSnake();
        this.snakes.set(snap.id, es);
      }

      // Store previous anchor for speed estimation.
      es.prevX = es.anchorX;
      es.prevY = es.anchorY;
      es.prevTimestamp = es.anchorTimestamp;

      // Set new anchor from snapshot.
      es.anchorX = snap.hx;
      es.anchorY = snap.hy;
      es.anchorAngle = snap.angle;
      es.anchorTimestamp = now;

      // Snap current state to anchor immediately.
      es.currentX = snap.hx;
      es.currentY = snap.hy;
      es.currentAngle = snap.angle;

      // Estimate speed from position delta.
      if (es.prevTimestamp > 0) {
        const dt = (now - es.prevTimestamp) / 1000;
        if (dt > 0.001) {
          const d = dist(es.prevX, es.prevY, snap.hx, snap.hy);
          es.speed = d / dt;
        }
      }

      // Update turn metadata.
      es.turn = snap.turn;
      if (snap.turn && snap.turn.isSpiral) {
        es.spiralTheta = snap.turn.theta;
        es.spiralStartAngle = snap.turn.startAngle;
        es.spiralDirection = snap.turn.direction;
      }

      // Copy static fields.
      es.name = snap.name;
      es.score = snap.score;
      es.alive = snap.alive;
      es.color = snap.color;
      es.headColor = snap.headColor;
      es.bodyRadius = snap.bodyRadius;
      es.boosting = snap.boosting;
      es.skinId = snap.skinId;
      es.rarity = snap.rarity;
      es.lastTick = snap.tick;

      // Rebuild body path from downsampled data.
      rebuildPath(es, snap);
    }

    // Remove snakes that are no longer in the snapshot.
    for (const [id] of this.snakes) {
      if (!aliveIds.has(id)) {
        this.snakes.delete(id);
      }
    }
  }

  // ── Per-frame extrapolation ───────────────────────────────────────────────

  /**
   * Advance all snakes by dt seconds. Called at CLIENT_RENDER_FPS (60fps).
   * Returns nothing — call getRenderableSnakes() to read the result.
   */
  extrapolate(dt: number): void {
    for (const [, es] of this.snakes) {
      if (!es.alive) continue;

      const elapsedMs = (performance.now() - es.anchorTimestamp);

      // Beyond the extrapolation window — freeze at last known position.
      if (elapsedMs > MAX_EXTRAPOLATION_MS) continue;

      const elapsedSec = elapsedMs / 1000;

      if (es.turn && es.turn.isSpiral) {
        this.extrapolateSpiral(es, dt, elapsedSec);
      } else {
        this.extrapolateLinear(es, dt);
      }

      // Prepend the new head position to the path.
      es.path.prepend(es.currentX, es.currentY);
    }
  }

  /** Linear extrapolation: angle lerp toward snapshot angle + position predict. */
  private extrapolateLinear(es: ExtrapolatedSnake, dt: number): void {
    // Lerp angle toward the snapshot's anchor angle.
    const diff = angleDiff(es.currentAngle, es.anchorAngle);
    const lerpFactor = 1 - Math.pow(1 - ANGLE_LERP_SPEED, dt * CLIENT_RENDER_FPS);
    es.currentAngle += diff * lerpFactor;

    // Normalize.
    if (es.currentAngle > Math.PI) es.currentAngle -= 2 * Math.PI;
    else if (es.currentAngle < -Math.PI) es.currentAngle += 2 * Math.PI;

    // Predict position forward.
    const moveDist = es.speed * dt * POSITION_PREDICT_FACTOR;
    es.currentX = es.anchorX + Math.cos(es.currentAngle) * moveDist;
    es.currentY = es.anchorY + Math.sin(es.currentAngle) * moveDist;
  }

  /**
   * Fibonacci spiral extrapolation during tight turns.
   * Uses r = a * e^(b * theta) to compute curved movement.
   */
  private extrapolateSpiral(es: ExtrapolatedSnake, dt: number, _elapsedSec: number): void {
    const a = es.spiralA;
    const b = es.spiralB;
    const dir = es.spiralDirection;

    // Current radius on the spiral.
    const r = a * Math.exp(b * es.spiralTheta);
    const safeR = Math.max(r, 0.1);

    // Angular advancement: dTheta = speed / r, scaled by dt relative to server tick.
    // Server tick period = 1/SERVER_TICK_RATE seconds. dt is in seconds.
    const tickDt = dt * SERVER_TICK_RATE;
    let dTheta = (es.speed / SERVER_TICK_RATE) / safeR;

    // Scale by how much time has passed relative to a server tick.
    dTheta *= tickDt;

    // Clamp to reasonable range.
    const MIN_DTHETA = 0.01;
    const MAX_DTHETA = Math.PI * 0.12 * 2; // MAX_TURN_RATE * 2
    dTheta = Math.max(MIN_DTHETA, Math.min(dTheta, MAX_DTHETA));

    // Advance theta.
    es.spiralTheta += dTheta;

    // Compute new angle from spiral start + accumulated theta.
    es.currentAngle = es.spiralStartAngle + dir * es.spiralTheta;

    // Normalize angle.
    if (es.currentAngle > Math.PI) es.currentAngle -= 2 * Math.PI;
    else if (es.currentAngle < -Math.PI) es.currentAngle += 2 * Math.PI;

    // Compute arc-length-based position displacement.
    // For a logarithmic spiral, the arc length element is:
    //   ds = r * sqrt(1 + b^2) * dTheta
    // But for visual purposes, a simpler tangent-line approximation works:
    const moveDist = es.speed * dt * POSITION_PREDICT_FACTOR;
    es.currentX = es.anchorX + Math.cos(es.currentAngle) * moveDist;
    es.currentY = es.anchorY + Math.sin(es.currentAngle) * moveDist;
  }

  // ── Renderable output ─────────────────────────────────────────────────────

  /** Returns the current extrapolated state of all snakes for rendering. */
  getRenderableSnakes(): Map<string, RenderableSnake> {
    const result = new Map<string, RenderableSnake>();
    for (const [id, es] of this.snakes) {
      if (!es.alive) continue;
      result.set(id, {
        id,
        name: es.name,
        headX: es.currentX,
        headY: es.currentY,
        angle: es.currentAngle,
        path: es.path,
        score: es.score,
        alive: es.alive,
        color: es.color,
        headColor: es.headColor,
        bodyRadius: es.bodyRadius,
        boosting: es.boosting,
        skinId: es.skinId,
        rarity: es.rarity,
      });
    }
    return result;
  }

  /** Returns the current food list from the last snapshot. */
  getRenderableFoods(): RenderableFood[] {
    return this.latestFoods;
  }

  /** Returns the current star chips from the last snapshot. */
  getRenderableStarChips(): RenderableStarChip[] {
    return this.latestStarChips;
  }

  /** Reset all extrapolation state (e.g. on disconnect or mode switch). */
  reset(): void {
    this.snakes.clear();
    this.latestFoods = [];
    this.latestStarChips = [];
    this.lastSnapshotTick = -1;
    this.extraction = { x: 0, y: 0, radius: 0, active: false };
  }

  /** Number of snakes currently being tracked. */
  get trackedCount(): number {
    return this.snakes.size;
  }
}
