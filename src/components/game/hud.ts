import type { GameState, Camera, Viewport, Snake } from '@/lib/snake/types';
import { drawGrid, drawFood } from './renderer';
import { cleanupSnakeParticles, clearSmoothedSegs } from './render-snake-atlas';
import { InputHandler } from './input';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAP_SIZE = 120;
const MAP_PAD = 12;
const DANGER_RANGE_SQ = 2000 * 2000;

// Minimap zoom: 4 levels — click the Z button to cycle
const ZOOM_LABELS = ['RADAR', 'CLOSE', 'WIDE', 'FULL'] as const;
const ZOOM_RADII = [0, 0.25, 0.5, 1.0] as const; // fraction of mapHalf
const ZOOM_LERP = 0.12; // smooth transition speed per frame
const LABEL_FADE_MS = 1500; // label visible duration

// ─── Minimap Zoom State (module-level, persists across frames) ─────────────

let minimapZoomLevel = 3; // start at FULL
let minimapCurrentRadius = 1.0; // animated fraction of mapHalf (starts at full)
let minimapLabelTime = 0;
let minimapLabelText = 'FULL';

/** Reset minimap zoom when starting a new game */
export function resetMinimapZoom(): void {
  minimapZoomLevel = 3;
  minimapCurrentRadius = 1.0;
  minimapLabelTime = 0;
  minimapLabelText = 'FULL';
}

/** Check if a canvas click hits the minimap zoom button. Returns true if consumed. */
export function handleMinimapClick(canvasX: number, canvasY: number): boolean {
  const mx = MAP_PAD;
  const my = MAP_PAD;
  // Zoom button: 22x16 box at bottom-right of minimap
  const btnX = mx + MAP_SIZE - 24;
  const btnY = my + MAP_SIZE - 20;
  const btnW = 22;
  const btnH = 16;
  if (canvasX >= btnX && canvasX <= btnX + btnW && canvasY >= btnY && canvasY <= btnY + btnH) {
    minimapZoomLevel = (minimapZoomLevel + 1) % 4;
    minimapLabelTime = performance.now();
    minimapLabelText = ZOOM_LABELS[minimapZoomLevel];
    return true;
  }
  return false;
}

// ============================================================================
// Cleanup dead snake particles
// ============================================================================

export function cleanupDeadSnakeParticles(snakeId: string): void {
  cleanupSnakeParticles(snakeId);
  clearSmoothedSegs(snakeId);
}

// ============================================================================
// Render background (grid, food)
// ============================================================================

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  _fps: number,
  _now: number,
): void {
  const { width, height } = viewport;

  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);

  // Grid
  drawGrid(ctx, camera, viewport);

  // Food
  drawFood(ctx, state.foods, camera, viewport);

  // Arena boundary wall — visible glowing red ring at map edge
  drawArenaBoundary(ctx, state, camera, viewport);
}

// ============================================================================
// Render HUD (minimap top-left, score bottom-center, kills bottom-right)
// ============================================================================

export function renderHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
  _fps: number,
  _now: number,
  kills: number,
  _highScore: number,
): void {
  if (!state.player) return;
  const cw = viewport.width;
  const ch = viewport.height;

  // ── Minimap: top-left ──
  drawMinimapTopLeft(ctx, state, cw, ch);

  // ── Rank below minimap ──
  const aliveSnakes = state.snakes.size;
  let rank = 1;
  for (const [, s] of state.snakes) {
    if (s.alive && s.score > state.player.score) rank++;
  }
  const rankY = MAP_PAD + MAP_SIZE + 6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(MAP_PAD, rankY, MAP_SIZE, 24, 6);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '9px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Rank ${rank} / ${aliveSnakes}`, MAP_PAD + MAP_SIZE / 2, rankY + 12);

  // ── Score: bottom-center ──
  const scoreVal = Math.floor(state.player.score);
  const scoreText = `Score ${scoreVal.toLocaleString()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  const tw = ctx.measureText(scoreText).width;
  const boxW = Math.max(tw + 28, 120);
  ctx.beginPath();
  ctx.roundRect(cw / 2 - boxW / 2, ch - 44, boxW, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(scoreText, cw / 2, ch - 18);

  // ── Kills: bottom-right ──
  const krPad = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.roundRect(cw - krPad - 100, ch - krPad - 34, 100, 28, 6);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '9px monospace';
  ctx.fillStyle = '#a0a0a0';
  ctx.fillText('Kills', cw - krPad - 52, ch - krPad - 20);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(String(kills), cw - krPad - 10, ch - krPad - 20);
}

// ============================================================================
// Minimap: top-left with 4-level zoom
// ============================================================================

function drawMinimapTopLeft(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  _cw: number,
  _ch: number,
): void {
  const size = MAP_SIZE;
  const pad = MAP_PAD;
  const mx = pad;
  const my = pad;
  const player = state.player;
  const mapHalf = state.arenaConfig.mapHalf;
  const boundaryR = state.boundaryRadius;

  // ── Smooth zoom animation ──
  const targetRadius = ZOOM_RADII[minimapZoomLevel];
  minimapCurrentRadius += (targetRadius - minimapCurrentRadius) * ZOOM_LERP;
  // Snap if close enough
  if (Math.abs(minimapCurrentRadius - targetRadius) < 0.002) {
    minimapCurrentRadius = targetRadius;
  }

  const isPlayerCentered = minimapZoomLevel <= 1; // radar & close center on player

  // Visible world radius in pixels at current zoom
  const visibleWorldRadius = mapHalf * minimapCurrentRadius;
  // Scale: pixels per world-unit, fitting visible radius into minimap
  const scale = (size / 2 - 4) / visibleWorldRadius;

  // Center of the minimap view in world coordinates
  let viewCenterX = 0;
  let viewCenterY = 0;
  if (isPlayerCentered && player && player.alive) {
    viewCenterX = player.path.headX;
    viewCenterY = player.path.headY;
  }

  // Screen center of minimap
  const cx = mx + size / 2;
  const cy = my + size / 2;

  // Convert world→minimap screen coordinates
  const toMiniX = (wx: number) => cx + (wx - viewCenterX) * scale;
  const toMiniY = (wy: number) => cy + (wy - viewCenterY) * scale;

  // ── Background ──
  // Glow border when zoomed in (not full map)
  const zoomGlow = minimapCurrentRadius < 0.95 ? (1 - minimapCurrentRadius) * 0.5 : 0;
  if (zoomGlow > 0) {
    ctx.strokeStyle = `rgba(59, 130, 246, ${zoomGlow.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mx - 1, my - 1, size + 2, size + 2, 7);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.fill();

  // Clip to minimap area
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.clip();

  // ── Boundary circle ──
  const shrinkPct = 1 - boundaryR / mapHalf;
  const bAlpha = 0.15 + shrinkPct * 1.5;
  ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(bAlpha, 0.8).toFixed(2)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(toMiniX(0), toMiniY(0), boundaryR * scale, 0, Math.PI * 2);
  ctx.stroke();

  if (!player || !player.alive || player.path.length === 0) {
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, size, size, 6);
    ctx.stroke();
    return;
  }

  const playerX = player.path.headX;
  const playerY = player.path.headY;
  const playerScore = player.score;

  // ── Draw snakes ──
  // At radar zoom, only draw snakes within a reasonable range for perf
  const radarCullSq = minimapCurrentRadius < 0.3 ? (visibleWorldRadius + 500) ** 2 : Infinity;

  for (const [, snake] of state.snakes) {
    if (!snake.alive || snake.isPlayer || snake.path.length === 0) continue;
    const sx = snake.path.headX;
    const sy = snake.path.headY;

    // Perf cull for radar mode
    if (radarCullSq !== Infinity) {
      const cdx = sx - viewCenterX;
      const cdy = sy - viewCenterY;
      if (cdx * cdx + cdy * cdy > radarCullSq) continue;
    }

    const miniSx = toMiniX(sx);
    const miniSy = toMiniY(sy);

    // Skip if outside minimap bounds (can happen when player-centered)
    if (miniSx < mx - 5 || miniSx > mx + size + 5 || miniSy < my - 5 || miniSy > my + size + 5) continue;

    // Danger: bigger snake within 2000px
    const dx = sx - playerX;
    const dy = sy - playerY;
    const isDanger = snake.score > playerScore && (dx * dx + dy * dy) < DANGER_RANGE_SQ;

    if (isDanger) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.beginPath();
      ctx.arc(miniSx, miniSy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isDanger ? '#ef4444' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(miniSx - 1, miniSy - 1, 2, 2);
  }

  // ── Player dot (green, larger) ──
  const px = toMiniX(playerX);
  const py = toMiniY(playerY);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(px, py, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Direction line
   const dirLen = 7;
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(player.angle) * dirLen, py + Math.sin(player.angle) * dirLen);
  ctx.stroke();

  // ── Zoom button (bottom-right corner of minimap) ──
  const btnW = 22;
  const btnH = 16;
  const btnX = mx + size - btnW - 3;
  const btnY = my + size - btnH - 3;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 3);
  ctx.fill();

  // Zoom level indicator: 1-4 small bars
  const barCount = minimapZoomLevel + 1;
  const barW = 3;
  const barGap = 1.5;
  const barsW = barCount * barW + (barCount - 1) * barGap;
  const barsX = btnX + (btnW - barsW) / 2;
  const barsY = btnY + btnH / 2;
  for (let i = 0; i < 4; i++) {
    const barH = 3 + i * 2; // increasing height: 3, 5, 7, 9
    const bx = barsX + i * (barW + barGap);
    ctx.fillStyle = i < barCount ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(bx, barsY - barH / 2, barW, barH);
  }

  ctx.restore();

  // ── Zoom label (fades out) ──
  if (minimapLabelTime > 0) {
    const elapsed = performance.now() - minimapLabelTime;
    if (elapsed < LABEL_FADE_MS) {
      const alpha = 1 - elapsed / LABEL_FADE_MS;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.font = 'bold 10px monospace';
      const labelW = ctx.measureText(minimapLabelText).width + 16;
      const labelX = mx + (size - labelW) / 2;
      const labelY = my + size / 2 - 8;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(minimapLabelText, mx + size / 2, labelY + 10);
      ctx.restore();
    }
  }

  // Border (outside clip)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.stroke();
}

// ============================================================================
// Arena boundary wall — glowing red ring visible in-game at map edge
// ============================================================================

function drawArenaBoundary(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  viewport: Viewport,
): void {
  const mapRadius = state.boundaryRadius;
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const sx = cw / 2 - camera.x * zoom;
  const sy = ch / 2 - camera.y * zoom;
  const screenRadius = mapRadius * zoom;

  // Cull: skip if the entire boundary is off-screen
  if (sx + screenRadius < -50 || sx - screenRadius > cw + 50 ||
      sy + screenRadius < -50 || sy - screenRadius > ch + 50) return;

  // Outer glow (thick, faint)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
  ctx.lineWidth = 60 * zoom;
  ctx.beginPath();
  ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Mid glow
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.lineWidth = 20 * zoom;
  ctx.beginPath();
  ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Core wall line (bright, thin)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 3 * zoom;
  ctx.beginPath();
  ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
}

// ============================================================================
// Mouse cursor indicator (slither.io style — subtle crosshair)
// ============================================================================

export function drawMouseCursor(
  ctx: CanvasRenderingContext2D,
  input: InputHandler,
): void {
  const pos = input.getMousePos();
  if (!pos) return;

  const r = 6;
  const alpha = 0.5;

  // Outer ring
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
   ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
