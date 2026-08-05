// ============================================================================
// Atlas-based Snake Renderer — Renders snakes using pre-built texture atlas
// sprites. Falls back to simple circle rendering when no atlas is available.
// Phase C of the snake game engine rewrite.
// ============================================================================

import type { Camera, Snake, Viewport } from '@/lib/snake/types';
import { SNAKE_RADIUS, SPAWN_PROTECTION_MS, LEGENDARY_GLOW_SIZE } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';
import { angleDirect } from '@/lib/snake/vec2';
import type { SkinAtlasManager } from '@/lib/snake/atlas';
import { LEGENDARY_EMITTER_CONFIG } from '@/lib/snake/atlas';

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

// ─── Main atlas renderer ────────────────────────────────────────────────────

/**
 * Render one snake using atlas sprites if available, otherwise fallback.
 * Returns live particles for this snake so the caller can keep them alive
 * across frames.
 */
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
  if (pathLen === 0) return;

  // ── HEAD-LEVEL CULLING ──
  const _headWx = snake.path.headX;
  const _headWy = snake.path.headY;
  const _cullMargin = Math.min(pathLen * 8, 500) + 100;
  if (_headWx < viewport.left - _cullMargin || _headWx > viewport.right + _cullMargin) return;
  if (_headWy < viewport.top - _cullMargin || _headWy > viewport.bottom + _cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = SNAKE_RADIUS * zoom;

  // Spawn protection blink
  if (time - snake.spawnTime < SPAWN_PROTECTION_MS && Math.floor(time / 150) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // Viewport culling bounds
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

  // ── Draw body segments (tail → head, so head is on top) ──
  for (let i = pathLen - 1; i >= 1; i--) {
    const wx = snake.path.getX(i);
    const wy = snake.path.getY(i);
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;

    const { x: sx, y: sy } = worldToScreen(wx, wy, camera, cw, ch);

    // Determine angle from this segment to the previous one (toward head)
    let segAngle: number;
    if (i === 1) {
      segAngle = snake.angle;
    } else {
      segAngle = angleDirect(
        snake.path.getX(i), snake.path.getY(i),
        snake.path.getX(i - 1), snake.path.getY(i - 1),
      );
    }

    // Pick body region (cycle through variants)
    const bodyIdx = i % atlas.body.length;
    const region = atlas.body[bodyIdx];

    // Draw size: sprite rendered at segRadius * 2 diameter
    const drawSize = segRadius * 2;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(segAngle);

    // Apply epic animation effect
    if (isEpic && animation) {
      atlasManager.applyEpicEffect(
        ctx, animation, time, 0, 0, drawSize, snake.color,
      );
    }

    ctx.drawImage(
      atlas.canvas,
      region.x, region.y, region.width, region.height,
      -drawSize / 2, -drawSize / 2, drawSize, drawSize,
    );

    atlasManager.resetEpicEffect(ctx);
    ctx.restore();
  }

  // ── Tail (last segment) ──
  if (pathLen > 1) {
    const tailIdx = pathLen - 1;
    const twx = snake.path.getX(tailIdx);
    const twy = snake.path.getY(tailIdx);
    if (twx >= vl && twx <= vr && twy >= vt && twy <= vb) {
      const { x: tsx, y: tsy } = worldToScreen(twx, twy, camera, cw, ch);
      const tailAngle = tailIdx > 1
        ? angleDirect(
            snake.path.getX(tailIdx), snake.path.getY(tailIdx),
            snake.path.getX(tailIdx - 1), snake.path.getY(tailIdx - 1),
          )
        : snake.angle;
      const tailDrawSize = segRadius * 2 * (TAIL_RATIO);

      ctx.save();
      ctx.translate(tsx, tsy);
      ctx.rotate(tailAngle);
      ctx.drawImage(
        atlas.canvas,
        atlas.tail.x, atlas.tail.y, atlas.tail.width, atlas.tail.height,
        -tailDrawSize / 2, -tailDrawSize / 2, tailDrawSize, tailDrawSize,
      );
      ctx.restore();
    }
  }

  // ── Head ──
  const headWx = snake.path.headX;
  const headWy = snake.path.headY;
  if (headWx >= vl && headWx <= vr && headWy >= vt && headWy <= vb) {
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
      atlasManager.applyEpicEffect(
        ctx, animation, time, 0, 0, headDrawSize, snake.headColor,
      );
    }

    ctx.drawImage(
      atlas.canvas,
      atlas.head.x, atlas.head.y, atlas.head.width, atlas.head.height,
      -headDrawSize / 2, -headDrawSize / 2, headDrawSize, headDrawSize,
    );

    atlasManager.resetEpicEffect(ctx);
    ctx.restore();

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
      ctx.fillText(snake.name, hsx, hsy - headDrawSize / 2 - 4 * zoom);
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

// ─── Fallback renderer with leaky-integrator inner curl ──────────────────

// Inner curl constants
const CHAIN_STEP = 5;
const CURL_STRENGTH = 3.5;
const CURL_DECAY = 0.97;
const SIZE_SHRINK = 0.025;
const MAX_SIZE_SHRINK = 0.55;
const CURL_FADE = 4;

/**
 * Fallback renderer with inner curl (corner-cutting) and boost-stretch fix.
 * Walks the path at fixed CHAIN_STEP intervals with interpolation.
 * A leaky integrator accumulates curvature from head to tail,
 * producing progressive perpendicular offset + size reduction.
 */
export function renderSnakeFallback(
  ctx: CanvasRenderingContext2D,
  snake: Snake,
  camera: Camera,
  viewport: Viewport,
): void {
  const path = snake.path;
  const pathLen = path.length;
  if (pathLen === 0) return;

  const headWorldX = path.headX;
  const headWorldY = path.headY;
  const cullMargin = Math.min(pathLen * 8, 500) + 100;
  if (headWorldX < viewport.left - cullMargin || headWorldX > viewport.right + cullMargin) return;
  if (headWorldY < viewport.top - cullMargin || headWorldY > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;

  // Spawn protection blink
  if (performance.now() - snake.spawnTime < SPAWN_PROTECTION_MS && Math.floor(performance.now() / 150) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  const vl = viewport.left - 20;
  const vr = viewport.right + 20;
  const vt = viewport.top - 20;
  const vb = viewport.bottom + 20;

  const headScreen = worldToScreen(headWorldX, headWorldY, camera, cw, ch);
  const headVisible = headWorldX >= vl && headWorldX <= vr && headWorldY >= vt && headWorldY <= vb;

  // ── Chain-simulated body with leaky-integrator inner curl ──
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  let hasBodySegs = false;

  if (pathLen >= 3) {
    let pIdx = 0;
    let pFrac = 0;
    let pSegLen = 0;
    let pSegDx = 0;
    let pSegDy = 0;

    pSegDx = path.getX(1) - headWorldX;
    pSegDy = path.getY(1) - headWorldY;
    pSegLen = Math.sqrt(pSegDx * pSegDx + pSegDy * pSegDy);

    const advancePathSeg = () => {
      pIdx++;
      if (pIdx + 1 < pathLen) {
        const sx = path.getX(pIdx);
        const sy = path.getY(pIdx);
        pSegDx = path.getX(pIdx + 1) - sx;
        pSegDy = path.getY(pIdx + 1) - sy;
        pSegLen = Math.sqrt(pSegDx * pSegDx + pSegDy * pSegDy);
      } else {
        pSegLen = 0;
      }
      pFrac = 0;
    };

    const getCursorPos = (out: number[]) => {
      const sx = path.getX(pIdx);
      const sy = path.getY(pIdx);
      if (pIdx + 1 < pathLen && pFrac < 1 && pSegLen > 0.01) {
        out[0] = sx + pSegDx * pFrac;
        out[1] = sy + pSegDy * pFrac;
      } else {
        out[0] = sx;
        out[1] = sy;
      }
    };

    const getPathDir = (out: number[]) => {
      let dx: number, dy: number;
      if (pIdx + 1 < pathLen) {
        dx = path.getX(pIdx + 1) - path.getX(pIdx);
        dy = path.getY(pIdx + 1) - path.getY(pIdx);
      } else if (pIdx >= 1) {
        dx = path.getX(pIdx) - path.getX(pIdx - 1);
        dy = path.getY(pIdx) - path.getY(pIdx - 1);
      } else {
        out[0] = Math.cos(snake.angle);
        out[1] = Math.sin(snake.angle);
        return;
      }
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.01) { dx /= len; dy /= len; }
      out[0] = dx;
      out[1] = dy;
    };

    const getCurvature = (): number => {
      if (pIdx < 1 || pIdx + 1 >= pathLen) return 0;
      const ax = path.getX(pIdx - 1), ay = path.getY(pIdx - 1);
      const bx = path.getX(pIdx + 1), by = path.getY(pIdx + 1);
      const sx = path.getX(pIdx), sy = path.getY(pIdx);
      const v1x = sx - ax, v1y = sy - ay;
      const v2x = bx - sx, v2y = by - sy;
      return Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
    };

    const step = CHAIN_STEP;
    const maxSegs = Math.ceil(pathLen * 2) + 4;
    const tmpPos = [0, 0];
    const tmpDir = [0, 0];
    let cumulativeCurl = 0;

    for (let s = 1; s < maxSegs; s++) {
      let toWalk = step;
      let reachedEnd = false;

      while (toWalk > 0.01) {
        if (pSegLen < 0.01) { advancePathSeg(); if (pIdx + 1 >= pathLen) { reachedEnd = true; break; } continue; }
        const avail = pSegLen * (1 - pFrac);
        if (avail <= 0.01) { advancePathSeg(); if (pIdx + 1 >= pathLen) { reachedEnd = true; break; } continue; }
        if (avail <= toWalk) { toWalk -= avail; advancePathSeg(); if (pIdx + 1 >= pathLen) { reachedEnd = true; break; } }
        else { pFrac += toWalk / pSegLen; toWalk = 0; }
      }

      getCursorPos(tmpPos);
      const pathX = tmpPos[0];
      const pathY = tmpPos[1];

      if (reachedEnd && pIdx < pathLen) {
        const lx = path.getX(Math.min(pIdx, pathLen - 1));
        const ly = path.getY(Math.min(pIdx, pathLen - 1));
        getPathDir(tmpDir);
        const rX = -tmpDir[1], rY = tmpDir[0];
        const vx = lx + rX * cumulativeCurl;
        const vy = ly + rY * cumulativeCurl;
        const shrink = Math.min(Math.abs(cumulativeCurl) * SIZE_SHRINK, MAX_SIZE_SHRINK);
        const tailSr = SNAKE_RADIUS * (1 - shrink) * zoom;
        if (vx >= vl && vx <= vr && vy >= vt && vy <= vb) {
          const scr = worldToScreen(vx, vy, camera, cw, ch);
          ctx.moveTo(scr.x + tailSr, scr.y);
          ctx.arc(scr.x, scr.y, tailSr, 0, Math.PI * 2);
          hasBodySegs = true;
        }
        break;
      }

      const curvature = getCurvature();
      const fade = Math.min(1, (s - 1) / CURL_FADE);

      cumulativeCurl *= CURL_DECAY;
      cumulativeCurl += curvature * CURL_STRENGTH * fade;

      getPathDir(tmpDir);
      const rightX = -tmpDir[1];
      const rightY = tmpDir[0];
      const visualX = pathX + rightX * cumulativeCurl;
      const visualY = pathY + rightY * cumulativeCurl;

      const shrink = Math.min(Math.abs(cumulativeCurl) * SIZE_SHRINK, MAX_SIZE_SHRINK);
      const visualR = SNAKE_RADIUS * (1 - shrink);

      if (visualX >= vl && visualX <= vr && visualY >= vt && visualY <= vb) {
        const scr = worldToScreen(visualX, visualY, camera, cw, ch);
        const sr = visualR * zoom;
        ctx.moveTo(scr.x + sr, scr.y);
        ctx.arc(scr.x, scr.y, sr, 0, Math.PI * 2);
        hasBodySegs = true;
      }

      if (reachedEnd) break;
    }
  }

  if (hasBodySegs) ctx.fill();

  // ── Head ──
  const headRadius = SNAKE_RADIUS * zoom * 1.3;
  if (headVisible) {
    ctx.fillStyle = snake.headColor;
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const segRadius = SNAKE_RADIUS * zoom;
    if (segRadius > 3) {
      const eyeOffset = headRadius * 0.4;
      const eyeR = headRadius * 0.25;
      const pupilR = eyeR * 0.6;
      const perpAngle = snake.angle + Math.PI / 2;
      const eyeForward = headRadius * 0.3;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const ex = headScreen.x + Math.cos(snake.angle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
        const ey = headScreen.y + Math.sin(snake.angle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;
        ctx.moveTo(ex + eyeR, ey);
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = '#111111';
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const ex = headScreen.x + Math.cos(snake.angle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
        const ey = headScreen.y + Math.sin(snake.angle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;
        const ppx = ex + Math.cos(snake.angle) * pupilR * 0.3;
        const ppy = ey + Math.sin(snake.angle) * pupilR * 0.3;
        ctx.moveTo(ppx + pupilR, ppy);
        ctx.arc(ppx, ppy, pupilR, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Name
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(snake.name, headScreen.x, headScreen.y - headRadius - 4 * zoom);
    }
  }

  ctx.globalAlpha = 1;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TAIL_RATIO = 0.875; // TAIL_SPRITE_SIZE / SPRITE_SIZE = 56 / 64

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Map skin ID to animation type string */
function getAnimationForSkin(skinId: string): string {
  const map: Record<string, string> = {
    'skin-neon-pink': 'pulse',
    'skin-arctic': 'flow',
    'skin-lava-core': 'lava',
    'skin-cyber-phantom': 'cyberpulse',
  };
  return map[skinId] ?? 'none';
}

/** Clean up particle pool for a dead snake */
export function cleanupSnakeParticles(snakeId: string): void {
  particlePools.delete(snakeId);
}
