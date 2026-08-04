// ============================================================================
// Renderer — Pure Canvas API rendering functions. No React dependencies.
// Migrated from Vec2[] segments to PathBuffer (zero-alloc getX/getY access).
// ============================================================================

import type { Camera, FoodOrb, GameState, Snake, StarChip, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS, START_LENGTH, GROWTH_RATE, MAX_SNAKE_LENGTH, BASE_SPEED } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';

// ── Inner curl (corner-cutting) visual offset ─────────────────────────
// How many pixels to shift a segment toward the center of curvature
// per radian of local turn angle. Higher = tighter inner curl.
const CURL_CUT_FACTOR = 6.0;

/**
 * Compute the inner curl offset for a body segment at index i.
 * Returns [offsetX, offsetY] to ADD to the base path position.
 * This is purely visual — computed fresh each frame, never stored.
 */
function innerCurlOffset(
  path: { getX: (i: number) => number; getY: (i: number) => number; length: number },
  i: number,
): [number, number] {
  const len = path.length;
  if (len < 3 || i < 1) return [0, 0];

  // Three points: ahead (i-1), current (i), behind (i+1)
  const ax = path.getX(i - 1);
  const ay = path.getY(i - 1);
  const cx = path.getX(i);
  const cy = path.getY(i);

  let bx: number, by: number;
  if (i < len - 1) {
    bx = path.getX(i + 1);
    by = path.getY(i + 1);
  } else {
    const dx = cx - ax;
    const dy = cy - ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.01) return [0, 0];
    bx = cx + (dx / d) * BASE_SPEED;
    by = cy + (dy / d) * BASE_SPEED;
  }

  const v1x = cx - bx;
  const v1y = cy - by;
  const v2x = ax - cx;
  const v2y = ay - cy;

  const cross = v1x * v2y - v1y * v2x;
  if (Math.abs(cross) < 0.001) return [0, 0];

  const dot = v1x * v2x + v1y * v2y;
  const turnAngle = Math.atan2(Math.abs(cross), dot);

  const travelX = ax - bx;
  const travelY = ay - by;
  const travelLen = Math.sqrt(travelX * travelX + travelY * travelY);
  if (travelLen < 0.01) return [0, 0];

  const invLen = 1 / travelLen;
  let normX: number, normY: number;
  if (cross > 0) {
    normX = -travelY * invLen;
    normY = travelX * invLen;
  } else {
    normX = travelY * invLen;
    normY = -travelX * invLen;
  }

  const offset = turnAngle * CURL_CUT_FACTOR;
  return [normX * offset, normY * offset];
}

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
// Snakes
// ==========================================================================

function drawSnake(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  now: number,
): void {
  const pathLen = snake.path.length;
  if (pathLen === 0) return;

  // ── HEAD-LEVEL CULLING: skip entire snake if head is far off-screen ──
  const headWorldX = snake.path.headX;
  const headWorldY = snake.path.headY;
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

  // ── Batched body draw with inner curl (corner-cutting) ──
  // Inner curl is a purely visual offset computed fresh each frame.
  // On curves, body segments shift toward the center of curvature,
  // making the body follow a tighter arc than the head's path.
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  let hasBodySegs = false;

  for (let i = pathLen - 1; i >= 1; i--) {
    const [ox, oy] = innerCurlOffset(snake.path, i);
    const wx = snake.path.getX(i) + ox;
    const wy = snake.path.getY(i) + oy;
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
    const s = worldToScreen(wx, wy, camera, cw, ch);
    ctx.moveTo(s.x + segRadius, s.y);
    ctx.arc(s.x, s.y, segRadius, 0, Math.PI * 2);
    hasBodySegs = true;
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
        const sx = headScreen.x - Math.cos(snake.angle) * headRadius;
        const sy = headScreen.y - Math.sin(snake.angle) * headRadius;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
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
