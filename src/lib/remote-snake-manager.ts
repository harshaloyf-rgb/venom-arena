// ============================================================================
// Remote Snake Manager — Reconstructs body trails from 20Hz head snapshots
// ============================================================================
// The server sends head positions at 20Hz (every 3 ticks at 60Hz server).
// Each snapshot moves ~9px (BASE_SPEED=3 * 3 ticks). The offline renderer
// needs a PathBuffer with ~3px spacing (per-tick density).
//
// Strategy:
// 1. Store head position history (only on new ticks — never duplicate)
// 2. On new snapshot: rebuild dense PathBuffer by interpolating between entries
// 3. Between snapshots: use time-based alpha for smooth head interpolation
// 4. The renderer's built-in renderOffX/Y shifts the whole snake smoothly

import { PathBuffer } from '@/lib/snake/pool';
import type { Snake, FoodOrb, SkinRarity } from '@/lib/snake/types';
import type { RemoteFood, GameSnapshot } from './game-socket';
import { SEGMENT_SPACING, BASE_SPEED, FOOD_COLORS, FOOD_GLOW_COLORS } from '@/lib/snake/config';

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
  carriedChips: number;
  boosting: boolean;
  spawnTime: number;
  alive: boolean;
  // Head position history (newest first). Only unique ticks.
  history: PosEntry[];
  // Reusable PathBuffer for renderer (rebuilt on each new snapshot)
  path: PathBuffer;
  // Previous head position (for render-time interpolation)
  prevHeadX: number;
  prevHeadY: number;
  // Timestamp when the last snapshot was received (for time-based alpha)
  lastSnapTime: number;
  // Whether the path has been initialized with at least 2 points
  pathReady: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 600; // 30 seconds at 20Hz — enough for longest snakes
const SNAPSHOT_INTERVAL_MS = 50; // 1000/20 = 50ms between snapshots
const DENSE_STEP = BASE_SPEED; // ~3px between path points (matches offline per-tick density)

// ─── Manager ─────────────────────────────────────────────────────────────────

export class RemoteSnakeManager {
  private snakes = new Map<string, TrackedSnake>();
  private playerSnakeId: string | null = null;
  private lastProcessedTick = 0;
  private mapHalf: number;

  constructor(mapHalf: number) {
    this.mapHalf = mapHalf;
  }

  getMapHalf(): number {
    return this.mapHalf;
  }

  /** Update with a new server snapshot. ONLY processes if tick changed. */
  updateSnapshot(snap: GameSnapshot): boolean {
    // Only process if this is a new tick
    if (snap.tick <= this.lastProcessedTick && this.lastProcessedTick > 0) return false;
    this.lastProcessedTick = snap.tick;

    const now = performance.now();

    // Mark all current snakes as unseen (for removal)
    const seen = new Set<string>();

    for (const rs of snap.snakes) {
      seen.add(rs.id);
      let tracked = this.snakes.get(rs.id);

      if (!tracked) {
        // New snake — initialize
        const pathCap = Math.max(Math.ceil(rs.bl * 3), 300);
        tracked = {
          id: rs.id,
          name: rs.name,
          color: rs.color,
          headColor: rs.sc,  // compact: secondaryColor → sc
          isBot: rs.ib,       // compact: isBot → ib
          isPlayer: rs.ip,    // compact: isPlayer → ip
          skinId: rs.si || 'skin-default',
          rarity: (rs.ra as SkinRarity) || 'common',
          bodyLen: rs.bl,      // compact: bodyLen → bl
          bodyRadius: rs.br,  // compact: bodyRadius → br
          score: rs.score,
          carriedChips: rs.cc || 0,
          boosting: rs.bo,     // compact: boosting → bo
          spawnTime: now,
          alive: true,
          history: [],
          path: new PathBuffer(pathCap),
          prevHeadX: rs.hx,
          prevHeadY: rs.hy,
          lastSnapTime: now,
          pathReady: false,
        };
        this.snakes.set(rs.id, tracked);
        if (rs.ip) this.playerSnakeId = rs.id;
      } else {
        // Save previous head for interpolation BEFORE updating
        if (tracked.history.length > 0) {
          tracked.prevHeadX = tracked.history[0].x;
          tracked.prevHeadY = tracked.history[0].y;
        } else {
          tracked.prevHeadX = rs.hx;
          tracked.prevHeadY = rs.hy;
        }
        // Update metadata
        tracked.bodyLen = rs.bl;
        tracked.bodyRadius = rs.br;
        tracked.score = rs.score;
        tracked.carriedChips = rs.cc || 0;
        tracked.boosting = rs.bo;
        tracked.color = rs.color;
        tracked.headColor = rs.sc;
        tracked.alive = true;
        tracked.lastSnapTime = now;
        if (rs.si) tracked.skinId = rs.si;
        if (rs.ra) tracked.rarity = rs.ra as SkinRarity;
      }

      // Push new head position to history (only once per tick)
      tracked.history.unshift({ x: rs.hx, y: rs.hy, angle: rs.angle, tick: snap.tick });
      if (tracked.history.length > MAX_HISTORY) {
        tracked.history.length = MAX_HISTORY;
      }

      // Rebuild dense path from history
      this.rebuildPath(tracked);
    }

    // Remove snakes not in snapshot
    for (const [id] of this.snakes) {
      if (!seen.has(id)) {
        this.snakes.delete(id);
      }
    }

    return true;
  }

  /** Rebuild a dense PathBuffer from a snake's history */
  private rebuildPath(tracked: TrackedSnake): void {
    const history = tracked.history;
    if (history.length === 0) return;

    const visualLen = tracked.bodyLen * SEGMENT_SPACING;
    // How many history entries we need to cover the visual body length
    // Each entry is ~9px apart (3 ticks * 3px/tick at base speed)
    const pxPerEntry = BASE_SPEED * 3; // ~9px
    const neededEntries = Math.ceil(visualLen / pxPerEntry) + 5;
    const entries = history.slice(0, Math.min(neededEntries, history.length));

    // Sanity check: ensure PathBuffer has valid data before writing
    if (!tracked.path.data || tracked.path.data.length === 0 || tracked.path.capacity === 0) {
      const safeCap = Math.max(Math.ceil(tracked.bodyLen * 3), 300);
      tracked.path = new PathBuffer(safeCap);
    }

    if (entries.length === 1) {
      // Only one entry — create a synthetic trail behind the head based on angle
      const head = entries[0];
      const pathLen = Math.max(Math.ceil(visualLen / DENSE_STEP) + 5, 10);
      if (tracked.path.capacity < pathLen) {
        tracked.path = new PathBuffer(pathLen + 50);
      }
      tracked.path.resetTo(head.x, head.y);
      // Append trail behind head
      const backAngle = head.angle + Math.PI; // opposite of heading
      for (let i = 1; i < pathLen; i++) {
        tracked.path.appendTail(
          head.x + Math.cos(backAngle) * DENSE_STEP * i,
          head.y + Math.sin(backAngle) * DENSE_STEP * i,
        );
      }
      tracked.pathReady = true;
      return;
    }

    // Multiple entries — interpolate between consecutive entries for dense path
    // First, compute total path length from entries
    let totalEntryDist = 0;
    for (let i = 0; i < entries.length - 1; i++) {
      const dx = entries[i + 1].x - entries[i].x;
      const dy = entries[i + 1].y - entries[i].y;
      totalEntryDist += Math.sqrt(dx * dx + dy * dy);
    }

    // Build dense path by interpolating between entries
    // Aim for DENSE_STEP (~3px) between consecutive path points
    const estimatedPoints = Math.max(Math.ceil(totalEntryDist / DENSE_STEP) + 10, 20);
    if (tracked.path.capacity < estimatedPoints) {
      tracked.path = new PathBuffer(estimatedPoints + 50);
    }

    // Start with head position
    tracked.path.resetTo(entries[0].x, entries[0].y);

    for (let i = 0; i < entries.length - 1; i++) {
      const from = entries[i];
      const to = entries[i + 1];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.01) continue; // Skip zero-distance entries

      // How many intermediate points to insert between these two entries
      // Distance is ~9px at base speed, step is ~3px, so ~3 points
      const numSteps = Math.max(1, Math.round(dist / DENSE_STEP));

      for (let s = 1; s <= numSteps; s++) {
        const t = s / numSteps;
        tracked.path.appendTail(
          from.x + dx * t,
          from.y + dy * t,
        );
      }
    }

    // Extend trail if path is shorter than visual body length
    const currentPathLen = (tracked.path.length - 1) * DENSE_STEP;
    if (currentPathLen < visualLen && entries.length >= 2) {
      const lastEntry = entries[entries.length - 1];
      const prevEntry = entries.length >= 3 ? entries[entries.length - 2] : entries[entries.length - 1];
      const tailDx = lastEntry.x - prevEntry.x;
      const tailDy = lastEntry.y - prevEntry.y;
      const tailDist = Math.sqrt(tailDx * tailDx + tailDy * tailDy);
      const tailAngle = tailDist > 0.01 ? Math.atan2(tailDy, tailDx) : lastEntry.angle;

      const neededExtra = Math.ceil((visualLen - currentPathLen) / DENSE_STEP);
      for (let i = 0; i < neededExtra; i++) {
        tracked.path.appendTail(
          lastEntry.x + Math.cos(tailAngle) * DENSE_STEP * (i + 1),
          lastEntry.y + Math.sin(tailAngle) * DENSE_STEP * (i + 1),
        );
      }
    }

    // Trim to not exceed visual body length by too much
    const maxPoints = Math.ceil(visualLen / DENSE_STEP) + 10;
    if (tracked.path.length > maxPoints) {
      tracked.path.trimTo(maxPoints);
    }

    tracked.pathReady = tracked.path.length >= 2;
  }

  /** Get time-based interpolation alpha (0..1) for the player snake */
  getPlayerAlpha(): number {
    if (!this.playerSnakeId) return 1;
    const tracked = this.snakes.get(this.playerSnakeId);
    if (!tracked) return 1;
    const elapsed = performance.now() - tracked.lastSnapTime;
    return Math.min(1, elapsed / SNAPSHOT_INTERVAL_MS);
  }

  /** Build a Snake adapter for a remote snake (for the shared renderer) */
  buildSnakeAdapter(id: string): Snake | null {
    const t = this.snakes.get(id);
    if (!t || !t.pathReady) return null;

    // Safety: if PathBuffer data is empty or corrupted, replace it
    if (!t.path.data || t.path.data.length === 0 || t.path.length === 0) {
      const newCap = Math.max(Math.ceil(t.bodyLen * 3), 300);
      t.path = new PathBuffer(newCap);
      this.rebuildPath(t);
      if (!t.path.data || t.path.data.length === 0 || t.path.length < 2) return null;
    }

    // Ensure headX/headY are valid numbers (PathBuffer getter can return undefined
    // if headSegIdx gets corrupted or data array is out of bounds)
    const rawHeadX = t.path.headX;
    const rawHeadY = t.path.headY;
    const headX = typeof rawHeadX === 'number' && isFinite(rawHeadX) ? rawHeadX : t.prevHeadX;
    const headY = typeof rawHeadY === 'number' && isFinite(rawHeadY) ? rawHeadY : t.prevHeadY;
    const safeHeadX = typeof headX === 'number' && isFinite(headX) ? headX : 0;
    const safeHeadY = typeof headY === 'number' && isFinite(headY) ? headY : 0;

    // Build the Snake adapter object
    return {
      id: t.id,
      name: t.name,
      path: t.path,
      angle: t.history.length > 0 ? t.history[0].angle : 0,
      prevAngle: t.history.length > 1 ? t.history[1].angle : 0,
      speed: BASE_SPEED,
      score: t.score,
      carriedChips: t.carriedChips,
      boosting: t.boosting,
      alive: true,
      isBot: t.isBot,
      isPlayer: t.isPlayer,
      spawnTime: t.spawnTime,
      color: t.color,
      headColor: t.headColor,
      lastBoostDrop: 0,
      targetAngle: t.history.length > 0 ? t.history[0].angle : 0,
      spiral: { active: false, consecutiveTurns: 0, ticksElapsed: 0, direction: 1 },
      bodyRadius: t.bodyRadius,
      cachedBodyLength: t.bodyLen,
      cachedBodyScore: t.score,
      cachedVisualTailIdx: 0,
      prevHeadX: safeHeadX,
      prevHeadY: safeHeadY,
      smoothBrakeFactor: 1.0,
      skinId: t.skinId,
      rarity: t.rarity,
      _headX: safeHeadX,
      _headY: safeHeadY,
      _prevHx: typeof t.prevHeadX === 'number' && isFinite(t.prevHeadX) ? t.prevHeadX : safeHeadX,
      _prevHy: typeof t.prevHeadY === 'number' && isFinite(t.prevHeadY) ? t.prevHeadY : safeHeadY,
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

  // Color → glowColor reverse lookup (built once)
  private static _glowMap: Map<string, string> | null = null;
  private static getGlowMap(): Map<string, string> {
    if (!RemoteSnakeManager._glowMap) {
      const m = new Map<string, string>();
      for (let i = 0; i < FOOD_COLORS.length; i++) {
        m.set(FOOD_COLORS[i], FOOD_GLOW_COLORS[i]);
      }
      RemoteSnakeManager._glowMap = m;
    }
    return RemoteSnakeManager._glowMap;
  }

  /** Convert remote foods to FoodOrb[] for the shared renderer */
  buildFoodArray(foods: RemoteFood[]): FoodOrb[] {
    const glowMap = RemoteSnakeManager.getGlowMap();
    const result: FoodOrb[] = new Array(foods.length);
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      // Map server radius to size: FOOD_RADII = [1.5, 2, 3]
      // Small: 1.5, Medium: 2.0, Large: 3.0 — matches offline exactly
      const size: 'small' | 'medium' | 'large' =
        f.r >= 2.5 ? 'large' : f.r >= 1.75 ? 'medium' : 'small';
      const value = f.r >= 2.5 ? 50 : f.r >= 1.75 ? 15 : 5;
      result[i] = {
        id: i,
        x: f.x,
        y: f.y,
        size,
        value,
        radius: f.r,
        color: f.color,
        glowColor: glowMap.get(f.color) || f.color,
        magnetized: f.m,
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
