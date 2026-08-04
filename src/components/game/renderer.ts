// ============================================================================
// Renderer — Pure Canvas API rendering functions. No React dependencies.
// ============================================================================

import type { Camera, FoodOrb, Snake, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS } from '@/lib/snake/constants';
import { worldToScreen } from '@/lib/snake/camera';

const GRID_SIZE = 80;
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)';
const BG_COLOR = '#0a0a0f';

// ==========================================================================
// Main render function
// ==========================================================================

/** Render the entire game frame */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: { foods: FoodOrb[]; snakes: Map<string, Snake>; player: Snake | null },
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

  // Food
  drawFood(ctx, state.foods, camera, viewport);

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
// Snakes
// ==========================================================================

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  now: number,
): void {
  const segs = snake.segments;
  if (segs.length === 0) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  // Spawn protection blink
  if (now - snake.spawnTime < SPAWN_PROTECTION_MS && Math.floor(now / 150) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  const segRadius = SNAKE_RADIUS * zoom;
  const headRadius = segRadius * 1.3;

  // Pre-compute screen positions for visible segments
  const vl = viewport.left - 30;
  const vr = viewport.right + 30;
  const vt = viewport.top - 30;
  const vb = viewport.bottom + 30;

  const screenSegs: { x: number; y: number; idx: number }[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (seg.x < vl || seg.x > vr || seg.y < vt || seg.y > vb) continue;
    const s = worldToScreen(seg.x, seg.y, camera, cw, ch);
    screenSegs.push({ x: s.x, y: s.y, idx: i });
  }

  // Draw body circles from tail to head
  for (let i = screenSegs.length - 1; i >= 0; i--) {
    const ss = screenSegs[i];
    const r = ss.idx === 0 ? headRadius : segRadius;
    ctx.fillStyle = ss.idx === 0 ? snake.headColor : snake.color;
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light highlight for depth
  if (segRadius > 3) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = screenSegs.length - 1; i >= 0; i--) {
      const ss = screenSegs[i];
      const r = ss.idx === 0 ? headRadius : segRadius;
      ctx.beginPath();
      ctx.arc(ss.x, ss.y - r * 0.2, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eyes (head is screenSegs[0] if idx=0 was visible)
  let headScreenX = 0;
  let headScreenY = 0;
  let headVisible = false;
  for (let i = 0; i < screenSegs.length; i++) {
    if (screenSegs[i].idx === 0) {
      headScreenX = screenSegs[i].x;
      headScreenY = screenSegs[i].y;
      headVisible = true;
      break;
    }
  }

  if (headVisible) {
    drawEyes(ctx, headScreenX, headScreenY, snake.angle, headRadius);

    // Boost speed lines
    if (snake.boosting && segRadius > 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 * zoom;
      for (let j = 0; j < 3; j++) {
        const a = snake.angle + Math.PI + (j - 1) * 0.3;
        const len = (15 + j * 5) * zoom;
        const sx = headScreenX - Math.cos(snake.angle) * headRadius;
        const sy = headScreenY - Math.sin(snake.angle) * headRadius;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    // Name label
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(snake.name, headScreenX, headScreenY - headRadius - 4 * zoom);
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

  // Length
  ctx.font = '13px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText(`Length: ${player.segments.length}`, p + 12, p + 10 + lh);

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
  ctx.fillText('Click or press any key to respawn', width / 2, height / 2 + 50);
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

  if (!player || !player.alive || !player.segments[0]) return;

  const scale = 0.02;
  const cx = mx + size / 2;
  const cy = my + size / 2;
  const px = player.segments[0].x;
  const py = player.segments[0].y;
  const halfSize = size / 2 - 4;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (const [, snake] of snakes) {
    if (!snake.alive || snake.isPlayer) continue;
    const head = snake.segments[0];
    if (!head) continue;
    const dx = (head.x - px) * scale;
    const dy = (head.y - py) * scale;
    if (Math.abs(dx) > halfSize || Math.abs(dy) > halfSize) continue;
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2);
  }

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}
