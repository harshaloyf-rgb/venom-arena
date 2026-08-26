// ============================================================================
// Venom Arena — Background Grid Renderer
// Draws subtle grid lines visible in the current viewport.
// ============================================================================

import type { CameraState } from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';

/**
 * Render the background grid.
 * Only draws lines within the visible viewport for performance.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  config: SnakeConfig,
  canvasW: number,
  canvasH: number,
): void {
  const gridSize = config.gridSize;
  const scaledGrid = gridSize * camera.zoom;

  // Don't draw if grid would be too dense or too sparse
  if (scaledGrid < 8 || scaledGrid > 200) return;

  // Calculate visible world bounds
  const halfW = canvasW / 2 / camera.zoom;
  const halfH = canvasH / 2 / camera.zoom;
  const left = camera.x - halfW;
  const right = camera.x + halfW;
  const top = camera.y - halfH;
  const bottom = camera.y + halfH;

  // Snap to grid
  const startX = Math.floor(left / gridSize) * gridSize;
  const startY = Math.floor(top / gridSize) * gridSize;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;

  // Vertical lines
  ctx.beginPath();
  for (let wx = startX; wx <= right; wx += gridSize) {
    const sx = (wx - camera.x) * camera.zoom + canvasW / 2;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvasH);
  }
  ctx.stroke();

  // Horizontal lines
  ctx.beginPath();
  for (let wy = startY; wy <= bottom; wy += gridSize) {
    const sy = (wy - camera.y) * camera.zoom + canvasH / 2;
    ctx.moveTo(0, sy);
    ctx.lineTo(canvasW, sy);
  }
  ctx.stroke();

  ctx.restore();
}