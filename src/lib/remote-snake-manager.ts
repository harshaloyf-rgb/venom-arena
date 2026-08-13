// ============================================================================
// Remote Snake Manager — Reconstructs body trails from 20Hz head snapshots
// ============================================================================
// The server sends head positions at 20Hz. The offline renderer needs a
// PathBuffer with dense position history. This manager interpolates between
// snapshots and builds PathBuffers for each remote snake.

import { PathBuffer } from '@/lib/snake/pool';
import type { Snake, FoodOrb, SkinRarity } from '@/lib/snake/types';
import type { RemoteSnake, RemoteFood, GameSnapshot } from './game-socket';
import { SEGMENT_SPACING, BASE_SPEED, computeBodyLength } from '@/lib/snake/config';

// ─── History entry per snapshot ──────────────────────────────────────────────

interface PosEntry {
  x: number;
  y: number;
  angle: number;
  tick: number;
}

// ─── Tracked remote snake ────────────────────────────────────────────────────

interface TrackedSnake {
  id: string;
  name: string;
  color: string;
  headColor: string;
  isBot: boolean;
  isPlayer: boolean;
  skinId: string;
  rarity: SkinRarity;
  bodyLen: number;
  bodyRadius: number;
  score: number;
  boosting: boolean;
  spawnTime: number;
  // Head position history (newest first)
  history: PosEntry[];
  // Reusable PathBuffer for renderer
  path: PathBuffer;
  // Previous head for interpolation
  prevHX: number;
  prevHY: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 600; // 30 seconds at 20Hz — enough for longest snakes
const INTERP_STEPS_PER_SNAP = 3; // 60fps / 20Hz = 3 frames between snapshots

// ─── Manager ─────────────────────────────────────────────────────────────────

export class RemoteSnakeManager {
  private snakes = new Map<string, TrackedSnake>();
  private playerSnakeId: string | null = null;
  private lastSnapTick = 0;
  private interpFrame = 0; // 0..INTERP_STEPS_PER_SNAP-1
  private mapHalf: number;

  constructor(mapHalf: number) {
    this.mapHalf = mapHalf;
  }

  /** Update with a new server snapshot */
  updateSnapshot(snap: GameSnapshot): void {
    // Advance interpolation frame
    this.interpFrame = (this.interpFrame + 1) % INTERP_STEPS_PER_SNAP;
    const dt = snap.tick - this.lastSnapTick;
    this.lastSnapTick = snap.tick;

    // Mark all current snakes as unseen (for removal)
    const seen = new Set<string>();

    for (const rs of snap.snakes) {
      seen.add(rs.id);
      let tracked = this.snakes.get(rs.id);

      if (!tracked) {
        // New snake — initialize
        const pathCap = Math.max(Math.ceil(rs.bodyLen * 2), 200);
        tracked = {
          id: rs.id,
          name: rs.name,
          color: rs.color,
          headColor: rs.secondaryColor,
          isBot: rs.isBot,
          isPlayer: rs.isPlayer,
          skinId: rs.skinId || 'skin-default',
          rarity: (rs.rarity as SkinRarity) || 'common',
          bodyLen: rs.bodyLen,
          bodyRadius: rs.bodyRadius,
          score: rs.score,
          boosting: rs.boosting,
          spawnTime: performance.now(),
          history: [],
          path: new PathBuffer(pathCap),
          prevHX: rs.hx,
          prevHY: rs.hy,
        };
        this.snakes.set(rs.id, tracked);
        if (rs.isPlayer) this.playerSnakeId = rs.id;
      } else {
        // Update existing
        tracked.prevHX = tracked.history.length > 0 ? tracked.history[0].x : rs.hx;
        tracked.prevHY = tracked.history.length > 0 ? tracked.history[0].y : rs.hy;
        tracked.bodyLen = rs.bodyLen;
        tracked.bodyRadius = rs.bodyRadius;
        tracked.score = rs.score;
        tracked.boosting = rs.boosting;
        tracked.color = rs.color;
        tracked.headColor = rs.secondaryColor;
        if (rs.skinId) tracked.skinId = rs.skinId;
        if (rs.rarity) tracked.rarity = rs.rarity as SkinRarity;
      }

      // Push new head position
      tracked.history.unshift({ x: rs.hx, y: rs.hy, angle: rs.angle, tick: snap.tick });
      if (tracked.history.length > MAX_HISTORY) {
        tracked.history.length = MAX_HISTORY;
      }
    }

    // Remove snakes not in snapshot
    for (const [id] of this.snakes) {
      if (!seen.has(id)) {
        this.snakes.delete(id);
      }
    }
  }

  /** Get interpolation alpha (0..1) for smooth movement */
  getInterpAlpha(): number {
    return this.interpFrame / INTERP_STEPS_PER_SNAP;
  }

  /** Build a Snake adapter for a remote snake (for the shared renderer) */
  buildSnakeAdapter(id: string): Snake | null {
    const t = this.snakes.get(id);
    if (!t || t.history.length < 1) return null;

    const alpha = this.getInterpAlpha();

    // Interpolate head position between last two snapshots
    const cur = t.history[0];
    const prev = t.history.length > 1 ? t.history[1] : cur;
    const headX = prev.x + (cur.x - prev.x) * alpha;
    const headY = prev.y + (cur.y - prev.y) * alpha;
    const angle = cur.angle;

    // Rebuild PathBuffer from history
    // The history is newest-first. We need to build the path head→tail.
    // The renderer's walkPathFixedStep walks index 0 (head) → N (tail).
    const visualLen = t.bodyLen * SEGMENT_SPACING;
    // Estimate how many history entries we need
    const speedPerSnap = BASE_SPEED * 3; // ~9px per snapshot (3 ticks at 3px/tick)
    const neededEntries = Math.ceil(visualLen / speedPerSnap) + 5;
    const entries = t.history.slice(0, Math.min(neededEntries, t.history.length));

    // Build path: interpolate between entries for smooth body
    const totalPoints = Math.max(entries.length * INTERP_STEPS_PER_SNAP, 10);
    if (t.path.capacity < totalPoints + 10) {
      t.path = new PathBuffer(totalPoints + 50);
    }
    t.path.resetTo(headX, headY);

    // Walk through history entries and interpolate
    for (let i = 0; i < entries.length - 1; i++) {
      const from = entries[i];
      const to = entries[i + 1];
      const steps = INTERP_STEPS_PER_SNAP;
      // Skip the first interpolation of the first pair (head is already set)
      const startStep = i === 0 ? 1 : 0;
      for (let s = startStep; s < steps; s++) {
        const t2 = s / steps;
        const ix = from.x + (to.x - from.x) * t2;
        const iy = from.y + (to.y - from.y) * t2;
        t.path.appendTail(ix, iy);
      }
    }

    // Trim to visual body length
    const maxPoints = Math.ceil(visualLen / Math.max(SEGMENT_SPACING * 0.5, 1)) + 5;
    if (t.path.length > maxPoints) {
      t.path.trimTo(maxPoints);
    }

    // Build the Snake adapter object
    return {
      id: t.id,
      name: t.name,
      path: t.path,
      angle,
      prevAngle: angle,
      speed: BASE_SPEED,
      score: t.score,
      boosting: t.boosting,
      alive: true,
      isBot: t.isBot,
      isPlayer: t.isPlayer,
      spawnTime: t.spawnTime,
      color: t.color,
      headColor: t.headColor,
      lastBoostDrop: 0,
      targetAngle: angle,
      spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
      bodyRadius: t.bodyRadius,
      cachedBodyLength: t.bodyLen,
      cachedBodyScore: t.score,
      cachedVisualTailIdx: 0,
      prevHeadX: t.prevHX,
      prevHeadY: t.prevHY,
      smoothBrakeFactor: 1.0,
      skinId: t.skinId,
      rarity: t.rarity,
    };
  }

  /** Get all tracked snake IDs */
  getSnakeIds(): string[] {
    return [...this.snakes.keys()];
  }

  /** Get the player's snake ID */
  getPlayerSnakeId(): string | null {
    return this.playerSnakeId;
  }

  /** Convert remote foods to FoodOrb[] for the shared renderer */
  buildFoodArray(foods: RemoteFood[]): FoodOrb[] {
    const result: FoodOrb[] = new Array(foods.length);
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      result[i] = {
        id: i,
        x: f.x,
        y: f.y,
        size: f.r > 4 ? 'large' : f.r > 2.5 ? 'medium' : 'small',
        value: f.r > 4 ? 5 : f.r > 2.5 ? 3 : 1,
        radius: f.r,
        color: f.color,
        glowColor: f.color,
        magnetized: false,
      };
    }
    return result;
  }

  /** Build a synthetic GameState for the shared HUD renderer */
  buildGameState(snap: GameSnapshot, arenaConfig: any): any {
    const snakeMap = new Map<string, Snake>();
    let playerSnake: Snake | null = null;

    for (const id of this.getSnakeIds()) {
      const snake = this.buildSnakeAdapter(id);
      if (snake) {
        snakeMap.set(id, snake);
        if (snake.isPlayer) playerSnake = snake;
      }
    }

    return {
      snakes: snakeMap,
      foods: this.buildFoodArray(snap.foods),
      player: playerSnake,
      nextFoodId: 0,
      showControls: false,
      tickCount: snap.tick,
      extractionZone: { x: 0, y: 0, radius: 0, active: false },
      botsEnabled: true,
      arenaConfig,
      boundaryRadius: snap.boundaryRadius,
    };
  }
}
