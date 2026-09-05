// ============================================================================
// Renderer — SHARED — used by both offline and online modes.
// ============================================================================

import type { Camera, FoodOrb, Viewport } from '@/lib/snake/types';
import { FOOD_COLORS, FOOD_GLOW_COLORS } from '@/lib/snake/config';
import { computeCamTransform, w2sX, w2sY } from '@/lib/snake/camera';

// ==========================================================================
// Food
// ==========================================================================
// (Grid/background pattern painting moved to '@/lib/snake/backgrounds' —
// it now serves the 8 themed arena backgrounds via hud.renderBackground.)

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
  const ct = computeCamTransform(camera, cw, ch);

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

    // Tier-2 (world-to-screen unify): exact float transform — same family as
    // player/bots. The old snapped variant made food step in whole-pixel
    // quanta against the smoothly-gliding snakes (shimmer at low zoom).
    const sx = w2sX(f.x, ct);
    const sy = w2sY(f.y, ct);
    let baseR = f.radius * zoom;
    let r = f.magnetized ? baseR / 3 : baseR;
    if (r < 0.5) continue;

    // BLUR FIX: Snap radius for small orbs (r < 4px CSS).
    // Sub-pixel radii cause the anti-aliased edge ring to shift shape each frame
    // as the camera moves → visible shimmer/blur on tiny food particles.
    // Snapping to 0.5px keeps circles round while eliminating frame-to-frame variation.
    if (r < 4) {
      r = Math.round(r * 2) / 2;
    }

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
    const dpr = window.devicePixelRatio || 1;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = (1.0 * zoom) / dpr;
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
  // FIX H7: killedBy is now actually displayed. GameCanvas has always passed
  // it as a 4th argument, but the old 3-param signature silently dropped it.
  killedBy?: string,
): void {
  const { width, height } = viewport;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('You died!', width / 2, height / 2 - 40);

  if (killedBy) {
    ctx.fillStyle = '#f87171';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Killed by ${killedBy}`, width / 2, height / 2 - 8);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.fillText(`Score: ${Math.floor(score)}`, width / 2, height / 2 + (killedBy ? 22 : 10));

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press Space or Click to respawn', width / 2, height / 2 + (killedBy ? 60 : 50));
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
