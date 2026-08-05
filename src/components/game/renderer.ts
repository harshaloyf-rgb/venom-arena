// ============================================================================
// Renderer — Pure Canvas API rendering functions. No React dependencies.
// Uses chain-simulated body rendering with progressive inner curl.
// ============================================================================

import type { Camera, FoodOrb, GameState, Snake, StarChip, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS, START_LENGTH, GROWTH_RATE, MAX_SNAKE_LENGTH } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';

// ── Chain-simulated body rendering with leaky-integrator inner curl ─────
//
// The renderer walks the path buffer at a FIXED visual step (CHAIN_STEP),
// interpolating between path entries. This solves two problems:
//
// 1. BOOST STRETCHING: Path entries are spaced at current speed (4.5px normal,
//    8px boost). Drawing at fixed 5px intervals with interpolation keeps
//    body density constant regardless of speed.
//
// 2. INNER CURL (CORNER-CUTTING): A leaky integrator accumulates signed
//    curvature from head to tail. Each segment is offset perpendicular to the
//    path toward the center of curvature. The offset GROWS progressively
//    toward the tail, creating visible spiral tightening. Circle radius
//    also shrinks toward the tail during sustained turns.

/** Fixed pixel spacing between drawn body circles. Less than SNAKE_RADIUS for overlap. */
const CHAIN_STEP = 5;

/** How fast curl offset accumulates per unit of curvature per step. */
const CURL_STRENGTH = 3.5;

/** Leaky integrator decay per step (0.97 = 33-step time constant ≈ 165px). */
const CURL_DECAY = 0.97;

/** Circle radius shrink per pixel of accumulated curl offset. */
const SIZE_SHRINK = 0.025;

/** Maximum fraction of radius that can be shrunk (0.55 = 55%). */
const MAX_SIZE_SHRINK = 0.55;

/** Segments from head before inner curl reaches full strength (fade-in). */
const CURL_FADE = 4;

const GRID_SIZE = 80;
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)';
const BG_COLOR = '#0a0a0f';

// ==========================================================================
// Main render function
// ==========================================================================

/** Render the entire game frame */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  fps: number,
  now: number,
): void {
  const { width, height } = viewport;

  // Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGrid(ctx, camera, viewport);

  // Extraction zone (faint circle, drawn under everything)
  if (state.extractionZone.active) {
    drawExtractionZone(ctx, state.extractionZone, camera, viewport);
  }

  // Food
  drawFood(ctx, state.foods, camera, viewport);

  // Star chips (golden glow circles)
  if (state.starChips.length > 0) {
    drawStarChips(ctx, state.starChips, camera, viewport, now);
  }

  // Snakes (bots first, then player on top)
  for (const [, s] of state.snakes) {
    if (s.alive && !s.isPlayer) drawSnake(ctx, s, camera, viewport, now);
  }
  if (state.player && state.player.alive) {
    drawSnake(ctx, state.player, camera, viewport, now);
  }

  // HUD
  if (state.player) {
    drawHUD(ctx, state.player, fps, viewport);
  }
}

// ==========================================================================
// Grid
// ==========================================================================

function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera, viewport: Viewport): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  const zoomedGrid = GRID_SIZE * camera.zoom;
  if (zoomedGrid < 4) return;

  const offsetX = (-camera.x * camera.zoom + viewport.width / 2) % zoomedGrid;
  const offsetY = (-camera.y * camera.zoom + viewport.height / 2) % zoomedGrid;

  ctx.beginPath();
  for (let x = offsetX; x < viewport.width; x += zoomedGrid) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, viewport.height);
  }
  for (let y = offsetY; y < viewport.height; y += zoomedGrid) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(viewport.width, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

// ==========================================================================
// Food
// ==========================================================================

function drawFood(
  ctx: CanvasRenderingContext2D,
  foods: FoodOrb[],
  camera: Camera,
  viewport: Viewport,
): void {
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];

    // Cull off-screen
    if (f.x < viewport.left - 20 || f.x > viewport.right + 20) continue;
    if (f.y < viewport.top - 20 || f.y > viewport.bottom + 20) continue;

    const { x: sx, y: sy } = worldToScreen(f.x, f.y, camera, cw, ch);
    const r = f.radius * zoom;

    if (r < 1) continue;

    // Glow
    if (r > 2) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = f.glowColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Circle
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==========================================================================
// Star Chips (golden glow collectibles)
// ==========================================================================

function drawStarChips(
  ctx: CanvasRenderingContext2D,
  chips: StarChip[],
  camera: Camera,
  viewport: Viewport,
  now: number,
): void {
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  for (let i = 0; i < chips.length; i++) {
    const c = chips[i];

    // Cull off-screen
    if (c.x < viewport.left - 30 || c.x > viewport.right + 30) continue;
    if (c.y < viewport.top - 30 || c.y > viewport.bottom + 30) continue;

    const { x: sx, y: sy } = worldToScreen(c.x, c.y, camera, cw, ch);
    const r = c.radius * zoom;
    if (r < 1) continue;

    // Pulsing golden glow
    const pulse = 0.7 + 0.3 * Math.sin((now - c.spawnTime) * 0.004);
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = c.glowColor;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.globalAlpha = 0.2 * pulse;
    ctx.strokeStyle = c.glowColor;
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Core circle
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner highlight
    if (r > 3) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(sx - r * 0.15, sy - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ==========================================================================
// Extraction Zone
// ==========================================================================

function drawExtractionZone(
  ctx: CanvasRenderingContext2D,
  zone: { x: number; y: number; radius: number; active: boolean },
  camera: Camera,
  viewport: Viewport,
): void {
  const cw = viewport.width;
  const ch = viewport.height;
  const { x: sx, y: sy } = worldToScreen(zone.x, zone.y, camera, cw, ch);
  const sr = zone.radius * camera.zoom;

  // Faint filled circle
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  // Dashed border ring
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2 * camera.zoom;
  ctx.setLineDash([8 * camera.zoom, 6 * camera.zoom]);
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
}

// ==========================================================================
// Snakes — Chain-Simulated Body with Progressive Inner Curl
// ==========================================================================

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  now: number,
): void {
  const path = snake.path;
  const pathLen = path.length;
  if (pathLen === 0) return;

  // ── HEAD-LEVEL CULLING ──
  const headWorldX = path.headX;
  const headWorldY = path.headY;
  const cullMargin = Math.min(pathLen * 8, 500) + 100;
  if (headWorldX < viewport.left - cullMargin || headWorldX > viewport.right + cullMargin) return;
  if (headWorldY < viewport.top - cullMargin || headWorldY > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  // Spawn protection blink
  if (now - snake.spawnTime < SPAWN_PROTECTION_MS && Math.floor(now / 150) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  const segRadius = SNAKE_RADIUS * zoom;
  const headRadius = segRadius * 1.3;

  const vl = viewport.left - 20;
  const vr = viewport.right + 20;
  const vt = viewport.top - 20;
  const vb = viewport.bottom + 20;

  const headScreen = worldToScreen(headWorldX, headWorldY, camera, cw, ch);
  const headVisible = headWorldX >= vl && headWorldX <= vr && headWorldY >= vt && headWorldY <= vb;

  // ── CHAIN-SIMULATED BODY WITH LEAKY-INTEGRATOR INNER CURL ──
  // Walk the path at fixed CHAIN_STEP intervals (interpolating between
  // path entries for consistent density at all speeds). A leaky integrator
  // accumulates signed curvature from head to tail, producing:
  // (1) Progressive perpendicular offset (inner curl / corner-cutting)
  // (2) Progressive circle radius reduction (spiral tightening visual)

  ctx.fillStyle = snake.color;
  ctx.beginPath();
  let hasBodySegs = false;

  if (pathLen >= 3) {
    // Path cursor state
    let pIdx = 0;          // current path segment start index
    let pFrac = 0;         // fraction [0..1] from pIdx to pIdx+1
    let pSegLen = 0;       // length of path[pIdx] → path[pIdx+1]
    let pSegDx = 0;        // dx of current path segment
    let pSegDy = 0;        // dy of current path segment

    // Initialize first path segment
    pSegDx = path.getX(1) - headWorldX;
    pSegDy = path.getY(1) - headWorldY;
    pSegLen = Math.sqrt(pSegDx * pSegDx + pSegDy * pSegDy);

    // Advance cursor to next path segment
    const advancePathSeg = () => {
      pIdx++;
      if (pIdx + 1 < pathLen) {
        const sx = path.getX(pIdx);
        const sy = path.getY(pIdx);
        pSegDx = path.getX(pIdx + 1) - sx;
        pSegDy = path.getY(pIdx + 1) - sy;
        pSegLen = Math.sqrt(pSegDx * pSegDx + pSegDy * pSegDy);
      } else {
        pSegLen = 0;
      }
      pFrac = 0;
    };

    // Get interpolated position on path at current cursor
    const getCursorPos = (out: number[]) => {
      const sx = path.getX(pIdx);
      const sy = path.getY(pIdx);
      if (pIdx + 1 < pathLen && pFrac < 1 && pSegLen > 0.01) {
        out[0] = sx + pSegDx * pFrac;
        out[1] = sy + pSegDy * pFrac;
      } else {
        out[0] = sx;
        out[1] = sy;
      }
    };

    // Get normalized path direction at current cursor position
    const getPathDir = (out: number[]) => {
      let dx: number, dy: number;
      if (pIdx + 1 < pathLen) {
        dx = path.getX(pIdx + 1) - path.getX(pIdx);
        dy = path.getY(pIdx + 1) - path.getY(pIdx);
      } else if (pIdx >= 1) {
        dx = path.getX(pIdx) - path.getX(pIdx - 1);
        dy = path.getY(pIdx) - path.getY(pIdx - 1);
      } else {
        out[0] = Math.cos(snake.angle);
        out[1] = Math.sin(snake.angle);
        return;
      }
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) { dx /= len; dy /= len; }
      out[0] = dx;
      out[1] = dy;
    };

    // Compute signed curvature at current path position from 3 consecutive points.
    // Positive = turning left, Negative = turning right.
    const getCurvature = (): number => {
      if (pIdx < 1 || pIdx + 1 >= pathLen) return 0;
      const ax = path.getX(pIdx - 1), ay = path.getY(pIdx - 1);
      const bx = path.getX(pIdx + 1), by = path.getY(pIdx + 1);
      const sx = path.getX(pIdx), sy = path.getY(pIdx);
      const v1x = sx - ax, v1y = sy - ay;
      const v2x = bx - sx, v2y = by - sy;
      return Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
    };

    const step = CHAIN_STEP;
    const maxSegs = Math.ceil(pathLen * 2) + 4;
    const tmpPos = [0, 0]; // reusable array to avoid allocation
    const tmpDir = [0, 0]; // reusable array for direction

    let cumulativeCurl = 0; // leaky integrator state (signed offset in pixels)

    for (let s = 1; s < maxSegs; s++) {
      // ── Walk 'step' pixels along the path ──
      let toWalk = step;
      let reachedEnd = false;

      while (toWalk > 0.01) {
        // Skip zero-length path segments
        if (pSegLen < 0.01) {
          advancePathSeg();
          if (pIdx + 1 >= pathLen) { reachedEnd = true; break; }
          continue;
        }

        const avail = pSegLen * (1 - pFrac);
        if (avail <= 0.01) {
          advancePathSeg();
          if (pIdx + 1 >= pathLen) { reachedEnd = true; break; }
          continue;
        }

        if (avail <= toWalk) {
          toWalk -= avail;
          advancePathSeg();
          if (pIdx + 1 >= pathLen) { reachedEnd = true; break; }
        } else {
          pFrac += toWalk / pSegLen;
          toWalk = 0;
        }
      }

      // Get the path position where the cursor ended up
      getCursorPos(tmpPos);
      const pathX = tmpPos[0];
      const pathY = tmpPos[1];

      // If we reached the end, draw the last point and stop
      if (reachedEnd && pIdx < pathLen) {
        const lx = path.getX(Math.min(pIdx, pathLen - 1));
        const ly = path.getY(Math.min(pIdx, pathLen - 1));
        // Apply whatever curl we've accumulated
        const fade = Math.min(1, (s - 1) / CURL_FADE);
        getPathDir(tmpDir);
        const rightX = -tmpDir[1], rightY = tmpDir[0];
        const vx = lx + rightX * cumulativeCurl;
        const vy = ly + rightY * cumulativeCurl;
        const shrink = Math.min(Math.abs(cumulativeCurl) * SIZE_SHRINK, MAX_SIZE_SHRINK);
        const tailSr = SNAKE_RADIUS * (1 - shrink) * zoom;
        if (vx >= vl && vx <= vr && vy >= vt && vy <= vb) {
          const scr = worldToScreen(vx, vy, camera, cw, ch);
          ctx.moveTo(scr.x + tailSr, scr.y);
          ctx.arc(scr.x, scr.y, tailSr, 0, Math.PI * 2);
          hasBodySegs = true;
        }
        break;
      }

      // ── Leaky integrator: accumulate curvature → inner curl offset ──
      const curvature = getCurvature();
      const fade = Math.min(1, (s - 1) / CURL_FADE);

      cumulativeCurl *= CURL_DECAY;
      cumulativeCurl += curvature * CURL_STRENGTH * fade;

      // ── Compute visual position with perpendicular offset ──
      // In screen coords (y-down), 90° CW rotation = (-dy, dx) = right perpendicular.
      // Positive cumulativeCurl (right turn on screen) → offset to the right → toward center
      getPathDir(tmpDir);
      const rightX = -tmpDir[1];
      const rightY = tmpDir[0];
      const visualX = pathX + rightX * cumulativeCurl;
      const visualY = pathY + rightY * cumulativeCurl;

      // ── Progressive size reduction during turns ──
      const shrink = Math.min(Math.abs(cumulativeCurl) * SIZE_SHRINK, MAX_SIZE_SHRINK);
      const visualR = SNAKE_RADIUS * (1 - shrink);

      if (visualX >= vl && visualX <= vr && visualY >= vt && visualY <= vb) {
        const scr = worldToScreen(visualX, visualY, camera, cw, ch);
        const sr = visualR * zoom;
        ctx.moveTo(scr.x + sr, scr.y);
        ctx.arc(scr.x, scr.y, sr, 0, Math.PI * 2);
        hasBodySegs = true;
      }

      if (reachedEnd) break;
    }
  }

  if (hasBodySegs) ctx.fill();

  // ── Head ──
  if (headVisible) {
    ctx.fillStyle = snake.headColor;
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Eyes, boost lines, name label ──
  if (headVisible) {
    drawEyes(ctx, headScreen.x, headScreen.y, snake.angle, headRadius);

    if (snake.boosting && segRadius > 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 * zoom;
      for (let j = 0; j < 3; j++) {
        const a = snake.angle + Math.PI + (j - 1) * 0.3;
        const len = (15 + j * 5) * zoom;
        const bx = headScreen.x - Math.cos(snake.angle) * headRadius;
        const by = headScreen.y - Math.sin(snake.angle) * headRadius;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(snake.name, headScreen.x, headScreen.y - headRadius - 4 * zoom);
    }
  }

  ctx.globalAlpha = 1;
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
  headRadius: number,
): void {
  const eyeOffset = headRadius * 0.4;
  const eyeRadius = headRadius * 0.25;
  const pupilRadius = eyeRadius * 0.6;
  const perpAngle = angle + Math.PI / 2;
  const eyeForward = headRadius * 0.3;

  for (const side of [-1, 1]) {
    const ex = hx + Math.cos(angle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(angle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    const px = ex + Math.cos(angle) * pupilRadius * 0.3;
    const py = ey + Math.sin(angle) * pupilRadius * 0.3;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==========================================================================
// HUD
// ==========================================================================

function drawHUD(
  ctx: CanvasRenderingContext2D,
  player: Snake,
  fps: number,
  viewport: Viewport,
): void {
  const p = 16;
  const lh = 22;

  // Background box
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(p, p, 180, lh * 2 + p * 2, 8);
  ctx.fill();

  // Score
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`Score: ${player.score}`, p + 12, p + 10);

  // Length: show logical segment count, not raw path buffer entries
  const logicalLength = Math.min(Math.floor(START_LENGTH + player.score * GROWTH_RATE), MAX_SNAKE_LENGTH);
  ctx.font = '13px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText(`Length: ${logicalLength}`, p + 12, p + 10 + lh);

  // FPS
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '12px monospace';
  ctx.fillText(`${fps} FPS`, viewport.width - p, p);
}

// ==========================================================================
// Death overlay
// ==========================================================================

export function drawDeathOverlay(
  ctx: CanvasRenderingContext2D,
  score: number,
  viewport: Viewport,
): void {
  const { width, height } = viewport;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('You died!', width / 2, height / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Score: ${score}`, width / 2, height / 2 + 10);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press Space or Click to respawn', width / 2, height / 2 + 50);
}

// ==========================================================================
// Controls hint
// ==========================================================================

export function drawControlsHint(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  const { width, height } = viewport;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 200, height / 2 + 60, 400, 80, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '14px monospace';
  ctx.fillText('WASD / Mouse to steer', width / 2, height / 2 + 85);
  ctx.fillText('Space / Click to boost', width / 2, height / 2 + 110);
}

// ==========================================================================
// Minimap
// ==========================================================================

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  snakes: Map<string, Snake>,
  player: Snake | null,
): void {
  const size = 120;
  const pad = 12;

  // Get canvas dimensions from ctx
  const cw = ctx.canvas.width / (window.devicePixelRatio || 1);
  const ch = ctx.canvas.height / (window.devicePixelRatio || 1);
  const mx = cw - size - pad;
  const my = ch - size - pad;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!player || !player.alive || player.path.length === 0) return;

  const scale = 0.02;
  const cx = mx + size / 2;
  const cy = my + size / 2;
  const px = player.path.headX;
  const py = player.path.headY;
  const halfSize = size / 2 - 4;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (const [, snake] of snakes) {
    if (!snake.alive || snake.isPlayer) continue;
    if (snake.path.length === 0) continue;
    const dx = (snake.path.headX - px) * scale;
    const dy = (snake.path.headY - py) * scale;
    if (Math.abs(dx) > halfSize || Math.abs(dy) > halfSize) continue;
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
  }

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}
