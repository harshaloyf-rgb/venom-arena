// ============================================================================
// Venom Arena — Shape Drawing Functions
// 7 preset shapes + 4 custom segment shapes = 11 total.
// ============================================================================

import type { SegmentShape, SnakeShape } from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';
import { create3DGradient } from './gradient';

// ── Basic Shapes ──────────────────────────────────────────────────────────

/** Draw a circle with optional 3D gradient */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  config: SnakeConfig,
  useGradient: boolean = true,
): void {
  const radius = Math.max(1, r);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = useGradient ? create3DGradient(ctx, x, y, radius, color, config) : color;
  ctx.fill();
}

/** Draw a box (rotated square) with optional 3D gradient */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
  useGradient: boolean = true,
): void {
  const radius = Math.max(1, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const half = radius * 0.85;
  ctx.beginPath();
  ctx.rect(-half, -half, half * 2, half * 2);
  ctx.fillStyle = useGradient ? create3DGradient(ctx, 0, 0, radius, color, config) : color;
  ctx.fill();

  ctx.restore();
}

/** Draw a triangle with optional 3D gradient */
export function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
  useGradient: boolean = true,
): void {
  const radius = Math.max(1, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = useGradient ? create3DGradient(ctx, 0, 0, radius, color, config) : color;
  ctx.fill();

  ctx.restore();
}

// ── Mix Shapes (alternating) ──────────────────────────────────────────────

/** Circle-Triangle mix: alternates circle and triangle */
export function drawMix_ct(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  segIndex: number,
  color: string,
  config: SnakeConfig,
): void {
  if (segIndex % 2 === 0) {
    drawCircle(ctx, x, y, r, color, config);
  } else {
    drawTriangle(ctx, x, y, r, angle, color, config);
  }
}

/** Circle-Box mix: alternates circle and box */
export function drawMix_cb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  segIndex: number,
  color: string,
  config: SnakeConfig,
): void {
  if (segIndex % 2 === 0) {
    drawCircle(ctx, x, y, r, color, config);
  } else {
    drawBox(ctx, x, y, r, angle, color, config);
  }
}

/** Box-Triangle mix: alternates box and triangle */
export function drawMix_bt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  segIndex: number,
  color: string,
  config: SnakeConfig,
): void {
  if (segIndex % 2 === 0) {
    drawBox(ctx, x, y, r, angle, color, config);
  } else {
    drawTriangle(ctx, x, y, r, angle, color, config);
  }
}

/** All shapes mix: cycles circle → box → triangle */
export function drawMix_all(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  segIndex: number,
  color: string,
  config: SnakeConfig,
): void {
  const mod = segIndex % 3;
  if (mod === 0) {
    drawCircle(ctx, x, y, r, color, config);
  } else if (mod === 1) {
    drawBox(ctx, x, y, r, angle, color, config);
  } else {
    drawTriangle(ctx, x, y, r, angle, color, config);
  }
}

// ── Custom Segment Shapes (Genetic Lab skins) ────────────────────────────

/** Draw a square (axis-aligned, no rotation on shape) */
export function drawSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
): void {
  const radius = Math.max(1, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const half = radius * 0.9;
  ctx.beginPath();
  ctx.rect(-half, -half, half * 2, half * 2);
  ctx.fillStyle = create3DGradient(ctx, 0, 0, radius, color, config);
  ctx.fill();

  ctx.restore();
}

/** Draw a diamond (45° rotated square) */
export function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
): void {
  const radius = Math.max(1, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 4);

  const half = radius * 0.8;
  ctx.beginPath();
  ctx.rect(-half, -half, half * 2, half * 2);
  ctx.fillStyle = create3DGradient(ctx, 0, 0, radius, color, config);
  ctx.fill();

  ctx.restore();
}

/** Draw a spike (star-like shape with sharp points) */
export function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
): void {
  const radius = Math.max(1, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const points = 5;
  const outerR = radius;
  const innerR = radius * 0.45;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = create3DGradient(ctx, 0, 0, radius, color, config);
  ctx.fill();

  ctx.restore();
}

// ── Dispatcher ────────────────────────────────────────────────────────────

/**
 * Draw a shape by SegmentShape (used by custom skins and body styles).
 */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: SegmentShape,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
  config: SnakeConfig,
  useGradient: boolean = true,
): void {
  switch (shape) {
    case 'circle':
      drawCircle(ctx, x, y, r, color, config, useGradient);
      break;
    case 'square':
      drawSquare(ctx, x, y, r, angle, color, config);
      break;
    case 'diamond':
      drawDiamond(ctx, x, y, r, angle, color, config);
      break;
    case 'spike':
      drawSpike(ctx, x, y, r, angle, color, config);
      break;
    default:
      drawCircle(ctx, x, y, r, color, config, useGradient);
  }
}

/**
 * Draw by SnakeShape (legacy preset shapes with alternating patterns).
 */
export function drawSnakeShape(
  ctx: CanvasRenderingContext2D,
  snakeShape: SnakeShape,
  x: number,
  y: number,
  r: number,
  angle: number,
  segIndex: number,
  color: string,
  config: SnakeConfig,
): void {
  switch (snakeShape) {
    case 'circle':
      drawCircle(ctx, x, y, r, color, config);
      break;
    case 'box':
      drawBox(ctx, x, y, r, angle, color, config);
      break;
    case 'triangle':
      drawTriangle(ctx, x, y, r, angle, color, config);
      break;
    case 'mix_ct':
      drawMix_ct(ctx, x, y, r, angle, segIndex, color, config);
      break;
    case 'mix_cb':
      drawMix_cb(ctx, x, y, r, angle, segIndex, color, config);
      break;
    case 'mix_bt':
      drawMix_bt(ctx, x, y, r, angle, segIndex, color, config);
      break;
    case 'mix_all':
      drawMix_all(ctx, x, y, r, angle, segIndex, color, config);
      break;
    default:
      drawCircle(ctx, x, y, r, color, config);
  }
}
