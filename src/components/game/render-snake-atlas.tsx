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
import type { SkinAtlasManager } from '@/lib/snake/atlas';
import { LEGENDARY_EMITTER_CONFIG } from '@/lib/snake/atlas';
import { isMultiColorSkin, getSegmentColor } from '@/lib/snake/skin-registry';
import { renderEquippedCosmetics, readEquippedCosmetics } from '@/lib/snake/face-cosmetics';
import { drawSegmentShape, readCustomSkinState, getSkinVisualProps, resolveShapeStyle, computeTaperRadius } from '@/components/panels/cosmetics/cosmetics-utils';
import type { CustomSegment } from '@/components/panels/cosmetics/cosmetics-types';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Fixed pixel spacing between drawn body segments (world space).
 *  Should be slightly less than SNAKE_RADIUS*2 for overlap → solid continuous look.
 *  Adjusted for the fatter snake (RADIUS=12). */
const BODY_DRAW_STEP = 14;

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

    // Direction pointer — thin line extending far ahead, shows where snake is steering
    drawDirectionPointer(ctx, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2, snake.boosting);

    // Ultra-responsive eyes — track raw mouse position relative to head
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    const equipped = readEquippedCosmetics();
    const hasCustomEyes = equipped.eyes && equipped.eyes !== 'none';
    if (!hasCustomEyes) {
      drawResponsiveEyes(ctx, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2, snake.boosting, mouseScreenX, mouseScreenY, time);
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
    // Custom lab skin: draw shapes with taper and glow
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = worldToScreen(wx, wy, camera, cw, ch);
      const seg = customSegments[i % customSegments.length];
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
  const headRadius = segRadius * 1.3;
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
    drawDirectionPointer(ctx, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting);

    // Responsive eyes — track raw mouse position relative to head
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    const eq2 = readEquippedCosmetics();
    const hasCustomEyes2 = eq2.eyes && eq2.eyes !== 'none';
    if (!hasCustomEyes2) {
      drawResponsiveEyes(ctx, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting, mouseScreenX, mouseScreenY, now);
    }

    // Equipped face cosmetics (custom eyes draw here, others like hat/mouth always draw)
    renderEquippedCosmetics(ctx, { hx: headScreen.x, hy: headScreen.y, hr: headRadius, angle: snake.angle, time: now, boosting: snake.boosting, mouseScreenX, mouseScreenY });

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

// ─── Direction Pointer (thin needle extending far ahead) ──────────────────
// Like slither.io, the mouse cursor IS the primary direction indicator.
// This pointer is just a subtle visual aid — a thin line extending from the
// head in the direction the snake is turning, so you can see the turn intent.

function drawDirectionPointer(
  ctx: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  faceAngle: number,
  steerAngle: number,
  headRadius: number,
  boosting: boolean,
): void {
  // How much the steering deviates from current facing
  let steerDiff = steerAngle - faceAngle;
  while (steerDiff > Math.PI) steerDiff -= 2 * Math.PI;
  while (steerDiff < -Math.PI) steerDiff += 2 * Math.PI;

  const absDiff = Math.abs(steerDiff);

  // Line starts just past the head edge, extends forward
  const startDist = headRadius * 1.1;
  const lineLen = headRadius * 3.5;
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

  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Small dot at tip for visibility
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha * 1.2, 1)})`;
  ctx.beginPath();
  ctx.arc(ex, ey, lineW * 1.2, 0, Math.PI * 2);
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
  mouseScreenX?: number,
  mouseScreenY?: number,
  time?: number,
): void {
  // Eye positioning — on the face of the snake
  const eyeOffset = headRadius * 0.42;
  const eyeRadius = headRadius * 0.38;
  let pupilRadius = eyeRadius * 0.52;
  const perpAngle = moveAngle + Math.PI / 2;
  const eyeForward = headRadius * 0.32;
  const maxShift = eyeRadius * 0.7;

  // ── BLINK SYSTEM ──
  // Each snake blinks every 3-5 seconds for ~150ms.
  // Use head position as a seed so different snakes blink at different times.
  const blinkSeed = Math.abs(Math.round(hx * 7 + hy * 13)) % 1000;
  const blinkCycle = 3000 + (blinkSeed % 2000); // 3-5 second cycle
  const blinkDuration = 150;
  const blinkPhase = time ? (time + blinkSeed * 3) % blinkCycle : 99999;
  const isBlinking = blinkPhase < blinkDuration;

  // ── BOOST MODE: locked forward, dilated pupils, intense ──
  if (boosting) {
    pupilRadius = eyeRadius * 0.6; // dilated pupils when boosting

    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(moveAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
      const ey = hy + Math.sin(moveAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

      // Eye white
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil — LOCKED FORWARD at max extension
      const px = ex + Math.cos(moveAngle) * maxShift;
      const py = ey + Math.sin(moveAngle) * maxShift;
      ctx.fillStyle = '#cc1111';
      ctx.beginPath();
      ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(px - pupilRadius * 0.3, py - pupilRadius * 0.35, pupilRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing red glow ring
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin((time ?? Date.now()) * 0.01);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  // ── NORMAL MODE: deadzone, relative tracking, center rest ──
  // Compute look angle relative to head direction.
  // This way even small mouse offsets from the forward line produce visible pupil shift.
  let deltaAngle = 0;
  if (mouseScreenX !== undefined && mouseScreenY !== undefined) {
    const dx = mouseScreenX - hx;
    const dy = mouseScreenY - hy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      const rawLook = Math.atan2(dy, dx);
      deltaAngle = rawLook - moveAngle;
      // Normalize to [-PI, PI]
      while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
      while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
    }
  } else {
    // Keyboard/touch fallback: use targetAngle relative to moveAngle
    deltaAngle = targetAngle - moveAngle;
    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
  }

  const absDelta = Math.abs(deltaAngle);

  // Deadzone + gradual shift:
  //   |delta| < 0.12 rad (~7°)  → shift = 0     (center rest)
  //   |delta| < 0.45 rad (~26°) → shift = lerp   (gradual)
  //   |delta| >= 0.45 rad       → shift = max    (full extension)
  const DEADZONE = 0.12;
  const FULL_ZONE = 0.45;
  let shiftRatio: number;
  if (absDelta < DEADZONE) {
    shiftRatio = 0;
  } else if (absDelta < FULL_ZONE) {
    shiftRatio = (absDelta - DEADZONE) / (FULL_ZONE - DEADZONE);
  } else {
    shiftRatio = 1;
  }
  const pupilShift = maxShift * shiftRatio;

  // The direction the pupil shifts toward (clamped delta, 0 when in deadzone)
  const lookDir = absDelta < 0.001 ? moveAngle : moveAngle + deltaAngle;

  // ── Micro-idle jitter: tiny random pupil wobble when centered ──
  let jitterX = 0, jitterY = 0;
  if (shiftRatio < 0.3 && time) {
    const jt = time * 0.002 + blinkSeed;
    jitterX = Math.sin(jt * 3.7) * 0.8;
    jitterY = Math.cos(jt * 2.3) * 0.6;
  }

  for (const side of [-1, 1]) {
    const ex = hx + Math.cos(moveAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(moveAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

    if (isBlinking) {
      // ── BLINK: draw a thin curved line instead of full eye ──
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius * 0.8, moveAngle - 0.6, moveAngle + 0.6);
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

    // Pupil — shifted based on deadzone/gradual system
    const px = ex + Math.cos(lookDir) * pupilShift + jitterX;
    const py = ey + Math.sin(lookDir) * pupilShift + jitterY;

    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tiny highlight for life-like look
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(px - pupilRadius * 0.3, py - pupilRadius * 0.35, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
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
}
