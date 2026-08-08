import type { GameState, Camera, Viewport, Snake } from '@/lib/snake/types';
import { drawGrid, drawFood } from './renderer';
import { cleanupSnakeParticles, clearSmoothedSegs } from './render-snake-atlas';
import { InputHandler } from './input';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAP_SIZE = 120;
const MAP_PAD = 12;

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
  drawMinimapTopLeft(ctx, state.snakes, state.player, cw, ch);

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

export function drawMinimapTopLeft(
  ctx: CanvasRenderingContext2D,
  snakes: Map<string, Snake>,
  player: Snake | null,
  cw: number,
  _ch: number,
): void {
  const size = MAP_SIZE;
  const pad = MAP_PAD;
  const mx = pad;
  const my = pad;

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
