// ============================================================================
// Venom Arena — Minimap Renderer (Circular Radar)
// Shows all snake positions as dots, player highlighted.
// ============================================================================

import type { SnakeState, CameraState } from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';

/**
 * Render a circular minimap in the bottom-right corner.
 */
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  snakes: SnakeState[],
  player: SnakeState | null,
  map: { center: { x: number; y: number }; currentRadius: number },
  canvasW: number,
  canvasH: number,
  config: SnakeConfig,
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy, minimapRadiusClamped, 0, Math.PI * 2);
  ctx.fill();

  // ── Border ──────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, minimapRadiusClamped, 0, Math.PI * 2);
  ctx.stroke();

  // ── Scale factor: map coords → minimap pixels ─────────────────────
  const scale = minimapRadiusClamped / mapRadius;

  // ── Draw snakes as dots ─────────────────────────────────────────────
  for (const snake of snakes) {
    if (!snake.alive) continue;

    const dx = (snake.head.x - map.center.x) * scale;
    const dy = (snake.head.y - map.center.y) * scale;

    // Clamp within circle
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > minimapRadiusClamped - 2) continue;

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
    const camDx = (player.head.x - map.center.x) * scale;
    const camDy = (player.head.y - map.center.y) * scale;

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      cx + camDx - vpHalfW,
      cy + camDy - vpHalfH,
      vpHalfW * 2,
      vpHalfH * 2,
    );
  }

  ctx.restore();
}