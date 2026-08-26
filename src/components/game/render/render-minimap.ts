// ============================================================================
// Venom Arena — Minimap Renderer (Circular Radar)
// Shows nearby snake positions, food density, and camera viewport.
// ============================================================================

import type { SnakeState, CameraState, FoodOrb } from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';

/**
 * Render a circular minimap in the bottom-right corner.
 * Only shows nearby snakes (within viewport + margin) for performance.
 */
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  snakes: SnakeState[],
  player: SnakeState | null,
  map: { center: { x: number; y: number }; currentRadius: number; type: string },
  canvasW: number,
  canvasH: number,
  config: SnakeConfig,
  food?: FoodOrb[],
): void {
  const mapRadius = config.mapRadius;
  const minimapRadius = Math.min(canvasW, canvasH) * 0.14;
  const minimapRadiusClamped = Math.max(40, minimapRadius);

  // Position: bottom-right, with padding
  const padding = 12;
  const cx = canvasW - padding - minimapRadiusClamped;
  const cy = canvasH - padding - minimapRadiusClamped;

  ctx.save();

  // ── Semi-transparent background circle ─────────────────────────────
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, minimapRadiusClamped, 0, Math.PI * 2);
  ctx.fill();

  // ── Map boundary (online) ──────────────────────────────────────────
  if (map.type === 'circular_breathing' && map.currentRadius < Infinity) {
    const boundaryScale = minimapRadiusClamped / map.currentRadius;
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, minimapRadiusClamped, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Border ──────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, minimapRadiusClamped, 0, Math.PI * 2);
  ctx.stroke();

  // ── Scale factor: map coords → minimap pixels ─────────────────────
  const scale = minimapRadiusClamped / mapRadius;

  // ── Food dots (sparse — sample every 20th food for performance) ───
  if (food && food.length > 0) {
    ctx.fillStyle = 'rgba(100, 255, 100, 0.15)';
    const step = Math.max(1, Math.floor(food.length / 40)); // max 40 dots
    for (let i = 0; i < food.length; i += step) {
      const f = food[i];
      const dx = (f.x - map.center.x) * scale;
      const dy = (f.y - map.center.y) * scale;
      if (dx * dx + dy * dy > minimapRadiusClamped * minimapRadiusClamped) continue;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Draw nearby snakes as dots ─────────────────────────────────────
  // Only render snakes within viewport + margin for performance
  const viewHalfW = (canvasW / 2) * scale * 1.5;
  const viewHalfH = (canvasH / 2) * scale * 1.5;
  const playerDx = player ? (player.head.x - map.center.x) * scale : 0;
  const playerDy = player ? (player.head.y - map.center.y) * scale : 0;

  for (const snake of snakes) {
    if (!snake.alive) continue;

    const dx = (snake.head.x - map.center.x) * scale;
    const dy = (snake.head.y - map.center.y) * scale;

    // Clamp within circle
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > minimapRadiusClamped - 2) continue;

    // Only show if within viewport area (player is always shown)
    if (!snake.identity.isPlayer) {
      const relX = Math.abs(dx - playerDx);
      const relY = Math.abs(dy - playerDy);
      if (relX > viewHalfW || relY > viewHalfH) continue;
    }

    if (snake.identity.isPlayer) {
      // Player: bright dot, larger
      ctx.fillStyle = '#00FF88';
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Other snakes: smaller dots
      ctx.fillStyle = snake.identity.isBot ? 'rgba(255,255,255,0.25)' : 'rgba(255,200,50,0.6)';
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Camera viewport rectangle ──────────────────────────────────────
  if (player) {
    const vpHalfW = (canvasW / 2) * scale;
    const vpHalfH = (canvasH / 2) * scale;

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cx + playerDx - vpHalfW,
      cy + playerDy - vpHalfH,
      vpHalfW * 2,
      vpHalfH * 2,
    );
  }

  ctx.restore();
}
