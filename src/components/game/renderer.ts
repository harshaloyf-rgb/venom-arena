// ============================================================================
// Renderer — Pure Canvas API rendering functions. No React dependencies.
// Uses chain-simulated body rendering with progressive inner curl.
// ============================================================================

import type { Camera, FoodOrb, GameState, Snake, StarChip, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS, START_LENGTH, GROWTH_RATE, MAX_SNAKE_LENGTH } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';

// ── Chain-simulated body rendering ───────────────────────────────────
//
// Instead of drawing a circle at every path entry (which causes boost
// stretching and no inner curl), we simulate a chain that walks the path
// at a FIXED visual step. This solves two problems:
//
// 1. BOOST STRETCHING: Path entries are spaced at current speed (4.5px normal,
//    8px boost). Drawing at fixed 5px intervals with interpolation keeps
//    body density constant.
//
// 2. INNER CURL (CORNER-CUTTING): Each chain segment is constrained to be
//    CHAIN_STEP from the previous one, in the direction of the path target.
//    On curves, the chain takes a shorter path than the head (chord vs arc).
//    Additionally, a progressive curvature offset grows with sqrt(segment_index)
//    to create visible spiral tightening during sustained turns.

/** Fixed pixel spacing between drawn body circles. Less than SNAKE_RADIUS for overlap. */
const CHAIN_STEP = 5;

/** Progressive inner curl amplification. Higher = more dramatic spiral tightening. */
const CURL_AMP = 6.0;

/** Maximum inner curl offset in pixels (prevents extreme distortion). */
const MAX_CURL_PX = 12;

/** Segments from head before inner curl reaches full strength (fade-in). */
const CURL_FADE_SEGS = 8;

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

  // ── CHAIN-SIMULATED BODY ──
  // Walk the path at fixed CHAIN_STEP intervals (interpolating between
  // path entries). Apply chain constraint + progressive inner curl offset.
  // This produces: (1) consistent body density at all speeds,
  // (2) inner curl that tightens progressively from head to tail.

  ctx.fillStyle = snake.color;
  ctx.beginPath();
  let hasBodySegs = false;

  if (pathLen >= 3) {
    // Chain state: starts at head
    let chainX = headWorldX;
    let chainY = headWorldY;

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
    const getCursorPos = (outX: number[], outY: number[]) => {
      const sx = path.getX(pIdx);
      const sy = path.getY(pIdx);
      if (pIdx + 1 < pathLen && pFrac < 1 && pSegLen > 0.01) {
        outX[0] = sx + pSegDx * pFrac;
        outY[0] = sy + pSegDy * pFrac;
      } else {
        outX[0] = sx;
        outY[0] = sy;
      }
    };

    const step = CHAIN_STEP;
    const maxSegs = Math.ceil(pathLen * 2) + 4;
    const cursorXY = [0, 0]; // reusable array to avoid allocation

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
      getCursorPos(cursorXY, cursorXY);
      let pathX = cursorXY[0];
      let pathY = cursorXY[1];

      // If we reached the end without walking the full step, use last path position
      if (reachedEnd) {
        if (pIdx < pathLen) {
          pathX = path.getX(Math.min(pIdx, pathLen - 1));
          pathY = path.getY(Math.min(pIdx, pathLen - 1));
        }
      }

      // ── Chain constraint: place at CHAIN_STEP from previous chain point ──
      const cdx = pathX - chainX;
      const cdy = pathY - chainY;
      const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

      if (cdist > 0.01) {
        const invDist = step / cdist;
        chainX = chainX + cdx * invDist;
        chainY = chainY + cdy * invDist;
      }

      // ── Progressive inner curl offset ──
      // Compute curvature from 3 path points around current position.
      // Offset grows with sqrt(segment_index) and fades in near the head.
      const ci = pIdx >= 1 && pIdx + 1 < pathLen ? pIdx : -1;
      if (ci >= 0) {
        const ax = path.getX(ci - 1);
        const ay = path.getY(ci - 1);
        const bx = path.getX(ci + 1);
        const by = path.getY(ci + 1);
        const sx = path.getX(ci);
        const sy = path.getY(ci);

        const v1x = sx - ax;
        const v1y = sy - ay;
        const v2x = bx - sx;
        const v2y = by - sy;

        const cross = v1x * v2y - v1y * v2x;
        if (Math.abs(cross) > 0.005) {
          const dot = v1x * v2x + v1y * v2y;
          const turnAngle = Math.atan2(Math.abs(cross), dot);

          const travelX = bx - ax;
          const travelY = by - ay;
          const travelLen = Math.sqrt(travelX * travelX + travelY * travelY);

          if (travelLen > 0.01) {
            const invLen = 1 / travelLen;
            let normX: number, normY: number;
            if (cross > 0) {
              normX = -travelY * invLen;
              normY = travelX * invLen;
            } else {
              normX = travelY * invLen;
              normY = -travelX * invLen;
            }

            // Progressive: grows with sqrt(s), fades in near head
            const fade = Math.min(1, (s - 1) / CURL_FADE_SEGS);
            let offset = turnAngle * CURL_AMP * Math.sqrt(s) * fade;
            if (offset > MAX_CURL_PX) offset = MAX_CURL_PX;

            chainX += normX * offset;
            chainY += normY * offset;
          }
        }
      }

      // ── Draw circle at chain position ──
      if (chainX >= vl && chainX <= vr && chainY >= vt && chainY <= vb) {
        const scr = worldToScreen(chainX, chainY, camera, cw, ch);
        ctx.moveTo(scr.x + segRadius, scr.y);
        ctx.arc(scr.x, scr.y, segRadius, 0, Math.PI * 2);
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
