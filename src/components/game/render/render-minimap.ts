/**
 * Venom Arena — minimap (radar) + full-map overlay rendering.
 */

import type { MinimapArgs, FullMapArgs } from './types';
import { WORLD_SIZE } from '@/lib/game-config';

// ---------------------------------------------------------------------------
// Minimap (drawn in screen-space, no camera transform)
// ---------------------------------------------------------------------------

/**
 * Draws the circular radar minimap. Player is rendered as an indigo dot at
 * the centre (the radar is centered on the player's head). The arena
 * boundary is a dashed rose circle. Bots render as rose dots, other real
 * players as emerald dots — matches AUDIT-A radar visual language.
 */
export function drawMinimap(args: MinimapArgs): void {
  const { ctx, x, y, size, worldSize, arenaRadius, snakes, myId } = args;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  const radarRange = args.range ?? WORLD_SIZE / 2;
  const scale = r / radarRange;

  ctx.save();
  // Background circle (radar disc)
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Clip to minimap circle.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Concentric rings.
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  for (const inset of [2, 5, 8]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - inset, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshairs.
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx, y + size);
  ctx.moveTo(x, cy);
  ctx.lineTo(x + size, cy);
  ctx.stroke();

  // Arena boundary (dashed rose) — centered on world center.
  const mySnake = snakes.find((s) => s.id === myId);
  const myHead = mySnake?.points?.[0];
  const px = myHead ? myHead.x : worldSize / 2;
  const py = myHead ? myHead.y : worldSize / 2;
  const worldCenterOffsetX = (worldSize / 2 - px) * scale;
  const worldCenterOffsetY = (worldSize / 2 - py) * scale;
  const arenaR = arenaRadius * scale;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx + worldCenterOffsetX, cy + worldCenterOffsetY, arenaR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Snakes (player centered → drawn at centre; others offset).
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    if (!s.points || s.points.length === 0) continue;
    const head = s.points[0];
    const dx = (head.x - px) * scale;
    const dy = (head.y - py) * scale;
    const dist = Math.hypot(dx, dy);
    if (dist > r) continue;
    const mx = cx + dx;
    const my = cy + dy;
    ctx.beginPath();
    if (s.id === myId) {
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#818cf8'; // indigo-400
    } else if (s.isBot) {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e'; // rose-500
    } else {
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399'; // emerald-400
    }
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Full Map overlay — drawn in screen-space, no camera transform.
// Press `M` to toggle. Shows the ENTIRE arena with all snakes as dots.
// ---------------------------------------------------------------------------

/**
 * Draws a full-screen overlay of the entire arena. The arena circle is
 * centered on screen and scaled to fit the smaller of (w, h) with padding.
 * All snakes are rendered as dots — player = indigo (larger), bots = rose,
 * other real humans = emerald. A "Press M to close" hint is drawn at the
 * bottom. The player's own dot pulses with a ring.
 */
export function drawFullMap(args: FullMapArgs): void {
  const { ctx, w, h, worldSize, arenaRadius, snakes, myId } = args;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- Background fill (dim slate) ---
  ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
  ctx.fillRect(0, 0, w, h);

  // --- Layout: arena centred on screen ---
  const cx = w / 2;
  const cy = h / 2;
  const margin = 80;
  const fitDim = Math.min(w, h) - margin * 2;
  const arenaDiameter = arenaRadius * 2;
  const scale = fitDim / arenaDiameter;
  const screenR = arenaRadius * scale;

  const wcx = worldSize / 2;
  const wcy = worldSize / 2;
  const toScreenX = (wx: number) => cx + (wx - wcx) * scale;
  const toScreenY = (wy: number) => cy + (wy - wcy) * scale;

  // --- Concentric range rings (faint) ---
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  for (const frac of [0.25, 0.5, 0.75]) {
    ctx.beginPath();
    ctx.arc(cx, cy, screenR * frac, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Crosshairs.
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - screenR);
  ctx.lineTo(cx, cy + screenR);
  ctx.moveTo(cx - screenR, cy);
  ctx.lineTo(cx + screenR, cy);
  ctx.stroke();

  // --- Arena boundary (dashed rose) ---
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // --- Snakes ---
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    if (!s.points || s.points.length === 0) continue;
    const head = s.points[0];
    const sx = toScreenX(head.x);
    const sy = toScreenY(head.y);
    ctx.beginPath();
    if (s.id === myId) {
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#818cf8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.isBot) {
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f43f5e';
      ctx.fill();
    } else {
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399';
      ctx.fill();
    }
  }

  // --- Title + close hint ---
  ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('ARENA OVERVIEW — ALL SNAKES', cx, 16);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '11px monospace';
  ctx.fillText('Press M to close', cx, h - 24);

  // Legend (top-left).
  ctx.textAlign = 'left';
  ctx.font = '11px monospace';
  const legendX = 20;
  let legendY = 20;
  const drawLegend = (color: string, label: string, dotR: number) => {
    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 6, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.fillText(label, legendX + 18, legendY);
    legendY += 18;
  };
  drawLegend('#818cf8', 'You', 5);
  drawLegend('#34d399', 'Real Players', 3);
  drawLegend('#f43f5e', 'Bots', 2.5);

  ctx.restore();
}
