/**
 * Venom Arena — chip labels + particles overlay rendering.
 */

import type { FrameRenderCtx, Particle } from './types';
import { formatChipDisplay } from './render-grid';

// ---------------------------------------------------------------------------
// Chip label above snake head
// ---------------------------------------------------------------------------

/**
 * Draws a chip count label above the snake's head. Uses Indian numbering
 * (K, L, Cr). Only meaningful for real players (bots have 0 carriedChips).
 *
 * Rendered as a semi-transparent pill with white text, positioned centered
 * above the head.
 */
export function drawChipLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  chips: number,
  snakeSize: number,
  zoom: number,
): void {
  if (chips <= 0) return; // bots have 0 chips, skip them

  const label = formatChipDisplay(chips);
  const fontSize = Math.max(9, 10 / zoom);
  const offset = snakeSize + 12 / zoom;

  ctx.save();
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(label);
  const padX = 5 / zoom;
  const padY = 2 / zoom;
  const tw = metrics.width + padX * 2;
  const th = fontSize + padY * 2;
  const rx = x - tw / 2;
  const ry = y - offset - th;
  const rr = 4 / zoom;

  // Background pill
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry);
  ctx.lineTo(rx + tw - rr, ry);
  ctx.arcTo(rx + tw, ry, rx + tw, ry + rr, rr);
  ctx.lineTo(rx + tw, ry + th - rr);
  ctx.arcTo(rx + tw, ry + th, rx + tw - rr, ry + th, rr);
  ctx.lineTo(rx + rr, ry + th);
  ctx.arcTo(rx, ry + th, rx, ry + th - rr, rr);
  ctx.lineTo(rx, ry + rr);
  ctx.arcTo(rx, ry, rx + rr, ry, rr);
  ctx.closePath();
  ctx.fill();

  // Gold accent border
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, ry + th / 2);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------

/** Draws the particle array (caller caps at MAX_PARTICLES = 200). */
export function drawParticles(rc: FrameRenderCtx, particles: Particle[]): void {
  if (particles.length === 0) return;
  const { ctx, zoom } = rc;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.life <= 0) continue;
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
