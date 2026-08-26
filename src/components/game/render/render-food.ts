// ============================================================================
// Venom Arena — Food Orb Renderer
// ============================================================================

import type { FoodOrb, CameraState } from '@/lib/snake/types';
import { worldToScreen, isOnScreen } from './camera';

/**
 * Render a single food orb.
 * 3 sizes with appropriate glow/pulse.
 * Only renders if on screen.
 */
export function renderFood(
  ctx: CanvasRenderingContext2D,
  food: FoodOrb,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  if (!isOnScreen(food.x, food.y, food.radius * 2, camera, canvasW, canvasH)) {
    return;
  }

  const screen = worldToScreen(food.x, food.y, camera, canvasW, canvasH);
  const r = Math.max(1, food.radius * camera.zoom);

  // Glow intensity varies by size
  let glowBlur: number;
  let glowAlpha: number;

  switch (food.size) {
    case 'large':
      glowBlur = 12;
      glowAlpha = 0.5;
      break;
    case 'medium':
      glowBlur = 8;
      glowAlpha = 0.4;
      break;
    case 'small':
    default:
      glowBlur = 4;
      glowAlpha = 0.3;
      break;
  }

  ctx.save();

  // Outer glow
  ctx.shadowColor = food.color;
  ctx.shadowBlur = glowBlur;
  ctx.globalAlpha = glowAlpha;

  ctx.beginPath();
  ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
  ctx.fillStyle = food.color;
  ctx.fill();

  // Inner bright core
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.35;
  ctx.fill();

  ctx.restore();
}

/**
 * Render multiple food orbs, skipping off-screen ones.
 */
export function renderFoods(
  ctx: CanvasRenderingContext2D,
  foods: FoodOrb[],
  camera: CameraState,
  canvasW: number,
  canvasH: number,
): void {
  for (let i = 0; i < foods.length; i++) {
    renderFood(ctx, foods[i], camera, canvasW, canvasH);
  }
}
