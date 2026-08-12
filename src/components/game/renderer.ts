// ============================================================================
// Renderer — SHARED — used by both offline and online modes.
// ============================================================================

import type { Camera, FoodOrb, Viewport } from '@/lib/snake/types';
import { ARENA_GRID_SIZE, FOOD_COLORS, FOOD_GLOW_COLORS } from '@/lib/snake/config';
import { worldToScreenSnapped } from '@/lib/snake/camera';

// ==========================================================================
// Grid
// ==========================================================================

const GRID_SIZE = ARENA_GRID_SIZE;
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';

export function drawGrid(ctx: CanvasRenderingContext2D, camera: Camera, viewport: Viewport): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  const zoomedGrid = GRID_SIZE * camera.zoom;
  if (zoomedGrid < 4) return;

  // P3: Grid offset WITHOUT Math.round — the camera is now interpolated (P0)
  // so it moves smoothly. Math.round caused periodic 1px jumps as rounding
  // error accumulated (every ~67 frames at zoom 1.35). Now the grid scrolls
  // perfectly smoothly with the camera.
  let offsetX = (-camera.x * camera.zoom + viewport.width / 2) % zoomedGrid;
  let offsetY = (-camera.y * camera.zoom + viewport.height / 2) % zoomedGrid;
  // Ensure positive modulo (JS % can be negative)
  if (offsetX < 0) offsetX += zoomedGrid;
  if (offsetY < 0) offsetY += zoomedGrid;

  ctx.beginPath();
  for (let x = offsetX; x < viewport.width; x += zoomedGrid) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  }
  for (let y = offsetY; y < viewport.height; y += zoomedGrid) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }
  ctx.stroke();
}

// ==========================================================================
// Food
// ==========================================================================

// Pre-allocated food batching buffers (avoid per-frame array allocation)
const _fBucketXs: number[][] = [[], [], []];
const _fBucketYs: number[][] = [[], [], []];
const _fBucketRs: number[][] = [[], [], []];
const _fGlowXs: number[] = [];
const _fGlowYs: number[] = [];
const _fGlowRs: number[] = [];
const _fGlowCI: number[] = [];

export function drawFood(
  ctx: CanvasRenderingContext2D,
  foods: FoodOrb[],
  camera: Camera,
  viewport: Viewport,
): void {
  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  // Two-pass: collect visible food by color bucket (3 colors),
  // then draw each bucket as a single batched path.
  // This reduces fillStyle changes from 200+ to ~3.
  const bucketXs = _fBucketXs; const bucketYs = _fBucketYs; const bucketRs = _fBucketRs;
  bucketXs[0].length = 0; bucketXs[1].length = 0; bucketXs[2].length = 0;
  bucketYs[0].length = 0; bucketYs[1].length = 0; bucketYs[2].length = 0;
  bucketRs[0].length = 0; bucketRs[1].length = 0; bucketRs[2].length = 0;
  const glowXs = _fGlowXs; const glowYs = _fGlowYs; const glowRs = _fGlowRs; const glowCI = _fGlowCI;
  glowXs.length = 0; glowYs.length = 0; glowRs.length = 0; glowCI.length = 0;

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];

    // Cull off-screen
    if (f.x < viewport.left - 20 || f.x > viewport.right + 20) continue;
    if (f.y < viewport.top - 20 || f.y > viewport.bottom + 20) continue;

    const { x: sx, y: sy } = worldToScreenSnapped(f.x, f.y, camera, cw, ch);
    const baseR = f.radius * zoom;
    const r = f.magnetized ? baseR / 3 : baseR;
    if (r < 0.5) continue;

    // Bucket index: 0=small(green), 1=medium(blue), 2=large(pink)
    const bi = f.size === 'small' ? 0 : f.size === 'medium' ? 1 : 2;
    bucketXs[bi].push(sx);
    bucketYs[bi].push(sy);
    bucketRs[bi].push(r);

    if (f.magnetized) {
      glowXs.push(sx);
      glowYs.push(sy);
      glowRs.push(r * 1.8);
      glowCI.push(bi);
    }
  }

  // Draw magnetized glow rings first (behind food)
  if (glowXs.length > 0) {
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.0 * zoom;
    for (let ci = 0; ci < 3; ci++) {
      let hasAny = false;
      for (let j = 0; j < glowXs.length; j++) {
        if (glowCI[j] !== ci) continue;
        if (!hasAny) {
          ctx.strokeStyle = FOOD_GLOW_COLORS[ci];
          ctx.beginPath();
          hasAny = true;
        }
        ctx.moveTo(glowXs[j] + glowRs[j], glowYs[j]);
        ctx.arc(glowXs[j], glowYs[j], glowRs[j], 0, Math.PI * 2);
      }
      if (hasAny) ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Draw food circles (batched by color)
  for (let bi = 0; bi < 3; bi++) {
    const xs = bucketXs[bi];
    if (xs.length === 0) continue;
    ctx.fillStyle = FOOD_COLORS[bi];
    ctx.beginPath();
    const ys = bucketYs[bi];
    const rs = bucketRs[bi];
    for (let j = 0; j < xs.length; j++) {
      ctx.moveTo(xs[j] + rs[j], ys[j]);
      ctx.arc(xs[j], ys[j], rs[j], 0, Math.PI * 2);
    }
    ctx.fill();
  }
}


// ==========================================================================
// Elimination banner (shown for 3s after death, game still visible behind)
// ==========================================================================

export function drawEliminatedBanner(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  elapsed: number, // ms since death
): void {
  const { width, height } = viewport;

  // Fade in over 200ms
  const alpha = Math.min(1, elapsed / 200);

  // Pulsing red glow behind text
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.006);
  ctx.globalAlpha = alpha * 0.15 * pulse;
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  // Dark bar at top
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, 80);
  ctx.globalAlpha = 1;

  // Red accent line
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0, 80, width, 3);
  ctx.globalAlpha = 1;

  // ELIMINATED text
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('ELIMINATED', width / 2, 40);
  ctx.globalAlpha = 1;
}

// ==========================================================================
// Death overlay (shown after 3s elimination period)
// ==========================================================================

export function drawDeathOverlay(
  ctx: CanvasRenderingContext2D,
  score: number,
  viewport: Viewport,
): void {
  const { width, height } = viewport;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('You died!', width / 2, height / 2 - 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Score: ${Math.floor(score)}`, width / 2, height / 2 + 10);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press Space or Click to respawn', width / 2, height / 2 + 50);
}

// ==========================================================================
// Controls hint
// ==========================================================================

export function drawControlsHint(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
  const { width, height } = viewport;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 200, height / 2 + 60, 400, 80, 12);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = '14px monospace';
  ctx.fillText('WASD / Mouse to steer', width / 2, height / 2 + 85);
  ctx.fillText('Space / Click to boost', width / 2, height / 2 + 110);
}
