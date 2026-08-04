// ============================================================================
// Venom Arena — Map Boundary Renderer
// Circular breathing boundary with red danger zone near edge.
// ============================================================================

import type { MapState, CameraState } from '@/lib/snake/types';
import { worldToScreen } from './camera';

/**
 * Render the map boundary as a dashed circle.
 * Red danger zone near the edge.
 */
export function renderMapBoundary(
  ctx: CanvasRenderingContext2D,
  map: MapState,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  const center = worldToScreen(map.center.x, map.center.y, camera, canvasW, canvasH);
  const screenRadius = map.currentRadius * camera.zoom;

  // Don't render if the entire boundary is off screen
  if (
    center.x + screenRadius < 0 ||
    center.x - screenRadius > canvasW ||
    center.y + screenRadius < 0 ||
    center.y - screenRadius > canvasH
  ) {
    return;
  }

  ctx.save();

  // ── Red danger zone (outer 10% of radius) ────────────────────────
  const dangerInner = screenRadius * 0.9;
  const dangerGradient = ctx.createRadialGradient(
    center.x, center.y, dangerInner,
    center.x, center.y, screenRadius,
  );
  dangerGradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
  dangerGradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.08)');
  dangerGradient.addColorStop(1, 'rgba(255, 0, 0, 0.2)');

  ctx.fillStyle = dangerGradient;
  ctx.beginPath();
  ctx.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
  ctx.fill();

  // ── Dashed boundary circle ───────────────────────────────────────
  ctx.setLineDash([12, 8]);
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
