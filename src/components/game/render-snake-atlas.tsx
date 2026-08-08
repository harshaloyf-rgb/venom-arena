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
import { SEGMENT_SPACING, SPAWN_PROTECTION_MS, LEGENDARY_GLOW_SIZE, computeBodyLength } from '@/lib/snake/config';
import { worldToScreen } from '@/lib/snake/camera';
import type { SkinAtlasManager } from '@/lib/snake/atlas';
import { LEGENDARY_EMITTER_CONFIG } from '@/lib/snake/atlas';
import { isMultiColorSkin, getSegmentColor } from '@/lib/snake/skin-registry';
import { renderEquippedCosmetics, readEquippedCosmetics } from '@/lib/snake/face-cosmetics';
import { drawSegmentShape, readCustomSkinState, getSkinVisualProps, resolveShapeStyle, computeTaperRadius } from '@/components/panels/cosmetics/cosmetics-utils';
import type { CustomSegment } from '@/components/panels/cosmetics/cosmetics-types';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Compute body draw step based on current radius.
 *  Ensures segments overlap for solid continuous look at any size.
 *  Thinner snakes → tighter spacing (more segments drawn).
 *  Fatter snakes  → wider spacing  (fewer, larger circles). */
function bodyDrawStep(bodyRadius: number): number {
  return Math.max(bodyRadius * 1.5, 8);
}

/** Smoothed visual segment count per snake (prevents score-driven jitter).
 * Keyed by snake.id. Lerps toward target at ~10% per frame. */
const _smoothSegs = new Map<string, number>();

/** Clean up smoothed segment entries for a snake. */
export function clearSmoothedSegs(snakeId: string): void {
  _smoothSegs.delete(snakeId);
}

/** Get smoothed maxSegs — lerps toward raw target, returns rounded int. */
function getSmoothedMaxSegs(snakeId: string, rawMaxSegs: number): number {
  const prev = _smoothSegs.get(snakeId);
  if (prev === undefined) {
    _smoothSegs.set(snakeId, rawMaxSegs);
    return rawMaxSegs;
  }
  // Lerp at 10% per frame — takes ~23 frames (0.38s) to converge 90%
  const smoothed = prev + (rawMaxSegs - prev) * 0.1;
  _smoothSegs.set(snakeId, smoothed);
  return Math.round(smoothed);
}

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

/** Per-snake smoothed pupil state for lerp-based eye tracking */
const pupilSmoothMap: Map<string, { shiftX: number; shiftY: number; prevAngle: number; angleReady: boolean }> = new Map();

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
  mouseScreenX?: number,
  mouseScreenY?: number,
): void {
  // Skins with custom segments (presets equipped via localStorage or
  // custom-lab-skin) must use the fallback renderer which supports
  // per-segment shape / taper / glow.  The atlas path draws uniform
  // circle sprites and would lose those features.
  const customState = readCustomSkinState();
  const hasCustomSegments =
    customState?.useCustomSkin === true &&
    customState.currentSkin === snake.skinId &&
    (customState.customSkinSegments?.length ?? 0) > 0;

  // Pattern-based skins (neon, rainbow, metallic, etc.) need shape-aware rendering
  const patternVisuals = getSkinVisualProps(snake.skinId);

  if (snake.skinId === 'custom-lab-skin' || hasCustomSegments || patternVisuals) {
    renderSnakeFallback(ctx, snake, camera, viewport, time, mouseScreenX, mouseScreenY);
    return;
  }

  const atlas = atlasManager.getAtlas(snake.skinId);
  if (!atlas) {
    renderSnakeFallback(ctx, snake, camera, viewport, time, mouseScreenX, mouseScreenY);
    return;
  }

  const pathLen = snake.path.length;
  if (pathLen < 2) return;

  const headWx = snake.path.headX;
  const headWy = snake.path.headY;

  // ── Calculate logical body length (segments) using sqrt growth curve ──
  const logicalLen = computeBodyLength(snake.score);
  const visualLen = logicalLen * SEGMENT_SPACING;
  const step = bodyDrawStep(snake.bodyRadius);
  const rawMaxSegs = Math.ceil(visualLen / step);
  const maxSegs = getSmoothedMaxSegs(snake.id, rawMaxSegs);

  // Culling
  const cullMargin = visualLen + 100;
  if (headWx < viewport.left - cullMargin || headWx > viewport.right + cullMargin) return;
  if (headWy < viewport.top - cullMargin || headWy > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = snake.bodyRadius * zoom;

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

  // ── Walk path at dynamic step (based on radius), capped to maxSegs ──
  const walked = walkPathFixedStep(snake.path, step, maxSegs, snake.angle);

  // ── BOOST AURA: Full-body glow effect ──
  if (snake.boosting) {
    const boostPulse = 0.15 + 0.1 * Math.sin(time * 0.008);
    ctx.save();
    ctx.globalAlpha = boostPulse;
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = 25 * zoom;
    // Draw a thick line along the body for glow
    if (walked.count > 1) {
      ctx.strokeStyle = lightenHex(snake.color, 0.4);
      ctx.lineWidth = segRadius * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const s0 = worldToScreen(walked.xs[walked.count - 1], walked.ys[walked.count - 1], camera, cw, ch);
      ctx.moveTo(s0.x, s0.y);
      for (let i = walked.count - 2; i >= 0; i--) {
        const sp = worldToScreen(walked.xs[i], walked.ys[i], camera, cw, ch);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

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
  const headScreen = headVisible ? worldToScreen(headWx, headWy, camera, cw, ch) : null;
  const atlasHeadR = segRadius * 1.3;
  if (headVisible && headScreen) {
    const hsx = headScreen.x;
    const hsy = headScreen.y;
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

    // Direction pointer — thin line extending far ahead, shows where snake is steering
    drawDirectionPointer(ctx, snake.id, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2, snake.boosting);

    // Ultra-responsive eyes — track raw mouse position relative to head
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    const equipped = readEquippedCosmetics();
    const hasCustomEyes = equipped.eyes && equipped.eyes !== 'none';
    if (!hasCustomEyes) {
      drawResponsiveEyes(ctx, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2, snake.boosting, snake.id, time);
    }

    // Equipped face cosmetics (custom eyes draw here, others like hat/mouth always draw)
    renderEquippedCosmetics(ctx, { hx: hsx, hy: hsy, hr: headDrawSize / 2, angle: snake.angle, time, boosting: snake.boosting, mouseScreenX, mouseScreenY });

    // Boost speed lines — dramatic streaks behind the head
    if (snake.boosting && segRadius > 3) {
      const lineCount = 6;
      for (let j = 0; j < lineCount; j++) {
        const spread = (j - (lineCount - 1) / 2) * 0.25;
        const a = snake.angle + Math.PI + spread;
        const len = (20 + j * 8) * zoom;
        const alpha = 0.4 - j * 0.05;
        const lx = hsx - Math.cos(snake.angle) * headDrawSize / 2;
        const ly = hsy - Math.sin(snake.angle) * headDrawSize / 2;
        ctx.strokeStyle = `rgba(255, 200, 100, ${Math.max(alpha, 0.1)})`;
        ctx.lineWidth = (3 - j * 0.3) * zoom;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(a) * len, ly + Math.sin(a) * len);
        ctx.stroke();
      }
      // Head glow pulse when boosting
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 0.01);
      const hGlow = ctx.createRadialGradient(hsx, hsy, headDrawSize / 4, hsx, hsy, headDrawSize * 1.5);
      hGlow.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
      hGlow.addColorStop(1, 'rgba(255, 100, 50, 0)');
      ctx.fillStyle = hGlow;
      ctx.beginPath();
      ctx.arc(hsx, hsy, headDrawSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Name label — round to integer pixels to prevent sub-pixel text jitter.
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const nameX = Math.round(hsx);
      const nameY = Math.round(hsy - headDrawSize / 2 - 8 * zoom);
      ctx.fillText(snake.name, nameX, nameY);
    }

  }

  // ── Collision Points: connected chain — head diameter line + body squares ──
  // drawCollisionChain(
  //   ctx, headScreen, snake.angle, atlasHeadR,
  //   walked, segRadius, camera, cw, ch, vl, vr, vt, vb,
  // );

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
  now: number,
  mouseScreenX?: number,
  mouseScreenY?: number,
): void {
  const path = snake.path;
  const pathLen = path.length;
  if (pathLen < 2) return;

  // Read custom skin state once (may contain segments for presets or custom-lab-skin)
  const customState = readCustomSkinState();

  const headWorldX = path.headX;
  const headWorldY = path.headY;

  // ── Calculate logical body length using sqrt growth curve ──
  const logicalLen = computeBodyLength(snake.score);
  const visualLen = logicalLen * SEGMENT_SPACING;
  const step = bodyDrawStep(snake.bodyRadius);
  const rawMaxSegs = Math.ceil(visualLen / step);
  const maxSegs = getSmoothedMaxSegs(snake.id, rawMaxSegs);

  // Culling
  const cullMargin = visualLen + 100;
  if (headWorldX < viewport.left - cullMargin || headWorldX > viewport.right + cullMargin) return;
  if (headWorldY < viewport.top - cullMargin || headWorldY > viewport.bottom + cullMargin) return;

  const zoom = camera.zoom;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = snake.bodyRadius * zoom;

  // Spawn protection: smooth fade-in (no blinking)
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

  // ── Walk path at dynamic step (based on radius), capped to maxSegs ──
  const walked = walkPathFixedStep(path, step, maxSegs, snake.angle);

  // ── BOOST AURA: Full-body glow effect (fallback) ──
  if (snake.boosting) {
    const boostPulse = 0.15 + 0.1 * Math.sin(now * 0.008);
    ctx.save();
    ctx.globalAlpha = boostPulse;
    ctx.shadowColor = snake.color;
    ctx.shadowBlur = segRadius * 3;
    if (walked.count > 1) {
      ctx.strokeStyle = lightenHex(snake.color, 0.4);
      ctx.lineWidth = segRadius * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const s0x = walked.xs[walked.count - 1];
      const s0y = walked.ys[walked.count - 1];
      const scr0 = worldToScreen(s0x, s0y, camera, cw, ch);
      ctx.moveTo(scr0.x, scr0.y);
      for (let i = walked.count - 2; i >= 0; i--) {
        const scr = worldToScreen(walked.xs[i], walked.ys[i], camera, cw, ch);
        ctx.lineTo(scr.x, scr.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw body circles (tail → head for proper layering)
  // Multi-color skins alternate colors per segment
  const multiColor = isMultiColorSkin(snake.skinId);

  // Check for custom segments (presets or custom-lab-skin) with shapes/taper/glow
  let customSegments: CustomSegment[] | null = null;
  if (customState?.useCustomSkin === true &&
      customState.currentSkin === snake.skinId &&
      (customState.customSkinSegments?.length ?? 0) > 0) {
    customSegments = customState.customSkinSegments;
  }

  // Check for pattern-based visual props (manufactured skins with neon/rainbow/etc.)
  const patternVis = getSkinVisualProps(snake.skinId);

  // Drop shadow under the whole snake body
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = segRadius * 0.8;
  ctx.shadowOffsetY = segRadius * 0.3;

  if (customSegments) {
    // Detect stale first-segment override: if index 0 has a different sizeScale
    // than the rest (uniform body), normalize it to match.
    let segs = customSegments;
    if (segs.length > 1 && Math.abs(segs[0].sizeScale - segs[1].sizeScale) > 0.05) {
      // Check if the rest are roughly uniform
      let restUniform = true;
      const ref = segs[1].sizeScale;
      for (let k = 2; k < segs.length; k++) {
        if (Math.abs(segs[k].sizeScale - ref) > 0.1) { restUniform = false; break; }
      }
      if (restUniform) {
        segs = segs.map((s, idx) => idx === 0 ? { ...s, sizeScale: ref } : s);
      }
    }
    // Custom lab skin: draw shapes with taper and glow
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = worldToScreen(wx, wy, camera, cw, ch);
      const seg = segs[i % segs.length];
      const taperedR = segRadius * seg.sizeScale;
      const segAngle = walked.angles[i];
      drawSegmentShape(ctx, scr.x, scr.y, taperedR, segAngle, seg.shape, seg.color, seg.glow);
    }
  } else if (patternVis) {
    // Pattern-based skin: draw with shapes, taper, and glow from the shared mapping
    const pColors = patternVis.colors;
    const pBodyStyle = patternVis.bodyStyle;
    const pTaper = patternVis.taperStyle;
    const pGlow = patternVis.glow;
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = worldToScreen(wx, wy, camera, cw, ch);
      const segAngle = walked.angles[i];
      const segColor = pColors[i % pColors.length] ?? snake.color;
      const segShape = resolveShapeStyle(pBodyStyle, i);
      const taperedR = segRadius * computeTaperRadius(i, walked.count, pTaper);
      drawSegmentShape(ctx, scr.x, scr.y, taperedR, segAngle, segShape, segColor, pGlow);
    }
  } else if (multiColor) {
    // Per-segment color: draw each one individually with 3D gradient
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = worldToScreen(wx, wy, camera, cw, ch);
      const segColor = getSegmentColor(snake.skinId, i) ?? snake.color;
      const grad = ctx.createRadialGradient(scr.x - segRadius * 0.3, scr.y - segRadius * 0.3, segRadius * 0.1, scr.x, scr.y, segRadius);
      grad.addColorStop(0, lightenHex(segColor, 0.3));
      grad.addColorStop(0.5, segColor);
      grad.addColorStop(1, darkenHex(segColor, 0.3));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, segRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Per-segment 3D radial gradient (each segment needs its own gradient)
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = worldToScreen(wx, wy, camera, cw, ch);
      const grad = ctx.createRadialGradient(scr.x - segRadius * 0.3, scr.y - segRadius * 0.3, segRadius * 0.1, scr.x, scr.y, segRadius);
      grad.addColorStop(0, lightenHex(snake.color, 0.3));
      grad.addColorStop(0.5, snake.color);
      grad.addColorStop(1, darkenHex(snake.color, 0.3));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, segRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Reset shadow after drawing body
  ctx.restore();

  // ── Head ──
  // Detect uniform taper: head matches body size when everything is uniform
  let isUniformTaper = false;
  if (customSegments) {
    isUniformTaper = customSegments.every((s) => Math.abs(s.sizeScale - 1.0) < 0.01);
  } else if (patternVis) {
    isUniformTaper = patternVis.taperStyle === 'uniform';
  }
  const headScale = isUniformTaper ? 1.0 : 1.3;
  const headRadius = segRadius * headScale;
  if (headVisible) {
    // For pattern skins, use the pattern's primary color for the head
    const effectiveHeadColor = patternVis ? (patternVis.colors[0] ?? snake.headColor) : snake.headColor;
    // 3D head gradient
    const headGrad = ctx.createRadialGradient(headScreen.x - headRadius * 0.3, headScreen.y - headRadius * 0.3, headRadius * 0.05, headScreen.x, headScreen.y, headRadius);
    headGrad.addColorStop(0, lightenHex(effectiveHeadColor, 0.35));
    headGrad.addColorStop(0.55, effectiveHeadColor);
    headGrad.addColorStop(1, darkenHex(effectiveHeadColor, 0.35));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Direction pointer — thin line extending far ahead, shows where snake is steering
    drawDirectionPointer(ctx, snake.id, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting);

    // Responsive eyes — track raw mouse position relative to head
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    const eq2 = readEquippedCosmetics();
    const hasCustomEyes2 = eq2.eyes && eq2.eyes !== 'none';
    if (!hasCustomEyes2) {
      drawResponsiveEyes(ctx, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting, snake.id, now);
    }

    // Equipped face cosmetics (custom eyes draw here, others like hat/mouth always draw)
    renderEquippedCosmetics(ctx, { hx: headScreen.x, hy: headScreen.y, hr: headRadius, angle: snake.angle, time: now, boosting: snake.boosting, mouseScreenX, mouseScreenY });

    // Name — round to integer pixels to prevent sub-pixel text jitter.
    if (segRadius > 3) {
      ctx.fillStyle = snake.isPlayer ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const nameX = Math.round(headScreen.x);
      const nameY = Math.round(headScreen.y - headRadius - 8 * zoom);
      ctx.fillText(snake.name, nameX, nameY);
    }

  }

  // ── Collision Points: connected chain — head diameter line + body squares ──
  // drawCollisionChain(
  //   ctx, headVisible ? headScreen : null, snake.angle, headRadius,
  //   walked, segRadius, camera, cw, ch, vl, vr, vt, vb,
  // );

  ctx.globalAlpha = 1;
}

// ─── Collision Chain: connected head diameter line + body squares ───────────────

/**
 * Draw the full collision indicator chain for a snake.
 * 1. Head: straight line through the DIAMETER (center) of the head, perpendicular to direction
 * 2. Body: rotated squares at each segment center
 * 3. Connection: continuous polyline through all points — no gaps
 */
function drawCollisionChain(
  ctx: CanvasRenderingContext2D,
  headScr: { x: number; y: number } | null,
  headAngle: number,
  headR: number,
  walked: WalkResult,
  segRadius: number,
  camera: Camera,
  cw: number,
  ch: number,
  vl: number,
  vr: number,
  vt: number,
  vb: number,
): void {
  // Collect all visible collision point screen positions + angles
  // Index 0 = head, 1+ = body segments
  const totalPts = 1 + Math.max(0, walked.count - 1); // head + body (up to 2nd-last)
  if (totalPts < 2) return;

  const pts: { x: number; y: number; a: number; r: number }[] = [];

  // Head point
  if (headScr) {
    pts.push({ x: headScr.x, y: headScr.y, a: headAngle, r: headR });
  }

  // Body points (walked 0 to count-2)
  const bodyEnd = Math.max(0, walked.count - 1);
  for (let i = 0; i < bodyEnd; i++) {
    const wx = walked.xs[i];
    const wy = walked.ys[i];
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
    const scr = worldToScreen(wx, wy, camera, cw, ch);
    pts.push({ x: scr.x, y: scr.y, a: walked.angles[i], r: segRadius });
  }

  if (pts.length < 2) return;

  const sqHalf = segRadius * 0.55; // half-side of the collision square

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
  ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ── 1. Connecting polyline through all centers (no gaps) ──
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();

  // ── 2. Head: diameter line through center, along direction (head→body) ──
  if (pts[0].r > 0) {
    const hp = pts[0];
    const hHalf = hp.r * 0.75;
    ctx.beginPath();
    ctx.moveTo(hp.x - Math.cos(hp.a) * hHalf, hp.y - Math.sin(hp.a) * hHalf);
    ctx.lineTo(hp.x + Math.cos(hp.a) * hHalf, hp.y + Math.sin(hp.a) * hHalf);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Black dot at front end of diameter
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hp.x + Math.cos(hp.a) * hHalf, hp.y + Math.sin(hp.a) * hHalf, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)'; // restore red fill for squares
    ctx.lineWidth = 1.8; // restore
  }

  // ── 3. Body: rotated squares at each segment ──
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.beginPath();
    ctx.rect(-sqHalf, -sqHalf, sqHalf * 2, sqHalf * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ─── Direction Pointer (thin needle extending far ahead) ──────────────────
// Like slither.io, the mouse cursor IS the primary direction indicator.
// This pointer is just a subtle visual aid — a thin line extending from the
// head in the direction the snake is turning, so you can see the turn intent.

function drawDirectionPointer(
  ctx: CanvasRenderingContext2D,
  snakeId: string,
  hx: number,
  hy: number,
  faceAngle: number,
  steerAngle: number,
  headRadius: number,
  boosting: boolean,
): void {
  // steerAngle is already smoothed by the game loop — use directly

  // How much the steering deviates from current facing
  let steerDiff = steerAngle - faceAngle;
  while (steerDiff > Math.PI) steerDiff -= 2 * Math.PI;
  while (steerDiff < -Math.PI) steerDiff += 2 * Math.PI;

  const absDiff = Math.abs(steerDiff);

  // Line grows slightly with snake size: base 5x headRadius, scales up to 7x at large sizes
  // headRadius ranges from ~6 (start) to ~31 (100K score)
  const sizeScale = Math.min(1.4, 1.0 + (headRadius - 6) * 0.015);
  const lineLen = headRadius * 5.0 * sizeScale;
  const startDist = headRadius * 1.1;
  const endDist = startDist + lineLen;

  // Start point: just in front of the head
  const sx = hx + Math.cos(faceAngle) * startDist;
  const sy = hy + Math.sin(faceAngle) * startDist;

  // Tip points in the steer direction (clamped to 60° off face)
  const maxDeflection = Math.PI / 3;
  const clampedDiff = Math.max(-maxDeflection, Math.min(maxDeflection, steerDiff));
  const tipAngle = faceAngle + clampedDiff;
  const ex = hx + Math.cos(tipAngle) * endDist;
  const ey = hy + Math.sin(tipAngle) * endDist;

  // Midpoint — blend between face and steer direction
  const midDist = startDist + lineLen * 0.5;
  const midAngle = faceAngle + clampedDiff * 0.4;
  const mx = hx + Math.cos(midAngle) * midDist;
  const my = hy + Math.sin(midAngle) * midDist;

  // Opacity: always visible (subtle when straight, brighter when turning/boosting)
  const turnIntensity = Math.min(absDiff / 0.6, 1.0);
  const alpha = boosting ? 0.7 : 0.15 + 0.45 * turnIntensity;
  const lineW = boosting ? 2.5 : 1.5;

  // Direction line — invisible
  ctx.strokeStyle = `rgba(255, 255, 255, 0)`;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Arrowhead at the tip
  const arrowLen = headRadius * 0.9 * sizeScale;
  const arrowHalfAngle = 0.4; // ~23° spread
  const arrowAlpha = Math.min(alpha * 1.1, 0.85);

  ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - Math.cos(tipAngle - arrowHalfAngle) * arrowLen,
    ey - Math.sin(tipAngle - arrowHalfAngle) * arrowLen,
  );
  ctx.lineTo(
    ex - Math.cos(tipAngle + arrowHalfAngle) * arrowLen,
    ey - Math.sin(tipAngle + arrowHalfAngle) * arrowLen,
  );
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
  boosting: boolean,
  snakeId: string,
  time?: number,
): void {
  // Eye positioning — on the face of the snake
  const eyeOffset = headRadius * 0.42;
  const eyeRadius = headRadius * 0.38;
  let pupilRadius = eyeRadius * 0.52;
  const perpAngle = moveAngle + Math.PI / 2;
  const eyeForward = headRadius * 0.32;
  const maxShift = eyeRadius * 0.85;

  // ── SMOOTHING STATE (per-snake, keyed by snake ID) ──
  let smooth = pupilSmoothMap.get(snakeId);
  if (!smooth) {
    smooth = { shiftX: 0, shiftY: 0, prevAngle: moveAngle, angleReady: false };
    pupilSmoothMap.set(snakeId, smooth);
  }
  // Prune stale entries (keep map small)
  if (pupilSmoothMap.size > 50) {
    const keys = [...pupilSmoothMap.keys()];
    for (let i = 0; i < keys.length - 20; i++) pupilSmoothMap.delete(keys[i]);
  }

  // ── BLINK SYSTEM ──
  // 6 blinks per minute = 1 blink every 10000ms, with ±1000ms randomness
  // Use snakeId for a stable seed (head position changes every frame!)
  let idHash = 0;
  for (let i = 0; i < snakeId.length; i++) idHash = ((idHash << 5) - idHash + snakeId.charCodeAt(i)) | 0;
  const blinkSeed = Math.abs(idHash) % 1000;
  const blinkCycle = 9000 + (blinkSeed % 2000); // 9000-11000ms
  const blinkDuration = 120; // snappy blink
  const blinkPhase = time ? (time + blinkSeed * 3) % blinkCycle : 99999;
  const isBlinking = blinkPhase < blinkDuration;

  // ── BOOST: dilated pupils only — visual effects applied in drawing loop below ──
  if (boosting) {
    pupilRadius = eyeRadius * 0.6;
  }

  // ── PUPIL TRACKING: circular, works for both normal and boost ──
  // Direction: where the snake is steering (full 360°, not just left/right)
  // Magnitude: combo of steering delta + angular velocity for sustained shift
  let angVel = 0;
  if (smooth.angleReady) {
    angVel = moveAngle - smooth.prevAngle;
    while (angVel > Math.PI) angVel -= 2 * Math.PI;
    while (angVel < -Math.PI) angVel += 2 * Math.PI;
  }
  smooth.prevAngle = moveAngle;
  smooth.angleReady = true;

  // Steering delta for circular DIRECTION
  let deltaAngle = targetAngle - moveAngle;
  while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
  while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
  const absDelta = Math.abs(deltaAngle);
  const absVel = Math.abs(angVel);

  // Look direction: use the full target direction (circular!), default to forward when idle
  const lookDir = absDelta < 0.06
    ? moveAngle        // idle → look forward
    : targetAngle;    // steering → look toward where we're going

  // Magnitude: combine steering delta with angular velocity
  // Angular velocity keeps the shift alive during sustained turns
  // Threshold 0.060 calibrated for BASE_TURN_RATE=0.120 (half the max rate
  // gives ~50% contribution at moderate turns — responsive without saturation).
  const angVelContrib = Math.min(1, absVel / 0.060);
  const deltaContrib = Math.min(1, absDelta / (Math.PI / 2.5));
  const combinedMag = Math.min(1, Math.max(deltaContrib, angVelContrib * 0.75));

  // Deadzone: don't shift for tiny inputs
  const DEADZONE = 0.08;
  const shiftRatio = combinedMag < DEADZONE ? 0
    : Math.min(1, (combinedMag - DEADZONE) / (1 - DEADZONE));
  const pupilShift = maxShift * shiftRatio;

  // Target offset in world space (circular — any angle!)
  const targetShiftX = Math.cos(lookDir) * pupilShift;
  const targetShiftY = Math.sin(lookDir) * pupilShift;

  // ── ASYMMETRIC LERP: fast out, slow return ──
  // Snappier than before to compensate for heavier steering inertia —
  // the eyes should be the responsive counterpoint to the heavy body.
  // Moving outward (toward target): snappy 0.18
  // Returning to center: moderate 0.06
  const targetDist = Math.sqrt(targetShiftX * targetShiftX + targetShiftY * targetShiftY);
  const currentDist = Math.sqrt(smooth.shiftX * smooth.shiftX + smooth.shiftY * smooth.shiftY);
  const isReturning = targetDist < currentDist;
  const LERP_OUT = 0.18;
  const LERP_BACK = 0.06;
  const lerpSpeed = isReturning ? LERP_BACK : LERP_OUT;
  smooth.shiftX += (targetShiftX - smooth.shiftX) * lerpSpeed;
  smooth.shiftY += (targetShiftY - smooth.shiftY) * lerpSpeed;

  // Tiny damping to prevent drift: gently pull toward zero when very close
  if (shiftRatio === 0 && currentDist > 0.05) {
    smooth.shiftX *= 0.97;
    smooth.shiftY *= 0.97;
  }

  for (const side of [-1, 1]) {
    const ex = hx + Math.cos(moveAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(moveAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

    if (isBlinking) {
      // ── BLINK: thin eyelid arcs (top + bottom) closing inward ──
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      // Top eyelid arc
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius * 0.75, moveAngle - 0.35, moveAngle + 0.35);
      ctx.stroke();
      // Bottom eyelid arc (slightly offset)
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius * 0.75, moveAngle + Math.PI - 0.35, moveAngle + Math.PI + 0.35);
      ctx.stroke();
      continue;
    }

    // Eye white with border
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil — smoothly shifted via lerp
    const px = ex + smooth.shiftX;
    const py = ey + smooth.shiftY;

    ctx.fillStyle = boosting ? '#cc1111' : '#111111';
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tiny highlight for life-like look
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(px - pupilRadius * 0.3, py - pupilRadius * 0.35, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Boost: pulsing red glow ring
    if (boosting) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin((time ?? Date.now()) * 0.01);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r + (255 - r) * factor);
  const ng = Math.round(g + (255 - g) * factor);
  const nb = Math.round(b + (255 - b) * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const nr = Math.round(r * (1 - factor));
  const ng = Math.round(g * (1 - factor));
  const nb = Math.round(b * (1 - factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function getAnimationForSkin(skinId: string): string {
  // Built-in atlas skins with known animations
  const map: Record<string, string> = {
    'skin-neon-pink': 'pulse',
    'skin-arctic': 'flow',
    'skin-lava-core': 'lava',
    'skin-cyber-phantom': 'cyberpulse',
    'skin-gold': 'glow',
    'skin-crimson': 'glow',
    'skin-neonglow': 'pulse',
    'skin-rainbow': 'flow',
  };
  return map[skinId] ?? 'none';
}

export function cleanupSnakeParticles(snakeId: string): void {
  particlePools.delete(snakeId);
  pupilSmoothMap.delete(snakeId);
}
