/**
 * Venom Arena — food orb + star collectible + extraction ring rendering.
 */

import type { FrameRenderCtx, OrbConfig } from './types';
import { computeVisibleRect } from './render-grid';
import type { FoodSnapshot } from '@/lib/types';

const ORB_CONFIGS: Record<number, OrbConfig> = {
  1: { radius: 3, color: '#34d399', glowColor: '#10b981', shadowBlur: 6, label: 'small' },
  3: { radius: 5, color: '#38bdf8', glowColor: '#0ea5e9', shadowBlur: 10, label: 'medium' },
  5: { radius: 8, color: '#f472b6', glowColor: '#ec4899', shadowBlur: 16, label: 'large' },
};

/** Default config used when orbSize doesn't match known values. */
const DEFAULT_ORB: OrbConfig = ORB_CONFIGS[1];

/**
 * Draws a single food orb with glow effects. The orbSize determines which
 * visual tier to use. Falls back to small orb for unknown sizes.
 */
export function drawFoodOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orbSize: number,
  value: number,
  color: string,
  glowColor: string,
  now: number,
  lowQuality: boolean,
): void {
  // Select config based on value; use provided color/glowColor if different
  const config = ORB_CONFIGS[value] ?? DEFAULT_ORB;
  const useColor = color || config.color;
  const useGlow = glowColor || config.glowColor;
  const r = Math.max(2, orbSize > 0 ? orbSize : config.radius);

  ctx.save();

  // Large orbs get a subtle pulse animation
  let animR = r;
  if (value === 5 && !lowQuality) {
    const pulse = Math.sin(now * 0.004) * 1.5;
    animR = r + pulse;
  }

  // Glow effect (skip in low quality)
  if (!lowQuality) {
    ctx.shadowColor = useGlow;
    ctx.shadowBlur = config.shadowBlur;
  }

  // Radial gradient for a lit-from-within look
  const grad = ctx.createRadialGradient(x, y, 0, x, y, animR);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, useColor);
  grad.addColorStop(1, useGlow);

  ctx.beginPath();
  ctx.arc(x, y, animR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Star collectible rendering — 5-pointed star shape
// ---------------------------------------------------------------------------

/**
 * Draws a proper 5-pointed star path. Generic helper used by drawStarCollectible.
 *
 * @param ctx     Canvas context
 * @param cx      Center X
 * @param cy      Center Y
 * @param outerR  Outer radius (tip of star)
 * @param innerR  Inner radius (valley between points)
 * @param points  Number of points (always 5 for stars)
 * @param rotation Rotation in radians (for spin animation)
 */
export function drawStarShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
  rotation: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2 + rotation;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Draws a 5-pointed star collectible with golden glow, subtle rotation,
 * and pulsing glow effect. Stars are the rare high-value pickups.
 */
export function drawStarCollectible(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  tick: number,
  lowQuality: boolean,
): void {
  const outerR = Math.max(4, size);
  const innerR = Math.max(2, size * 0.4);

  // Rotation: slow spin based on tick
  const rotation = tick * 0.002;

  // Pulsing glow: size oscillates ±1.5px over ~1.5s
  const pulse = lowQuality ? 0 : Math.sin(tick * 0.004) * 1.5;
  const animOuter = outerR + pulse;
  const animInner = innerR + pulse * 0.4;

  ctx.save();

  // Glow
  if (!lowQuality) {
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 12 + Math.sin(tick * 0.003) * 4;
  }

  // Star shape
  drawStarShape(ctx, x, y, animOuter, animInner, 5, rotation);

  // Golden radial gradient fill
  const grad = ctx.createRadialGradient(x, y, 0, x, y, animOuter);
  grad.addColorStop(0, '#fef3c7'); // bright center
  grad.addColorStop(0.4, '#fbbf24');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Extraction ring — white-to-green circle near an extracting snake's head
// ---------------------------------------------------------------------------

/**
 * Draws the extraction progress ring around a snake's head.
 * Visible to ALL players as a warning that someone is banking chips.
 */
export function drawExtractionRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  snakeSize: number,
  progress: number, // 0..1
  zoom: number,
): void {
  if (progress <= 0 || progress > 1) return;

  const ringRadius = Math.max(8, snakeSize + 10 / zoom);
  const lineWidth = Math.max(2, 3 / zoom);

  ctx.save();

  // Background ring (track)
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // Progress arc (white → green gradient)
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + progress * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, startAngle, endAngle);

  // Color: white at start → emerald green at end
  const r = Math.round(255 - progress * 227); // 255 → 28
  const g = Math.round(255 - progress * 55);  // 255 → 200
  const b = Math.round(255 - progress * 215); // 255 → 40
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
  ctx.lineWidth = lineWidth + 1 / zoom;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  if (!lowQualityCheck(ctx)) {
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.shadowBlur = 8 / zoom;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, startAngle, endAngle);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

/** Cheap low-quality check — if canvas context has a hint. */
function lowQualityCheck(_ctx: CanvasRenderingContext2D): boolean {
  return false; // We don't pass lowQuality here; caller can gate
}

// ---------------------------------------------------------------------------
// Food (main entry point — batches regular orbs, draws stars individually)
// ---------------------------------------------------------------------------

/**
 * Draws all food in two passes:
 *  1. Regular food orbs — batched by orbSize tier into Path2D groups.
 *     Each tier (small/medium/large) has its own glow gradient.
 *  2. Star collectibles — drawn individually as 5-pointed gold stars with
 *     rotation + pulsing glow.
 */
export function drawFood(rc: FrameRenderCtx, foods: FoodSnapshot[]): void {
  const { ctx, lowQuality } = rc;
  const vis = computeVisibleRect(rc);

  // --- Regular food orbs: batch by value tier ---
  const smallOrbs: FoodSnapshot[] = [];
  const mediumOrbs: FoodSnapshot[] = [];
  const largeOrbs: FoodSnapshot[] = [];
  const starChips: FoodSnapshot[] = [];

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.x < vis.left || f.x > vis.right || f.y < vis.top || f.y > vis.bottom) {
      continue; // culled
    }
    if (f.isStarChip) {
      starChips.push(f);
      continue;
    }
    // Route to orb tier by value
    if (f.value >= 5) largeOrbs.push(f);
    else if (f.value >= 3) mediumOrbs.push(f);
    else smallOrbs.push(f);
  }

  // Draw each orb tier
  const drawOrbBatch = (orbs: FoodSnapshot[]) => {
    for (let i = 0; i < orbs.length; i++) {
      const f = orbs[i];
      drawFoodOrb(ctx, f.x, f.y, f.orbSize ? f.size : f.size, f.value, f.color, f.glowColor ?? '', rc.now, lowQuality);
    }
  };

  drawOrbBatch(smallOrbs);
  drawOrbBatch(mediumOrbs);
  drawOrbBatch(largeOrbs);

  // --- Star collectibles: 5-pointed gold stars with rotation + glow + value label ---
  if (starChips.length > 0) {
    ctx.save();
    for (let i = 0; i < starChips.length; i++) {
      const f = starChips[i];
      drawStarCollectible(ctx, f.x, f.y, Math.max(6, f.size + 4), rc.now, lowQuality);
      // Draw chip value label inside the star
      if (f.value > 0) {
        const starRadius = Math.max(4, f.size + 4);
        const labelSize = Math.max(7, Math.min(11, starRadius * 0.55));
        ctx.font = `bold ${labelSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#7c2d12'; // dark brown, readable inside golden star
        const label = f.value >= 1000 ? `${Math.round(f.value / 1000)}k` : `${Math.round(f.value)}`;
        ctx.fillText(label, f.x, f.y + 0.5);
      }
    }
    ctx.restore();
  }
}
