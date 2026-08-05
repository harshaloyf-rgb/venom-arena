// ============================================================================
// Atlas-based Snake Renderer + Fallback Renderer
//
// BOOST STRETCH FIX:
//   The path buffer records one position per tick. During boost, entries are
//   BOOST_SPEED (8px) apart instead of BASE_SPEED (4.5px). If we draw one
//   sprite per path entry, the body stretches when boosting.
//
//   FIX: Walk the path at a FIXED visual step (BODY_DRAW_STEP), capped to
//   the snake's logical length. The visual body length stays constant.
// ============================================================================

import type { Camera, Snake, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SEGMENT_SPACING, SPAWN_PROTECTION_MS, LEGENDARY_GLOW_SIZE, START_LENGTH, GROWTH_RATE, MAX_SNAKE_LENGTH } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';
import { angleDirect } from '@/lib/snake/vec2';
import type { SkinAtlasManager } from '@/lib/snake/atlas';
import { LEGENDARY_EMITTER_CONFIG } from '@/lib/snake/atlas';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Fixed pixel spacing between drawn body segments (world space).
 *  Less than SNAKE_RADIUS*2 for overlap → solid continuous look. */
const BODY_DRAW_STEP = 7;

// ─── Particle type (render-side) ────────────────────────────────────────────

interface RenderParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  radius: number;
  color: string;
}

/** Per-snake live particle pool */
const particlePools: Map<string, RenderParticle[]> = new Map();

// ─── Path Walker ────────────────────────────────────────────────────────────

/**
 * Walk along a PathBuffer at a fixed pixel step, collecting positions + directions.
 * Returns arrays of {x, y, angle} for each drawn segment.
 * Capped at `maxSegs` segments so body length stays constant regardless of speed.
 */
interface WalkResult {
  xs: Float64Array;
  ys: Float64Array;
  angles: Float64Array;
  count: number;
}

// Reusable walker state (avoids GC pressure)
const _walker = {
  pIdx: 0,
  pFrac: 0,
  pSegLen: 0,
  pSegDx: 0,
  pSegDy: 0,
  prevDx: 0,
  prevDy: 0,
};

function walkPathFixedStep(
  path: { getX: (i: number) => number; getY: (i: number) => number; length: number; headX: number; headY: number },
  step: number,
  maxSegs: number,
  headAngle: number,
): WalkResult {
  const pathLen = path.length;
  const w = _walker;

  // Pre-allocate result arrays
  let xs = _walkResult.xs;
  let ys = _walkResult.ys;
  let angles = _walkResult.angles;
  if (xs.length < maxSegs) {
    xs = new Float64Array(maxSegs);
    ys = new Float64Array(maxSegs);
    angles = new Float64Array(maxSegs);
    _walkResult.xs = xs;
    _walkResult.ys = ys;
    _walkResult.angles = angles;
  }

  if (pathLen < 2) {
    _walkResult.count = 0;
    return _walkResult;
  }

  const headX = path.headX;
  const headY = path.headY;

  // Initialize walker at head (path[0] → path[1])
  w.pIdx = 0;
  w.pFrac = 0;
  w.pSegDx = path.getX(1) - headX;
  w.pSegDy = path.getY(1) - headY;
  w.pSegLen = Math.sqrt(w.pSegDx * w.pSegDx + w.pSegDy * w.pSegDy);
  // Initial direction (from head toward path[1])
  w.prevDx = w.pSegLen > 0.01 ? w.pSegDx / w.pSegLen : Math.cos(headAngle);
  w.prevDy = w.pSegLen > 0.01 ? w.pSegDy / w.pSegLen : Math.sin(headAngle);

  let count = 0;

  for (let s = 1; s <= maxSegs; s++) {
    let toWalk = step;
    let reachedEnd = false;

    while (toWalk > 0.01) {
      if (w.pSegLen < 0.01) {
        w.pIdx++;
        w.pFrac = 0;
        if (w.pIdx + 1 < pathLen) {
          const sx = path.getX(w.pIdx);
          const sy = path.getY(w.pIdx);
          w.pSegDx = path.getX(w.pIdx + 1) - sx;
          w.pSegDy = path.getY(w.pIdx + 1) - sy;
          w.pSegLen = Math.sqrt(w.pSegDx * w.pSegDx + w.pSegDy * w.pSegDy);
        } else {
          w.pSegLen = 0;
          reachedEnd = true;
          break;
        }
        continue;
      }

      const avail = w.pSegLen * (1 - w.pFrac);
      if (avail <= 0.01) {
        // Save direction before advancing
        if (w.pSegLen > 0.01) {
          w.prevDx = w.pSegDx / w.pSegLen;
          w.prevDy = w.pSegDy / w.pSegLen;
        }
        w.pIdx++;
        w.pFrac = 0;
        if (w.pIdx + 1 < pathLen) {
          const sx = path.getX(w.pIdx);
          const sy = path.getY(w.pIdx);
          w.pSegDx = path.getX(w.pIdx + 1) - sx;
          w.pSegDy = path.getY(w.pIdx + 1) - sy;
          w.pSegLen = Math.sqrt(w.pSegDx * w.pSegDx + w.pSegDy * w.pSegDy);
        } else {
          w.pSegLen = 0;
          reachedEnd = true;
          break;
        }
        continue;
      }

      if (avail <= toWalk) {
        toWalk -= avail;
        // Save direction before advancing
        if (w.pSegLen > 0.01) {
          w.prevDx = w.pSegDx / w.pSegLen;
          w.prevDy = w.pSegDy / w.pSegLen;
        }
        w.pIdx++;
        w.pFrac = 0;
        if (w.pIdx + 1 < pathLen) {
          const sx = path.getX(w.pIdx);
          const sy = path.getY(w.pIdx);
          w.pSegDx = path.getX(w.pIdx + 1) - sx;
          w.pSegDy = path.getY(w.pIdx + 1) - sy;
          w.pSegLen = Math.sqrt(w.pSegDx * w.pSegDx + w.pSegDy * w.pSegDy);
        } else {
          w.pSegLen = 0;
          reachedEnd = true;
          break;
        }
      } else {
        w.pFrac += toWalk / w.pSegLen;
        toWalk = 0;
      }
    }

    // Compute position
    let wx: number, wy: number;
    if (reachedEnd && w.pIdx < pathLen) {
      wx = path.getX(Math.min(w.pIdx, pathLen - 1));
      wy = path.getY(Math.min(w.pIdx, pathLen - 1));
    } else if (w.pSegLen > 0.01) {
      const sx = path.getX(w.pIdx);
      const sy = path.getY(w.pIdx);
      wx = sx + w.pSegDx * w.pFrac;
      wy = sy + w.pSegDy * w.pFrac;
    } else {
      wx = path.getX(Math.min(w.pIdx, pathLen - 1));
      wy = path.getY(Math.min(w.pIdx, pathLen - 1));
    }

    // Compute angle (direction of travel at this point)
    let segAngle: number;
    if (w.pSegLen > 0.01) {
      segAngle = Math.atan2(w.pSegDy, w.pSegDx);
    } else {
      segAngle = Math.atan2(w.prevDy, w.prevDx);
    }

    xs[count] = wx;
    ys[count] = wy;
    angles[count] = segAngle;
    count++;

    if (reachedEnd) break;
  }

  _walkResult.count = count;
  return _walkResult;
}

// Reusable walk result
const _walkResult: WalkResult = { xs: new Float64Array(64), ys: new Float64Array(64), angles: new Float64Array(64), count: 0 };

// ─── Main atlas renderer ────────────────────────────────────────────────────

export function renderSnakeAtlas(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
  atlasManager: SkinAtlasManager,
  time: number,
): void {
  const atlas = atlasManager.getAtlas(snake.skinId);
  if (!atlas) {
    renderSnakeFallback(ctx, snake, camera, viewport);
    return;
  }

  const pathLen = snake.path.length;
  if (pathLen < 2) return;

  const headWx = snake.path.headX;
  const headWy = snake.path.headY;

  // ── Calculate logical body length (segments) and cap ──
  const logicalLen = Math.min(Math.floor(START_LENGTH + snake.score * GROWTH_RATE), MAX_SNAKE_LENGTH);
  const visualLen = logicalLen * SEGMENT_SPACING;
  const maxSegs = Math.ceil(visualLen / BODY_DRAW_STEP);

  // Culling
  const cullMargin = visualLen + 100;
  if (headWx < viewport.left - cullMargin || headWx > viewport.right + cullMargin) return;
  if (headWy < viewport.top - cullMargin || headWy > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = SNAKE_RADIUS * zoom;

  // Spawn protection: smooth fade-in (no blinking)
  const spawnAge = time - snake.spawnTime;
  if (spawnAge < SPAWN_PROTECTION_MS) {
    const t = spawnAge / SPAWN_PROTECTION_MS;
    const pulse = 0.7 + 0.3 * Math.sin(time * 0.008);
    ctx.globalAlpha = 0.5 + 0.5 * t * pulse;
  }

  const vl = viewport.left - 40;
  const vr = viewport.right + 40;
  const vt = viewport.top - 40;
  const vb = viewport.bottom + 40;

  const isEpic = atlas.rarity === 'epic';
  const isLegendary = atlas.rarity === 'legendary';
  const animation = snake.rarity === 'epic' || snake.rarity === 'legendary'
    ? getAnimationForSkin(snake.skinId)
    : undefined;

  // ── Legendary: emit and update particles ──
  if (isLegendary) {
    const pool = particlePools.get(snake.id) ?? [];
    const emitted = atlasManager.emitParticles(
      snake.path, snake.angle, time, LEGENDARY_EMITTER_CONFIG,
    );
    pool.push(...emitted);
    const updated = atlasManager.updateParticles(pool, 1 / 60);
    particlePools.set(snake.id, updated);
  }

  // ── FIXED-SPACING BODY: Walk path at BODY_DRAW_STEP, capped to maxSegs ──
  const walked = walkPathFixedStep(snake.path, BODY_DRAW_STEP, maxSegs, snake.angle);

  // Draw body segments (tail → head for proper layering)
  const drawSize = segRadius * 2;
  for (let i = walked.count - 1; i >= 0; i--) {
    const wx = walked.xs[i];
    const wy = walked.ys[i];
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;

    const { x: sx, y: sy } = worldToScreen(wx, wy, camera, cw, ch);
    const segAngle = walked.angles[i];

    // Pick body region (cycle through variants)
    const bodyIdx = i % atlas.body.length;
    const region = atlas.body[bodyIdx];

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(segAngle);

    if (isEpic && animation) {
      atlasManager.applyEpicEffect(ctx, animation, time, 0, 0, drawSize, snake.color);
    }

    ctx.drawImage(
      atlas.canvas,
      region.x, region.y, region.width, region.height,
      -drawSize / 2, -drawSize / 2, drawSize, drawSize,
    );

    atlasManager.resetEpicEffect(ctx);
    ctx.restore();
  }

  // ── Head ──
  const headVisible = headWx >= vl && headWx <= vr && headWy >= vt && headWy <= vb;
  if (headVisible) {
    const { x: hsx, y: hsy } = worldToScreen(headWx, headWy, camera, cw, ch);
    const headDrawSize = segRadius * 2 * 1.3;

    // Legendary glow underlay
    if (isLegendary) {
      const glowR = headDrawSize / 2 + LEGENDARY_GLOW_SIZE * zoom;
      const intensity = 0.25 + 0.15 * Math.sin(time * 3);
      ctx.save();
      ctx.globalAlpha = intensity;
      const glowGrad = ctx.createRadialGradient(hsx, hsy, headDrawSize / 4, hsx, hsy, glowR);
      glowGrad.addColorStop(0, snake.headColor);
      glowGrad.addColorStop(0.5, 'rgba(251,191,36,0.15)');
      glowGrad.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(hsx, hsy, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(hsx, hsy);
    ctx.rotate(snake.angle);

    if (isLegendary && animation) {
      atlasManager.applyEpicEffect(ctx, animation, time, 0, 0, headDrawSize, snake.headColor);
    }

    ctx.drawImage(
      atlas.canvas,
      atlas.head.x, atlas.head.y, atlas.head.width, atlas.head.height,
      -headDrawSize / 2, -headDrawSize / 2, headDrawSize, headDrawSize,
    );

    atlasManager.resetEpicEffect(ctx);
    ctx.restore();

    // Responsive eyes
    drawResponsiveEyes(ctx, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2);

    // Directional arrow
    drawDirectionArrow(ctx, hsx, hsy, snake.angle, headDrawSize / 2, snake.boosting);

    // Boost speed lines
    if (snake.boosting && segRadius > 3) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 * zoom;
      for (let j = 0; j < 3; j++) {
        const a = snake.angle + Math.PI + (j - 1) * 0.3;
        const len = (15 + j * 5) * zoom;
        const lx = hsx - Math.cos(snake.angle) * headDrawSize / 2;
        const ly = hsy - Math.sin(snake.angle) * headDrawSize / 2;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(a) * len, ly + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    // Name label
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(snake.name, hsx, hsy - headDrawSize / 2 - 8 * zoom);
    }
  }

  // ── Render particles for legendary snakes ──
  if (isLegendary) {
    const pool = particlePools.get(snake.id);
    if (pool) {
      for (const p of pool) {
        if (p.x < vl || p.x > vr || p.y < vt || p.y > vb) continue;
        const { x: px, y: py } = worldToScreen(p.x, p.y, camera, cw, ch);
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        const pr = p.radius * zoom;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.globalAlpha = 1;
}

// ─── Fallback renderer (simple circles, fixed-spacing) ─────────────────────

export function renderSnakeFallback(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
): void {
  const path = snake.path;
  const pathLen = path.length;
  if (pathLen < 2) return;

  const headWorldX = path.headX;
  const headWorldY = path.headY;

  // ── Calculate logical body length and cap ──
  const logicalLen = Math.min(Math.floor(START_LENGTH + snake.score * GROWTH_RATE), MAX_SNAKE_LENGTH);
  const visualLen = logicalLen * SEGMENT_SPACING;
  const maxSegs = Math.ceil(visualLen / BODY_DRAW_STEP);

  // Culling
  const cullMargin = visualLen + 100;
  if (headWorldX < viewport.left - cullMargin || headWorldX > viewport.right + cullMargin) return;
  if (headWorldY < viewport.top - cullMargin || headWorldY > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = SNAKE_RADIUS * zoom;

  // Spawn protection: smooth fade-in (no blinking)
  const now = performance.now();
  const spawnAge = now - snake.spawnTime;
  if (spawnAge < SPAWN_PROTECTION_MS) {
    const t = spawnAge / SPAWN_PROTECTION_MS;
    const pulse = 0.7 + 0.3 * Math.sin(now * 0.008);
    ctx.globalAlpha = 0.5 + 0.5 * t * pulse;
  }

  const vl = viewport.left - 20;
  const vr = viewport.right + 20;
  const vt = viewport.top - 20;
  const vb = viewport.bottom + 20;

  const headScreen = worldToScreen(headWorldX, headWorldY, camera, cw, ch);
  const headVisible = headWorldX >= vl && headWorldX <= vr && headWorldY >= vt && headWorldY <= vb;

  // ── FIXED-SPACING BODY: Walk path at BODY_DRAW_STEP, capped to maxSegs ──
  const walked = walkPathFixedStep(path, BODY_DRAW_STEP, maxSegs, snake.angle);

  // Draw body circles (tail → head for proper layering)
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  let hasBodySegs = false;

  for (let i = walked.count - 1; i >= 0; i--) {
    const wx = walked.xs[i];
    const wy = walked.ys[i];
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
    const scr = worldToScreen(wx, wy, camera, cw, ch);
    ctx.moveTo(scr.x + segRadius, scr.y);
    ctx.arc(scr.x, scr.y, segRadius, 0, Math.PI * 2);
    hasBodySegs = true;
  }
  if (hasBodySegs) ctx.fill();

  // ── Head ──
  const headRadius = segRadius * 1.3;
  if (headVisible) {
    ctx.fillStyle = snake.headColor;
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Responsive eyes
    drawResponsiveEyes(ctx, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius);

    // Directional arrow
    drawDirectionArrow(ctx, headScreen.x, headScreen.y, snake.angle, headRadius, snake.boosting);

    // Name
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(snake.name, headScreen.x, headScreen.y - headRadius - 8 * zoom);
    }
  }

  ctx.globalAlpha = 1;
}

// ─── Directional Arrow (slither.io-style pointer) ───────────────────────────

function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  angle: number,
  headRadius: number,
  boosting: boolean,
): void {
  const arrowLen = headRadius * 0.9;
  const arrowWidth = headRadius * 0.45;

  // Arrow tip (in front of the head)
  const tipDist = headRadius + arrowLen;
  const tipX = hx + Math.cos(angle) * tipDist;
  const tipY = hy + Math.sin(angle) * tipDist;

  // Arrow base (at head edge, wings spread perpendicular)
  const baseDist = headRadius * 0.6;
  const perpAngle = angle + Math.PI / 2;
  const b1x = hx + Math.cos(angle) * baseDist + Math.cos(perpAngle) * arrowWidth;
  const b1y = hy + Math.sin(angle) * baseDist + Math.sin(perpAngle) * arrowWidth;
  const b2x = hx + Math.cos(angle) * baseDist - Math.cos(perpAngle) * arrowWidth;
  const b2y = hy + Math.sin(angle) * baseDist - Math.sin(perpAngle) * arrowWidth;

  ctx.fillStyle = boosting
    ? 'rgba(255, 255, 255, 0.95)'
    : 'rgba(255, 255, 255, 0.7)';

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(b1x, b1y);
  ctx.lineTo(b2x, b2y);
  ctx.closePath();
  ctx.fill();
}

// ─── Responsive Eyes ────────────────────────────────────────────────────────

function drawResponsiveEyes(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  moveAngle: number,
  targetAngle: number,
  headRadius: number,
): void {
  const eyeOffset = headRadius * 0.42;
  const eyeRadius = headRadius * 0.28;
  const pupilRadius = eyeRadius * 0.55;
  const perpAngle = moveAngle + Math.PI / 2;
  const eyeForward = headRadius * 0.35;

  // Pupils look toward targetAngle, clamped to stay inside eye
  let lookAngle = targetAngle;
  let diff = lookAngle - moveAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const maxDev = 0.6;
  if (Math.abs(diff) > maxDev) {
    lookAngle = moveAngle + Math.sign(diff) * maxDev;
  }

  const pupilShift = eyeRadius * 0.35;

  for (const side of [-1, 1]) {
    const ex = hx + Math.cos(moveAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(moveAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil — shifted toward lookAngle
    const px = ex + Math.cos(lookAngle) * pupilShift;
    const py = ey + Math.sin(lookAngle) * pupilShift;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(px - pupilRadius * 0.25, py - pupilRadius * 0.3, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TAIL_RATIO = 0.875;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function getAnimationForSkin(skinId: string): string {
  const map: Record<string, string> = {
    'skin-neon-pink': 'pulse',
    'skin-arctic': 'flow',
    'skin-lava-core': 'lava',
    'skin-cyber-phantom': 'cyberpulse',
  };
  return map[skinId] ?? 'none';
}

export function cleanupSnakeParticles(snakeId: string): void {
  particlePools.delete(snakeId);
}
