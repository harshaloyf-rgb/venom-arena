// ============================================================================
// Venom Arena — Star Chip Renderer
// Golden pulsing 5-point star with animated glow.
// ============================================================================

import type { StarChip, CameraState } from '@/lib/snake/types';
import { worldToScreen, isOnScreen } from './camera';

/**
 * Render a single star chip as a golden pulsing 5-point star.
 * Uses phaseOffset for unique animation timing per star.
 */
export function renderStar(
  ctx: CanvasRenderingContext2D,
  star: StarChip,
  time: number,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  const baseRadius = 10;
  if (!isOnScreen(star.x, star.y, baseRadius * 2, camera, canvasW, canvasH)) {
    return;
  }

  const screen = worldToScreen(star.x, star.y, camera, canvasW, canvasH);
  const phase = time * 2.5 + star.phaseOffset;
  const pulse = 0.85 + Math.sin(phase) * 0.15;
  const r = Math.max(1, baseRadius * camera.zoom * pulse);
  const innerR = r * 0.45;

  // Glow pulsing
  const glowPulse = 0.6 + Math.sin(phase * 1.3) * 0.3;

  ctx.save();

  // Outer glow
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 14 * glowPulse * camera.zoom;
  ctx.globalAlpha = 0.7 * glowPulse;

  // Draw 5-point star
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : innerR;
    const px = screen.x + Math.cos(a) * rad;
    const py = screen.y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // Bright center
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Value text (chip amount)
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#1a1a2e';
  ctx.font = `bold ${Math.max(8, Math.round(r * 0.6))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(star.value), screen.x, screen.y);

  ctx.restore();
}

/**
 * Render multiple star chips.
 */
export function renderStars(
  ctx: CanvasRenderingContext2D,
  stars: StarChip[],
  time: number,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  for (let i = 0; i < stars.length; i++) {
    renderStar(ctx, stars[i], time, camera, canvasW, canvasH);
  }
}
