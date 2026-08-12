import type { GameState, Camera, Viewport, Snake } from '@/lib/snake/types';
import { drawGrid, drawFood } from './renderer';
import { cleanupSnakeParticles, clearSmoothedSegs } from './render-snake-atlas';
import { InputHandler } from './input';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAP_SIZE = 120;
const MAP_PAD = 12;
const DANGER_RANGE_SQ = 2000 * 2000;

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
// Minimap: top-left position
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

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.fill();

  // Clip to minimap area
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, size, size, 6);
  ctx.clip();

  const cx = mx + size / 2;
  const cy = my + size / 2;
  const scale = (size / 2 - 4) / mapHalf;

  // Arena boundary circle (pulsing — red when shrinking)
  const shrinkPct = 1 - boundaryR / mapHalf;
  const bAlpha = 0.15 + shrinkPct * 1.5; // brighter as it shrinks
  ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(bAlpha, 0.8).toFixed(2)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, boundaryR * scale, 0, Math.PI * 2);
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

  // Draw all other snakes as small white dots
  for (const [, snake] of state.snakes) {
    if (!snake.alive || snake.isPlayer || snake.path.length === 0) continue;
    const sx = cx + snake.path.headX * scale;
    const sy = cy + snake.path.headY * scale;

    // Danger: bigger snake within 2000px
    const dx = snake.path.headX - playerX;
    const dy = snake.path.headY - playerY;
    const isDanger = snake.score > playerScore && (dx * dx + dy * dy) < DANGER_RANGE_SQ;

    if (isDanger) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isDanger ? '#ef4444' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(sx - 1, sy - 1, 2, 2);
  }

  // Player dot (green, larger)
  const px = cx + playerX * scale;
  const py = cy + playerY * scale;
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

  ctx.restore();

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
