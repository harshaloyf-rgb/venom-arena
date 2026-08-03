/**
 * Venom Arena — grid + world-bounds + utility rendering.
 */

import type { FrameRenderCtx, VisibleRect } from './types';
import {
  MAP_BASE_RADIUS,
  MAP_BREATH_AMPLITUDE,
  MAP_BREATH_CYCLE_MS,
  WORLD_SIZE,
} from '@/lib/game-config';

// ---------------------------------------------------------------------------
// Pure utility helpers
// ---------------------------------------------------------------------------

/** Returns the world-space rectangle visible in the viewport, plus margin. */
export function computeVisibleRect(rc: FrameRenderCtx, marginPx = 100): VisibleRect {
  const halfW = rc.w / 2 / rc.zoom;
  const halfH = rc.h / 2 / rc.zoom;
  const m = marginPx / rc.zoom;
  return {
    left: rc.camX - halfW - m,
    right: rc.camX + halfW + m,
    top: rc.camY - halfH - m,
    bottom: rc.camY + halfH + m,
  };
}

/** Quick AABB-vs-rect test. */
export function rectContainsPoint(rect: VisibleRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Returns true if any point in the list is inside the visible rect. */
export function snakeIsVisible(pts: { x: number; y: number }[], rect: VisibleRect): boolean {
  if (pts.length === 0) return false;
  if (rectContainsPoint(rect, pts[0].x, pts[0].y)) return true;
  const last = pts[pts.length - 1];
  if (rectContainsPoint(rect, last.x, last.y)) return true;
  const stride = pts.length > 60 ? 4 : 2;
  for (let i = 0; i < pts.length; i += stride) {
    if (rectContainsPoint(rect, pts[i].x, pts[i].y)) return true;
  }
  return false;
}

/**
 * Breathing arena radius at a given time. Matches the server's
 * `getMapRadius(elapsedMs)` formula exactly:
 *   baseRadius + sin(cycleProgress * 2π) * amplitude
 */
export function getArenaRadius(now: number): number {
  const cycleTime = (now % MAP_BREATH_CYCLE_MS) / MAP_BREATH_CYCLE_MS;
  const sinVal = Math.sin(cycleTime * Math.PI * 2);
  return MAP_BASE_RADIUS + sinVal * MAP_BREATH_AMPLITUDE;
}

// ---------------------------------------------------------------------------
// Indian number formatting for chip display
// ---------------------------------------------------------------------------

/**
 * Formats a chip count using Indian numbering system.
 *  - Under 1000: plain number (e.g. "500")
 *  - 1K to 99K: "1.5K", "25K"
 *  - 1L (1,00,000) to 99L: "1L", "50L"
 *  - 1Cr (1,00,00,000)+: "1.2Cr", "15Cr"
 */
export function formatChipDisplay(chips: number): string {
  if (chips < 1000) return String(chips);
  if (chips < 100_000) {
    // K range: 1K to 99.9K
    const k = chips / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  if (chips < 10_000_000) {
    // L (lakh) range: 1L to 99.9L
    const l = chips / 100_000;
    return l % 1 === 0 ? `${l}L` : `${l.toFixed(1).replace(/\.0$/, '')}L`;
  }
  // Cr (crore) range
  const cr = chips / 10_000_000;
  return cr % 1 === 0 ? `${cr}Cr` : `${cr.toFixed(1).replace(/\.0$/, '')}Cr`;
}

// ---------------------------------------------------------------------------
// Grid + world bounds
// ---------------------------------------------------------------------------

/**
 * Draws the breathing circular arena: background fill (deep slate `#020617`)
 * clipped to the circle, a subtle grid (`#1e293b`, gridSize 60) inside the
 * circle, and the neon-rose boundary (`#f43f5e`, lineWidth 10, shadowBlur 16).
 *
 * The radius breathes using the same sinusoidal formula as the server.
 */
export function drawGrid(rc: FrameRenderCtx): void {
  const { ctx, worldSize, camX, camY, zoom, w, h } = rc;
  const cx = worldSize / 2;
  const cy = worldSize / 2;
  const radius = getArenaRadius(rc.now);

  // --- Background fill (entire arena disc) ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#020617';
  ctx.fill();
  ctx.clip();

  // --- Grid lines (subtle slate-800, gridSize 60) ---
  const grid = 60;
  const vis = computeVisibleRect(rc);
  const startX = Math.max(0, Math.floor(vis.left / grid) * grid);
  const endX = Math.min(worldSize, Math.ceil(vis.right / grid) * grid);
  const startY = Math.max(0, Math.floor(vis.top / grid) * grid);
  const endY = Math.min(worldSize, Math.ceil(vis.bottom / grid) * grid);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += grid) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += grid) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
  ctx.restore(); // remove clip

  // --- Outer boundary (neon rose, breathing) ---
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#f43f5e';
  if (!rc.lowQuality) {
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 16;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Silence unused-param lint for camX/camY/w/h.
  void camX;
  void camY;
  void w;
  void h;
}

// ---------------------------------------------------------------------------
// Dynamic map boundary (for online games with dynamic radius)
// ---------------------------------------------------------------------------

/**
 * Draws a circular map boundary with neon-rose glow and a subtle breathing
 * pulse. Used for online arenas where `mapRadius` comes from the GameSnapshot
 * rather than the fixed breathing formula.
 */
export function drawMapBoundary(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  tick: number,
): void {
  // Subtle breathing pulse: ±3px oscillation over a 4-second cycle
  const breathe = Math.sin(tick * 0.0015) * 3;
  const r = Math.max(100, radius + breathe);

  ctx.save();
  // Outer glow
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#f43f5e';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner subtle glow ring
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, r - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();
}
