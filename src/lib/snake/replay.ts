// ============================================================================
// Death Replay System — Records game state for collision diagnosis
// ============================================================================

import type { Snake } from './types';
import { SNAKE_RADIUS, NECK_PROTECTION, SPAWN_PROTECTION_MS } from './config';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Snapshot of a single snake at one point in time */
export interface SnakeSnapshot {
  id: string;
  name: string;
  pathX: number[];
  pathY: number[];
  pathLen: number;
  angle: number;
  score: number;
  alive: boolean;
  boosting: boolean;
  spawnTime: number;
  color: string;
  headColor: string;
  bodyRadius: number;
  isPlayer: boolean;
}

/** One recorded frame (all snakes at one tick) */
export interface ReplayFrame {
  time: number;
  snakes: SnakeSnapshot[];
}

// ─── Replay Recorder ───────────────────────────────────────────────────────

const PRE_FRAMES = 300;  // 5s × 60fps
const POST_FRAMES = 300; // 5s × 60fps

export class ReplayRecorder {
  private preBuffer: ReplayFrame[] = [];
  private postBuffer: ReplayFrame[] = [];
  deathFrameIdx = -1;
  recording = true;
  playerDied = false;
  deathTime = 0;

  /** Call every game tick. Pass true for playerDied on the tick the player dies. */
  record(snakes: Map<string, Snake>, now: number, playerDied: boolean): void {
    if (!this.recording) return;

    const frame = this.captureFrame(snakes, now);

    if (!this.playerDied) {
      // Pre-death ring buffer
      if (this.preBuffer.length >= PRE_FRAMES) this.preBuffer.shift();
      this.preBuffer.push(frame);

      if (playerDied) {
        this.playerDied = true;
        this.deathFrameIdx = this.preBuffer.length - 1;
        this.deathTime = now;
      }
    } else {
      // Post-death append
      if (this.postBuffer.length < POST_FRAMES) {
        this.postBuffer.push(frame);
      } else {
        this.recording = false;
      }
    }
  }

  /** Get total available frames (pre + post) */
  get totalFrames(): number {
    return this.preBuffer.length + this.postBuffer.length;
  }

  /** Get frame by global index (0 = oldest pre, deathFrameIdx = death tick) */
  getFrame(index: number): ReplayFrame | null {
    if (index < 0 || index >= this.totalFrames) return null;
    if (index < this.preBuffer.length) return this.preBuffer[index];
    return this.postBuffer[index - this.preBuffer.length];
  }

  /** Seconds relative to death (negative = before, positive = after) */
  frameToRelSeconds(frameIdx: number): number {
    if (this.deathFrameIdx < 0) return 0;
    return (frameIdx - this.deathFrameIdx) / 60;
  }

  /** Reset for new game session */
  reset(): void {
    this.preBuffer = [];
    this.postBuffer = [];
    this.deathFrameIdx = -1;
    this.recording = true;
    this.playerDied = false;
    this.deathTime = 0;
  }

  private captureFrame(snakes: Map<string, Snake>, now: number): ReplayFrame {
    const snakeSnaps: SnakeSnapshot[] = [];
    for (const [, s] of snakes) {
      const len = s.path.length;
      const px: number[] = [];
      const py: number[] = [];
      for (let i = 0; i < len; i++) {
        px.push(s.path.getX(i));
        py.push(s.path.getY(i));
      }
      snakeSnaps.push({
        id: s.id, name: s.name,
        pathX: px, pathY: py, pathLen: len,
        angle: s.angle, score: s.score, alive: s.alive,
        boosting: s.boosting, spawnTime: s.spawnTime,
        color: s.color, headColor: s.headColor,
        bodyRadius: s.bodyRadius, isPlayer: s.isPlayer,
      });
    }
    return { time: now, snakes: snakeSnaps };
  }
}

// ─── Replay Renderer (draws a frame onto a canvas) ──────────────────────────

interface ReplayCamera {
  x: number; y: number; zoom: number;
}

function worldToScreen(wx: number, wy: number, cam: ReplayCamera, cw: number, ch: number) {
  return {
    x: (wx - cam.x) * cam.zoom + cw / 2,
    y: (wy - cam.y) * cam.zoom + ch / 2,
  };
}

const DOT_DIST_FACTOR = 0.75;

/** Render one replay frame with collision chains on all snakes */
export function renderReplayFrame(
  ctx: CanvasRenderingContext2D,
  frame: ReplayFrame,
  camera: ReplayCamera,
  width: number,
  height: number,
): void {
  const cw = width;
  const ch = height;

  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, cw, ch);

  // Grid
  drawReplayGrid(ctx, camera, cw, ch);

  const now = frame.time;

  // Draw all snakes
  for (const s of frame.snakes) {
    if (s.pathLen < 2) continue;

    const isImmune = now - s.spawnTime < SPAWN_PROTECTION_MS;
    const headScr = worldToScreen(s.pathX[0], s.pathY[0], camera, cw, ch);
    const radius = SNAKE_RADIUS * camera.zoom;

    // Body
    const bodyAlpha = isImmune ? 0.4 : 1.0;
    ctx.globalAlpha = bodyAlpha;

    // Simple circle body
    const step = Math.max(1, Math.floor(radius * 1.5 < 8 ? 1 : radius * 1.5 / (SNAKE_RADIUS * camera.zoom)));
    for (let i = s.pathLen - 1; i >= 0; i -= step) {
      const scr = worldToScreen(s.pathX[i], s.pathY[i], camera, cw, ch);
      if (scr.x < -50 || scr.x > cw + 50 || scr.y < -50 || scr.y > ch + 50) continue;

      if (i === 0) {
        // Head — slightly larger
        ctx.fillStyle = s.isPlayer ? '#22d3ee' : s.headColor;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.isPlayer ? '#06b6d4' : s.color;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;

    // ── COLLISION CHAIN (always visible in replay) ──
    drawCollisionChainDebug(ctx, s, camera, cw, ch, isImmune, now);

    // Name
    if (radius > 2 && (s.isPlayer || s.alive)) {
      ctx.fillStyle = s.isPlayer ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.max(10, 12 * camera.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        s.isPlayer ? `[YOU] ${s.name}` : s.name,
        headScr.x,
        headScr.y - radius * 1.5 - 6 * camera.zoom,
      );
      // Score
      ctx.font = `${Math.max(8, 10 * camera.zoom)}px sans-serif`;
      ctx.fillStyle = s.isPlayer ? 'rgba(34,211,238,0.8)' : 'rgba(255,255,255,0.3)';
      ctx.fillText(
        `Score: ${Math.floor(s.score)}`,
        headScr.x,
        headScr.y - radius * 1.5 - 18 * camera.zoom,
      );
    }

    // Dead X
    if (!s.alive && s.isPlayer) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      const s2 = radius * 2;
      ctx.beginPath();
      ctx.moveTo(headScr.x - s2, headScr.y - s2);
      ctx.lineTo(headScr.x + s2, headScr.y + s2);
      ctx.moveTo(headScr.x + s2, headScr.y - s2);
      ctx.lineTo(headScr.x - s2, headScr.y + s2);
      ctx.stroke();
    }
  }
}

function drawCollisionChainDebug(
  ctx: CanvasRenderingContext2D,
  s: SnakeSnapshot,
  cam: ReplayCamera,
  cw: number, ch: number,
  isImmune: boolean,
  now: number,
): void {
  if (s.pathLen < 2) return;

  const dotColor = isImmune ? '#00ffff' : '#ff0000';
  const bodyColor = isImmune ? '#006666' : '#ff6600';
  const chainColor = isImmune ? 'rgba(0,255,255,0.4)' : 'rgba(255,0,0,0.4)';
  const sqColor = isImmune ? 'rgba(0,255,255,0.3)' : 'rgba(255,68,68,0.35)';
  const sqStroke = isImmune ? 'rgba(0,255,255,0.7)' : 'rgba(220,38,38,0.7)';

  // Collect collision points
  const pts: { x: number; y: number; a: number }[] = [];

  // Head collision dot (offset forward by SNAKE_RADIUS * 0.75)
  const headDotX = s.pathX[0] + Math.cos(s.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
  const headDotY = s.pathY[0] + Math.sin(s.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
  const headScr = worldToScreen(headDotX, headDotY, cam, cw, ch);
  pts.push({ x: headScr.x, y: headScr.y, a: s.angle });

  // Body collision dots (every 2nd from NECK_PROTECTION)
  for (let i = NECK_PROTECTION; i < s.pathLen; i += 2) {
    const scr = worldToScreen(s.pathX[i], s.pathY[i], cam, cw, ch);
    if (scr.x < -50 || scr.x > cw + 50 || scr.y < -50 || scr.y > ch + 50) continue;
    pts.push({ x: scr.x, y: scr.y, a: 0 });
  }

  if (pts.length < 1) return;

  ctx.save();

  // Connecting line through all dots
  if (pts.length > 1) {
    ctx.strokeStyle = chainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  // Head dot — tiny black dot only (no colored circle, no diameter line)
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(pts[0].x, pts[0].y, 1, 0, Math.PI * 2);
  ctx.fill();

  // Body squares
  const sqHalf = (SNAKE_RADIUS * 0.55) * cam.zoom;
  for (let i = 1; i < pts.length; i++) {
    ctx.save();
    ctx.translate(pts[i].x, pts[i].y);
    ctx.fillStyle = sqColor;
    ctx.strokeStyle = sqStroke;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(-sqHalf, -sqHalf, sqHalf * 2, sqHalf * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // No-dot zone indicator (segments 1-4) — dim yellow circles
  ctx.strokeStyle = 'rgba(255,255,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < NECK_PROTECTION && i < s.pathLen; i++) {
    const scr = worldToScreen(s.pathX[i], s.pathY[i], cam, cw, ch);
    if (scr.x < -50 || scr.x > cw + 50 || scr.y < -50 || scr.y > ch + 50) continue;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, 3 * cam.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Immunity label
  if (isImmune) {
    const headScrFull = worldToScreen(s.pathX[0], s.pathY[0], cam, cw, ch);
    ctx.fillStyle = '#00ffff';
    ctx.font = `bold ${Math.max(9, 11 * cam.zoom)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('IMMUNE', headScrFull.x, headScrFull.y + (SNAKE_RADIUS * 2.5) * cam.zoom);
  }

  ctx.restore();
}

function drawReplayGrid(
  ctx: CanvasRenderingContext2D,
  cam: ReplayCamera,
  cw: number,
  ch: number,
): void {
  const gridSize = 100;
  const startX = Math.floor((cam.x - cw / 2 / cam.zoom) / gridSize) * gridSize;
  const endX = Math.ceil((cam.x + cw / 2 / cam.zoom) / gridSize) * gridSize;
  const startY = Math.floor((cam.y - ch / 2 / cam.zoom) / gridSize) * gridSize;
  const endY = Math.ceil((cam.y + ch / 2 / cam.zoom) / gridSize) * gridSize;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += gridSize) {
    const sx = (x - cam.x) * cam.zoom + cw / 2;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, ch);
  }
  for (let y = startY; y <= endY; y += gridSize) {
    const sy = (y - cam.y) * cam.zoom + ch / 2;
    ctx.moveTo(0, sy); ctx.lineTo(cw, sy);
  }
  ctx.stroke();

  // Origin crosshair
  const ox = (0 - cam.x) * cam.zoom + cw / 2;
  const oy = (0 - cam.y) * cam.zoom + ch / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox, 0); ctx.lineTo(ox, ch);
  ctx.moveTo(0, oy); ctx.lineTo(cw, oy);
  ctx.stroke();
}

// ─── Collision check between two snakes for a given frame (visual only) ─────

const COLLISION_DIST = SNAKE_RADIUS * 2;

export function findCloseCollisions(frame: ReplayFrame): string[] {
  const alerts: string[] = [];
  const snakes = frame.snakes;
  const now = frame.time;

  for (const a of snakes) {
    if (!a.alive || now - a.spawnTime < SPAWN_PROTECTION_MS) continue;
    const adx = a.pathX[0] + Math.cos(a.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
    const ady = a.pathY[0] + Math.sin(a.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;

    for (const b of snakes) {
      if (b.id === a.id || !b.alive) continue;
      if (now - b.spawnTime < SPAWN_PROTECTION_MS) continue;

      // Head A vs body B
      for (let i = NECK_PROTECTION; i < b.pathLen; i += 2) {
        const dx = adx - b.pathX[i];
        const dy = ady - b.pathY[i];
        if (dx * dx + dy * dy <= COLLISION_DIST * COLLISION_DIST) {
          alerts.push(`${a.name}'s head hit ${b.name}'s body (seg ${i})`);
          break;
        }
      }

      // Head A vs head B
      const bdx = b.pathX[0] + Math.cos(b.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
      const bdy = b.pathY[0] + Math.sin(b.angle) * SNAKE_RADIUS * DOT_DIST_FACTOR;
      const hdx = adx - bdx;
      const hdy = ady - bdy;
      if (hdx * hdx + hdy * hdy <= COLLISION_DIST * COLLISION_DIST) {
        alerts.push(`Head-on: ${a.name} vs ${b.name}`);
      }
    }
  }
  return alerts;
}
