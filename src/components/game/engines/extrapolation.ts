// ============================================================================
// Venom Arena — Client-Side Extrapolation Engine
// Smoothly interpolates snake positions between 20Hz server snapshots at 60fps.
// Handles Fibonacci spiral turns locally for rubber-band-free rendering.
// ============================================================================

import type {
  SnakeSnapshot, TurnMetadata, IPathBuffer,
  SnakeIdentity,
} from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';
import { PathBuffer } from '@/lib/snake/pool';
import {
  normalizeAngle, angleDelta,
} from '@/lib/snake/engine';

// ── Extrapolated Snake ─────────────────────────────────────────────────────

export interface ExtrapolatedSnake {
  identity: SnakeIdentity;
  headX: number;
  headY: number;
  angle: number;
  targetAngle: number;
  score: number;
  boosting: boolean;
  alive: boolean;
  carriedChips: number;
  kills: number;
  spawnProtected: boolean;
  activeEmote: string | null;
  emoteFramesLeft: number;
  visualRadius: number;
  path: IPathBuffer;
  // Extrapolation state
  lastSnapshotTime: number;
  prevHeadX: number;
  prevHeadY: number;
  prevAngle: number;
  // Spiral state (received from server)
  turnMeta: TurnMetadata | null;
  spiralActive: boolean;
  spiralPivotX: number;
  spiralPivotY: number;
  spiralA: number;
  spiralB: number;
  spiralCurrentTheta: number;
  spiralEntryAngle: number;
  spiralEntrySpeed: number;
}

// ── Extrapolation Engine ────────────────────────────────────────────────────

export class ExtrapolationEngine {
  private snakes = new Map<string, ExtrapolatedSnake>();
  private config: SnakeConfig;

  constructor(config: SnakeConfig) {
    this.config = config;
  }

  /** Update all snakes by one render frame (dt in seconds) */
  tick(dt: number): void {
    for (const snake of this.snakes.values()) {
      if (!snake.alive) continue;
      this.extrapolateSnake(snake, dt);
    }
  }

  /** Process a new server snapshot */
  processSnapshot(snap: SnakeSnapshot, now: number): void {
    let snake = this.snakes.get(snap.id);

    if (!snake) {
      snake = this.createExtrapolatedSnake(snap);
      this.snakes.set(snap.id, snake);
      return;
    }

    // Store previous state for interpolation
    snake.prevHeadX = snake.headX;
    snake.prevHeadY = snake.headY;
    snake.prevAngle = snake.angle;
    snake.lastSnapshotTime = now;

    // Update from snapshot (authoritative)
    snake.score = snap.score;
    snake.boosting = snap.boosting;
    snake.alive = snap.alive;
    snake.carriedChips = snap.carriedChips;
    snake.kills = snap.kills;
    snake.spawnProtected = snap.spawnProtected;
    snake.activeEmote = snap.activeEmote;
    snake.emoteFramesLeft = snap.emoteFramesLeft;
    snake.visualRadius = snap.visualRadius;
    snake.targetAngle = snap.angle;

    // Update spiral state from metadata
    if (snap.turnMeta && snap.turnMeta.isInSpiral) {
      snake.turnMeta = snap.turnMeta;
      snake.spiralActive = true;
      snake.spiralPivotX = snap.turnMeta.pivotX;
      snake.spiralPivotY = snap.turnMeta.pivotY;
      snake.spiralA = snap.turnMeta.spiralA;
      snake.spiralB = snap.turnMeta.spiralB;
      snake.spiralCurrentTheta = snap.turnMeta.currentTheta;
      snake.spiralEntryAngle = snap.turnMeta.entryAngle;
      snake.spiralEntrySpeed = snap.turnMeta.entrySpeed;
    } else {
      snake.spiralActive = false;
      snake.turnMeta = null;
    }

    // Rebuild path from downsampled snapshot points
    this.rebuildPathFromSnapshot(snake, snap);
  }

  /** Remove a snake */
  removeSnake(id: string): void {
    this.snakes.delete(id);
  }

  /** Get extrapolated snake */
  getSnake(id: string): ExtrapolatedSnake | undefined {
    return this.snakes.get(id);
  }

  /** Get all extrapolated snakes */
  getAllSnakes(): ExtrapolatedSnake[] {
    const result: ExtrapolatedSnake[] = [];
    for (const snake of this.snakes.values()) {
      result.push(snake);
    }
    return result;
  }

  /** Clear all */
  clear(): void {
    this.snakes.clear();
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private extrapolateSnake(snake: ExtrapolatedSnake, dt: number): void {
    if (snake.spiralActive && snake.turnMeta) {
      this.extrapolateSpiral(snake, dt);
    } else {
      this.extrapolateLinear(snake, dt);
    }
  }

  /** Linear extrapolation between snapshots */
  private extrapolateLinear(snake: ExtrapolatedSnake, dt: number): void {
    const speed = snake.boosting ? this.config.boostSpeed : this.config.baseSpeed;
    const vr = snake.visualRadius;
    const thickRange = this.config.maxThick - this.config.minThick;
    const thickT = thickRange > 0
      ? Math.max(0, Math.min(1, (vr - this.config.minThick) / thickRange))
      : 0;
    const maxTurn = snake.boosting
      ? this.config.turnBoost
      : this.config.turnThin + (this.config.turnFat - this.config.turnThin) * thickT;

    // Smooth angle toward target
    const delta = angleDelta(snake.angle, snake.targetAngle);
    if (Math.abs(delta) > 0.001) {
      const maxTurnDt = maxTurn * dt;
      if (Math.abs(delta) <= maxTurnDt) {
        snake.angle = snake.targetAngle;
      } else {
        snake.angle += Math.sign(delta) * maxTurnDt;
      }
      snake.angle = normalizeAngle(snake.angle);
    }

    // Move head
    const dx = Math.cos(snake.angle) * speed * dt;
    const dy = Math.sin(snake.angle) * speed * dt;
    snake.headX += dx;
    snake.headY += dy;

    // Extend path
    snake.path.prepend(snake.headX, snake.headY, snake.angle);
    const maxPts = Math.ceil((snake.score * this.config.ptsPerSegment) / this.config.segSpacing);
    if (snake.path.length > maxPts) {
      snake.path.trimTail(snake.path.length - maxPts);
    }
  }

  /** Fibonacci spiral extrapolation at 60fps */
  private extrapolateSpiral(snake: ExtrapolatedSnake, dt: number): void {
    const a = snake.spiralA;
    const b = snake.spiralB;
    const dir = b < 0 ? 1 : -1;
    const thetaStep = this.config.spiralThetaStep * dt * this.config.tickRateHz;

    // Advance theta proportionally to dt
    snake.spiralCurrentTheta += dir * thetaStep;
    const theta = snake.spiralCurrentTheta;

    // r = a * e^(b * theta)
    const r = a * Math.exp(b * theta);
    const phi0 = snake.spiralEntryAngle - Math.atan2(1, b);
    const worldAngle = theta + phi0;

    snake.headX = snake.spiralPivotX + r * Math.cos(worldAngle);
    snake.headY = snake.spiralPivotY + r * Math.sin(worldAngle);
    snake.angle = normalizeAngle(worldAngle + Math.atan2(1, b));

    // Extend path
    snake.path.prepend(snake.headX, snake.headY, snake.angle);
    const maxPts = Math.ceil((snake.score * this.config.ptsPerSegment) / this.config.segSpacing);
    if (snake.path.length > maxPts) {
      snake.path.trimTail(snake.path.length - maxPts);
    }
  }

  /** Rebuild path from downsampled snapshot */
  private rebuildPathFromSnapshot(snake: ExtrapolatedSnake, snap: SnakeSnapshot): void {
    const pathLen = snap.path.length;
    if (pathLen === 0) return;

    // Set head from snapshot
    snake.headX = snap.path[0].x;
    snake.headY = snap.path[0].y;
    snake.angle = snap.angle;

    // Check if we need a bigger buffer
    const maxPts = Math.ceil((snake.score * this.config.ptsPerSegment) / this.config.segSpacing);
    const needed = Math.max(maxPts, pathLen + 10);

    if ((snake.path as any).capacity < needed) {
      const newPath = new PathBuffer(needed + 200);
      (snake as any).path = newPath;
    }

    // Reset and fill from snapshot
    snake.path.reset();
    for (let i = pathLen - 1; i >= 0; i--) {
      const p = snap.path[i];
      let angle = snap.angle;
      if (i < pathLen - 1) {
        const next = snap.path[i + 1];
        angle = Math.atan2(next.y - p.y, next.x - p.x);
      }
      snake.path.prepend(p.x, p.y, angle);
    }

    snake.prevHeadX = snake.headX;
    snake.prevHeadY = snake.headY;
    snake.prevAngle = snake.angle;
  }

  /** Create new extrapolated snake from snapshot */
  private createExtrapolatedSnake(snap: SnakeSnapshot): ExtrapolatedSnake {
    const maxPts = Math.ceil((snap.score * this.config.ptsPerSegment) / this.config.segSpacing) + 200;
    const path = new PathBuffer(maxPts);

    const pathLen = snap.path.length;
    for (let i = pathLen - 1; i >= 0; i--) {
      const p = snap.path[i];
      let angle = snap.angle;
      if (i < pathLen - 1) {
        const next = snap.path[i + 1];
        angle = Math.atan2(next.y - p.y, next.x - p.x);
      }
      path.prepend(p.x, p.y, angle);
    }

    return {
      identity: {
        id: snap.id, name: snap.name, tag: snap.tag,
        isBot: snap.isBot, isPlayer: snap.isPlayer,
        skinId: snap.skinId, skinPattern: snap.skinPattern,
        bodyStyle: snap.bodyStyle, taperStyle: snap.taperStyle,
        hat: snap.hat, shape: snap.shape,
        primaryColor: snap.primaryColor, secondaryColor: snap.secondaryColor,
        trailId: '', deathBurstId: '',
        skinRarity: snap.skinRarity,
      },
      headX: pathLen > 0 ? snap.path[0].x : 0,
      headY: pathLen > 0 ? snap.path[0].y : 0,
      angle: snap.angle,
      targetAngle: snap.angle,
      score: snap.score,
      boosting: snap.boosting,
      alive: snap.alive,
      carriedChips: snap.carriedChips,
      kills: snap.kills,
      spawnProtected: snap.spawnProtected,
      activeEmote: snap.activeEmote,
      emoteFramesLeft: snap.emoteFramesLeft,
      visualRadius: snap.visualRadius,
      path,
      lastSnapshotTime: performance.now(),
      prevHeadX: 0, prevHeadY: 0, prevAngle: snap.angle,
      turnMeta: snap.turnMeta,
      spiralActive: snap.turnMeta?.isInSpiral ?? false,
      spiralPivotX: snap.turnMeta?.pivotX ?? 0,
      spiralPivotY: snap.turnMeta?.pivotY ?? 0,
      spiralA: snap.turnMeta?.spiralA ?? 0,
      spiralB: snap.turnMeta?.spiralB ?? 0,
      spiralCurrentTheta: snap.turnMeta?.currentTheta ?? 0,
      spiralEntryAngle: snap.turnMeta?.entryAngle ?? 0,
      spiralEntrySpeed: snap.turnMeta?.entrySpeed ?? 0,
    };
  }
}
