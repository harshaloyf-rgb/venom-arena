// ============================================================================
// Atlas-based Snake Renderer + Fallback Renderer — SHARED — used by both offline and online modes.
// ============================================================================

import type { Camera, Snake, Viewport } from '@/lib/snake/types';
import { SEGMENT_SPACING, SPAWN_PROTECTION_MS, LEGENDARY_GLOW_SIZE } from '@/lib/snake/config';
import { worldToScreen, worldToScreenSnapped } from '@/lib/snake/camera';
import type { SkinAtlasManager } from '@/lib/snake/atlas';
import { LEGENDARY_EMITTER_CONFIG } from '@/lib/snake/atlas';
import { isMultiColorSkin, getSegmentColor } from '@/lib/snake/skin-registry';
import { renderEquippedCosmetics, readEquippedCosmetics, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';
import { drawSegmentShape, readCustomSkinState, getSkinVisualProps, getPresetVisualProps, resolveShapeStyle, computeTaperRadius, setSpriteDpr } from '@/components/panels/cosmetics/cosmetics-utils';
import type { CustomSkinState } from '@/components/panels/cosmetics/cosmetics-types';
import type { CustomSegment } from '@/components/panels/cosmetics/cosmetics-types';
import { incrementCoilFrame } from './coil-path';

// ─── Constants ─────────────────────────────────────────────────────────────

/** P7: Compute body draw step based on current radius and zoom.
 *  Ensures segments overlap for solid continuous look at any size/zoom.
 *  At low zoom, divides by min(zoom,1) to draw more segments (prevents dotted lines).
 *  Viewport culling limits actual draw count so the extra segments are cheap. */
function bodyDrawStep(bodyRadius: number, zoom: number = 1): number {
  const base = Math.max(bodyRadius * 1.3, 4);
  return base / Math.min(zoom, 1);
}

/** Smoothed visual segment count per snake (prevents score-driven jitter).
 * Keyed by snake.id. Lerps toward target at ~10% per frame.
 * FIX #13: Pruned every frame to prevent unbounded growth from bot respawns. */
const _smoothSegs = new Map<string, number>();
const _SMOOTH_SEGS_MAX = 1100; // 999 bots + player + margin

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

// ─── Per-frame caches (avoid localStorage reads every snake) ───────────────

let _frameEquipped: { data: EquippedCosmetics; frame: number } | null = null;
let _frameCustomSkin: { data: CustomSkinState | null; frame: number } | null = null;
let _frameCounter = 0;

// ─── Pre-rendered gradient circle cache ────────────────────────────────────
// Key: "color|r|dpr" → OffscreenCanvas with 3D gradient circle.
// Avoids creating 700+ createRadialGradient objects per frame for bot segments.
// drawImage from cached canvas is a GPU-accelerated blit — orders of magnitude
// faster than gradient creation + fill.

const _circleCache = new Map<string, OffscreenCanvas | HTMLCanvasElement>();
const _CIRCLE_CACHE_MAX = 64;

function getCachedGradientCircle(color: string, r: number, dpr: number): OffscreenCanvas | HTMLCanvasElement {
  const key = `${color}|${Math.round(r)}|${dpr}`;
  let cached = _circleCache.get(key);
  if (cached) return cached;

  const diameter = Math.ceil(r * 2 * dpr) + 2;
  const oc = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(diameter, diameter)
    : document.createElement('canvas');
  if (!(oc instanceof OffscreenCanvas)) { (oc as HTMLCanvasElement).width = diameter; (oc as HTMLCanvasElement).height = diameter; }

  const cx = oc.getContext('2d')!;
  const half = diameter / (2 * dpr);
  cx.scale(dpr, dpr);

  // 3D radial gradient
  const grad = cx.createRadialGradient(
    half - r * 0.3, half - r * 0.3, r * 0.1,
    half, half, r,
  );
  grad.addColorStop(0, lightenHex(color, 0.3));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darkenHex(color, 0.3));
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(half, half, r, 0, Math.PI * 2);
  cx.fill();

  // Evict old entries if cache is full
  if (_circleCache.size >= _CIRCLE_CACHE_MAX) {
    const firstKey = _circleCache.keys().next().value;
    if (firstKey !== undefined) _circleCache.delete(firstKey);
  }
  _circleCache.set(key, oc);
  return oc;
}

/** Get device pixel ratio (cached per frame) */
let _cachedDpr = 1;
export function setCachedDpr(dpr: number): void { _cachedDpr = dpr; }
/** Call once at the start of each render frame to invalidate caches. */
export function beginRenderFrame(): void {
  _frameCounter++;
  incrementCoilFrame();
  // FIX #13: Prune _smoothSegs to prevent unbounded Map growth
  if (_smoothSegs.size > _SMOOTH_SEGS_MAX) {
    let toRemove = _smoothSegs.size - _SMOOTH_SEGS_MAX;
    for (const key of _smoothSegs.keys()) {
      if (toRemove-- <= 0) break;
      _smoothSegs.delete(key);
    }
  }
}

/** Set DPR for both gradient circle cache and glow sprite cache. */
export function beginRenderFrameWithDpr(dpr: number): void {
  setCachedDpr(dpr);
  setSpriteDpr(dpr);
  beginRenderFrame();
}

/** Cached readEquippedCosmetics — reads localStorage at most once per frame. */
function getCachedEquipped(): EquippedCosmetics {
  if (_frameEquipped && _frameEquipped.frame === _frameCounter) return _frameEquipped.data;
  const data = readEquippedCosmetics();
  _frameEquipped = { data, frame: _frameCounter };
  return data;
}

/** Cached readCustomSkinState — reads localStorage at most once per frame. */
function getCachedCustomSkinState(): CustomSkinState | null {
  if (_frameCustomSkin && _frameCustomSkin.frame === _frameCounter) return _frameCustomSkin.data;
  const data = readCustomSkinState();
  _frameCustomSkin = { data, frame: _frameCounter };
  return data;
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
const pupilSmoothMap: Map<string, { shiftX: number; shiftY: number; prevAngle: number; angleReady: boolean; smoothAngle: number; prevSmoothAngle: number }> = new Map();

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

// ─── Bot Walk Cache (REMOVED) ────────────────────────────────────────────
// Bot walk cache was eliminated: caching walked positions for 2 frames caused
// visible head-body separation because the head is rendered at a fresh position
// each frame while cached body positions were 1-2 ticks stale. The walk function
// already uses a shared _walker state + pre-allocated _walkResult buffer, so
// the per-frame walk cost is minimal (~1-2ms for 13 visible bots).

function walkPathFixedStep(
  path: { getX: (i: number) => number; getY: (i: number) => number; length: number; headX: number; headY: number },
  step: number,
  maxSegs: number,
  headAngle: number,
  maxWorldDist?: number,
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
  // P2: If maxWorldDist is set, stop walking once cumulative distance exceeds it.
  // This prevents walking 10,000+ path points for long snakes when only ~200
  // segments could possibly be visible on screen.
  const hasDistLimit = maxWorldDist !== undefined && maxWorldDist > 0;
  let cumDist = 0;

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

    // P2: Early exit for viewport-culled walking.
    // Once we've walked far enough that no more segments could be visible,
    // stop. The first segment (head) is at cumDist=0.
    if (hasDistLimit) {
      cumDist += step;
      if (cumDist > maxWorldDist!) break;
    }

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
  snap?: boolean,
  alpha: number = 1.0,
  coiledPath?: PathLike,
): void {
  // Use coiled path for body rendering if provided
  const effectivePath = coiledPath ?? snake.path;

  // Skins with custom segments (presets equipped via localStorage or
  // custom-lab-skin) must use the fallback renderer which supports
  // per-segment shape / taper / glow.  The atlas path draws uniform
  // circle sprites and would lose those features.
  const customState = getCachedCustomSkinState();
  const hasCustomSegments =
    customState?.useCustomSkin === true &&
    customState.currentSkin === snake.skinId &&
    (customState.customSkinSegments?.length ?? 0) > 0;

  // Pattern-based skins (neon, rainbow, metallic, etc.) need shape-aware rendering
  const patternVisuals = getSkinVisualProps(snake.skinId);

  // Preset skins (preset-fish, preset-lion, etc.) need shape-aware rendering too
  const presetVisuals = !patternVisuals ? getPresetVisualProps(snake.skinId) : null;

  if (snake.skinId === 'custom-lab-skin' || hasCustomSegments || patternVisuals || presetVisuals) {
    renderSnakeFallback(ctx, snake, camera, viewport, time, mouseScreenX, mouseScreenY, snap, alpha, effectivePath);
    return;
  }

  const atlas = atlasManager.getAtlas(snake.skinId);
  if (!atlas) {
    renderSnakeFallback(ctx, snake, camera, viewport, time, mouseScreenX, mouseScreenY, snap, alpha, effectivePath);
    return;
  }

  const pathLen = effectivePath.length;
  if (pathLen < 2) return;

  const headWx = effectivePath.headX;
  const headWy = effectivePath.headY;

  // Guard against non-finite values (can happen with online mode interpolation)
  if (!Number.isFinite(headWx) || !Number.isFinite(headWy)) return;
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) return;

  const zoom = camera.zoom;

  // ── Calculate logical body length using cached value (avoids Math.log per frame) ──
  const logicalLen = snake.cachedBodyLength;
  const visualLen = logicalLen * SEGMENT_SPACING;
  const step = bodyDrawStep(snake.bodyRadius, zoom);
  const rawMaxSegs = Math.ceil(visualLen / step);
  const maxSegs = getSmoothedMaxSegs(snake.id, rawMaxSegs);

  // Culling
  const cullMargin = visualLen + 100;
  if (headWx < viewport.left - cullMargin || headWx > viewport.right + cullMargin) return;
  if (headWy < viewport.top - cullMargin || headWy > viewport.bottom + cullMargin) return;
  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = snake.bodyRadius * zoom;

  // P3 FIX #10: Non-linear head scale — large snakes have proportionally smaller heads
  // Small snakes: 15% bigger head, large snakes: ~5% bigger head
  const headScale = isMultiColorSkin(snake.skinId)
    ? 1.0
    : 1.15 - 0.1 * Math.log2(1 + snake.score / 1000);
  const clampedHeadScale = Math.max(1.0, Math.min(1.15, headScale));

  // FIX 1: Render-time interpolation offset.
  // Shifts the entire snake to match the camera's interpolated head position,
  // eliminating the camera/body desync that causes visible jitter.
  const interpHeadX = snake.prevHeadX + (snake.path.headX - snake.prevHeadX) * alpha;
  const interpHeadY = snake.prevHeadY + (snake.path.headY - snake.prevHeadY) * alpha;
  const renderOffX = (interpHeadX - snake.path.headX) * zoom;
  const renderOffY = (interpHeadY - snake.path.headY) * zoom;
  const w2sOff = (wx: number, wy: number) => {
    const r = worldToScreen(wx, wy, camera, cw, ch);
    r.x += renderOffX;
    r.y += renderOffY;
    return r;
  };

  const vl = viewport.left - 40;
  const vr = viewport.right + 40;
  const vt = viewport.top - 40;
  const vb = viewport.bottom + 40;

  // ── Head visibility & screen pos (needed by spawn shield + head rendering) ──
  const headVisible = headWx >= vl && headWx <= vr && headWy >= vt && headWy <= vb;
  const headScreen = headVisible ? w2sOff(headWx, headWy) : null;
  const atlasHeadR = segRadius * clampedHeadScale;

  // ── Spawn shield: rotating hexagonal ring that fades out ──
  const spawnAge = time - snake.spawnTime;
  if (spawnAge < SPAWN_PROTECTION_MS && headScreen) {
    const t = spawnAge / SPAWN_PROTECTION_MS;
    const shieldAlpha = 1 - t;
    const shieldR = atlasHeadR * (2.2 + 0.3 * Math.sin(time * 0.006));
    const rot = time * 0.003;
    const sides = 6;
    ctx.save();
    ctx.globalAlpha = shieldAlpha * 0.6;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2 * zoom;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = headScreen.x + Math.cos(a) * shieldR;
      const py = headScreen.y + Math.sin(a) * shieldR;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = shieldAlpha * 0.15;
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
    ctx.globalAlpha = shieldAlpha * 0.35;
    ctx.strokeStyle = '#80f0ff';
    ctx.lineWidth = 1 * zoom;
    const shieldR2 = shieldR * 0.75;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = -rot * 1.5 + (i / sides) * Math.PI * 2 + 0.5;
      const px = headScreen.x + Math.cos(a) * shieldR2;
      const py = headScreen.y + Math.sin(a) * shieldR2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.5 + 0.5 * t;
  }

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
  // P2: maxWorldDist limits walk distance for long snakes.
  const vpDiag = Math.sqrt(cw * cw + ch * ch) / zoom;
  const walked = walkPathFixedStep(effectivePath, step, maxSegs, snake.angle, vpDiag + 500);

  // ── BOOST AURA: Full-body glow effect ──
  if (snake.boosting) {
    const boostPulse = 0.15 + 0.1 * Math.sin(time * 0.008);
    ctx.save();
    ctx.globalAlpha = boostPulse;
    // Draw a thick line along the body for glow (no shadowBlur — too expensive)
    if (walked.count > 1) {
      ctx.strokeStyle = lightenHex(snake.color, 0.4);
      ctx.lineWidth = segRadius * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const s0 = w2sOff(walked.xs[walked.count - 1], walked.ys[walked.count - 1]);
      ctx.moveTo(s0.x, s0.y);
      for (let i = walked.count - 2; i >= 0; i--) {
        const sp = w2sOff(walked.xs[i], walked.ys[i]);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Draw body segments (tail → head for proper layering) ──
  // PERF FIX: Replace per-segment save/translate/rotate/restore with setTransform.
  // save/restore pushes/pops entire canvas state (~1μs each × 200 segments = 200μs).
  // setTransform just sets 6 numbers directly (~0.1μs each). Also inlines
  // worldToScreen math to avoid 200 object allocations per frame.
  const drawSize = segRadius * 2;
  const halfDraw = drawSize / 2;
  const camZoomX = cw / 2 - camera.x * zoom;
  const camZoomY = ch / 2 - camera.y * zoom;
  const bodyLen = atlas.body.length;
  const hasEpicEffect = isEpic && animation;
  for (let i = walked.count - 1; i >= 0; i--) {
    const wx = walked.xs[i];
    const wy = walked.ys[i];
    if (wx < vl || wx > vr || wy < vt || wy > vb) continue;

    // Inline worldToScreen + renderOffset (avoids object allocation)
    const sx = (wx - camera.x) * zoom + camZoomX + renderOffX;
    const sy = (wy - camera.y) * zoom + camZoomY + renderOffY;
    const segAngle = walked.angles[i];

    const bodyIdx = i % bodyLen;
    const region = atlas.body[bodyIdx];

    if (hasEpicEffect) {
      // Epic/legendary effects need save/restore for globalAlpha changes
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(segAngle);
      atlasManager.applyEpicEffect(ctx, animation, time, 0, 0, drawSize, snake.color);
      ctx.drawImage(atlas.canvas, region.x, region.y, region.width, region.height, -halfDraw, -halfDraw, drawSize, drawSize);
      atlasManager.resetEpicEffect(ctx);
      ctx.restore();
    } else {
      // Standard skin: use setTransform (much faster than save/translate/rotate/restore)
      const cosA = Math.cos(segAngle);
      const sinA = Math.sin(segAngle);
      ctx.setTransform(cosA * _cachedDpr, sinA * _cachedDpr, -sinA * _cachedDpr, cosA * _cachedDpr, sx * _cachedDpr, sy * _cachedDpr);
      ctx.drawImage(atlas.canvas, region.x, region.y, region.width, region.height, -halfDraw, -halfDraw, drawSize, drawSize);
    }
  }
  // Reset transform to base DPR scale after setTransform usage
  ctx.setTransform(_cachedDpr, 0, 0, _cachedDpr, 0, 0);

  // ── Head ──
  if (headVisible && headScreen) {
    const hsx = headScreen.x;
    const hsy = headScreen.y;
    const headDrawSize = segRadius * 2 * 1.05;

    // Legendary glow underlay — only for epic/legendary (rare, acceptable cost)
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

    // ── Spawn shield: rotating hexagonal ring that fades out ──
    const spawnAge2 = time - snake.spawnTime;
    if (spawnAge2 < SPAWN_PROTECTION_MS) {
      const t = spawnAge2 / SPAWN_PROTECTION_MS;
      const shieldAlpha = 1 - t;
      const shieldR = atlasHeadR * (2.2 + 0.3 * Math.sin(time * 0.006));
      const rot = time * 0.003;
      const sides = 6;
      ctx.save();
      ctx.globalAlpha = shieldAlpha * 0.6;
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2 * zoom;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = rot + (i / sides) * Math.PI * 2;
        const px = hsx + Math.cos(a) * shieldR;
        const py = hsy + Math.sin(a) * shieldR;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = shieldAlpha * 0.15;
      ctx.fillStyle = '#00e5ff';
      ctx.fill();
      ctx.globalAlpha = shieldAlpha * 0.35;
      ctx.strokeStyle = '#80f0ff';
      ctx.lineWidth = 1 * zoom;
      const shieldR2 = shieldR * 0.75;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = -rot * 1.5 + (i / sides) * Math.PI * 2 + 0.5;
        const px = hsx + Math.cos(a) * shieldR2;
        const py = hsy + Math.sin(a) * shieldR2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 0.5 + 0.5 * t;
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

    // Screen-space 3D shading overlay — fixed light from upper-left.
    // Drawn AFTER ctx.restore() so it does NOT rotate with the head.
    // This fixes the tilt illusion where the baked gradient rotated with
    // the head, making it look like the head banked the wrong way when turning.
    const headR = headDrawSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hsx, hsy, headR, 0, Math.PI * 2);
    ctx.clip();
    const headShade = ctx.createRadialGradient(
      hsx - headR * 0.3, hsy - headR * 0.3, headR * 0.05,
      hsx + headR * 0.1, hsy + headR * 0.1, headR * 1.05,
    );
    headShade.addColorStop(0, 'rgba(255,255,255,0.30)');
    headShade.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    headShade.addColorStop(0.55, 'rgba(0,0,0,0)');
    headShade.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = headShade;
    ctx.fillRect(hsx - headR, hsy - headR, headDrawSize, headDrawSize);
    ctx.restore();

    // Direction pointer — player only, shows where snake is steering (arrow replaces mouse cursor)
    if (snake.isPlayer) {
      drawDirectionPointer(ctx, snake.id, hsx, hsy, snake.angle, snake.targetAngle, headDrawSize / 2, snake.boosting);
    }

    // Ultra-responsive eyes — track raw mouse position relative to head
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    const equipped = getCachedEquipped();
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
    // Own name: visible for 3s after spawn, then fades out over 1s.
    // Other names: always visible.
    if (segRadius > 3) {
      let nameAlpha = snake.isPlayer ? 0.9 : 0.5;
      if (snake.isPlayer) {
        const elapsed = time - snake.spawnTime;
        if (elapsed > 3000) {
          nameAlpha = Math.max(0, 0.9 * (1 - (elapsed - 3000) / 1000));
        }
      }
      if (nameAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${nameAlpha})`;
        ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const nameX = Math.round(hsx);
        const nameY = Math.round(hsy - headDrawSize / 2 - 8 * zoom);
        ctx.fillText(snake.name, nameX, nameY);
      }
    }

  }

  // Collision chain debug rendering — hidden for production
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
        const { x: px, y: py } = w2sOff(p.x, p.y);
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
  snap?: boolean,
  alpha: number = 1.0,
  coiledPath?: PathLike,
  lodFar?: number,
): void {
  // P8: LOD — far bots skip coiled path, eyes, name, direction pointer, shield
  const isFar = lodFar === 1;
  // Choose pixel-snapped or exact world-to-screen conversion
  const w2s = snap ? worldToScreenSnapped : worldToScreen;
  // P8: Far bots skip coil contraction (saves neighbor lookups per segment)
  const path = (coiledPath && !isFar) ? coiledPath : snake.path;
  const pathLen = path.length;
  if (pathLen < 2) return;

  // Guard against non-finite values (online mode)
  const headWorldX = path.headX;
  const headWorldY = path.headY;
  if (!Number.isFinite(headWorldX) || !Number.isFinite(headWorldY)) return;
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) return;

  const zoom = camera.zoom;

  // Read custom skin state once (may contain segments for presets or custom-lab-skin)
  const customState = getCachedCustomSkinState();

  // ── Calculate logical body length using cached value (avoids Math.log per frame) ──
  const logicalLen = snake.cachedBodyLength;
  const visualLen = logicalLen * SEGMENT_SPACING;
  const step = bodyDrawStep(snake.bodyRadius, zoom);
  const rawMaxSegs = Math.ceil(visualLen / step);
  const maxSegs = getSmoothedMaxSegs(snake.id, rawMaxSegs);

  // No inner cull here — the CALLER (GameCanvas) already handles culling
  // with a body-aware margin. A second cull here with a different margin
  // caused the double-cull bug: outer cull passed the bot through but
  // inner cull rejected it, making bots invisible.

  const cw = viewport.width;
  const ch = viewport.height;
  const segRadius = snake.bodyRadius * zoom;

  // ── Viewport bounds (used by FAR LOD and body culling) ──
  const vl = viewport.left - 20;
  const vr = viewport.right + 20;
  const vt = viewport.top - 20;
  const vb = viewport.bottom + 20;

  // ── FAR LOD: eyes/name/shield skip only — body is ALWAYS rendered ──
  // Removed single-dot early return: invisible bodies caused unexplained deaths.
  // Far bots still skip eyes, name, shield, and direction pointer for performance.

  // FIX 1: Render-time interpolation offset
  const interpHeadX = snake.prevHeadX + (snake.path.headX - snake.prevHeadX) * alpha;
  const interpHeadY = snake.prevHeadY + (snake.path.headY - snake.prevHeadY) * alpha;
  const renderOffX = (interpHeadX - snake.path.headX) * zoom;
  const renderOffY = (interpHeadY - snake.path.headY) * zoom;
  const w2sOff = (wx: number, wy: number) => {
    const r = w2s(wx, wy, camera, cw, ch);
    r.x += renderOffX;
    r.y += renderOffY;
    return r;
  };

  const headScreen = w2sOff(headWorldX, headWorldY);
  const headVisible = headWorldX >= vl && headWorldX <= vr && headWorldY >= vt && headWorldY <= vb;

  // ── Spawn shield: rotating hexagonal ring that fades out ──
  // P8: Skip shield for far LOD bots
  const spawnAge = now - snake.spawnTime;
  if (spawnAge < SPAWN_PROTECTION_MS && headVisible && !isFar) {
    const t = spawnAge / SPAWN_PROTECTION_MS;
    const shieldAlpha = 1 - t;
    const shieldR = segRadius * (2.2 + 0.3 * Math.sin(now * 0.006));
    const rot = now * 0.003;
    const sides = 6;
    ctx.save();
    ctx.globalAlpha = shieldAlpha * 0.6;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2 * zoom;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const px = headScreen.x + Math.cos(a) * shieldR;
      const py = headScreen.y + Math.sin(a) * shieldR;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = shieldAlpha * 0.15;
    ctx.fillStyle = '#00e5ff';
    ctx.fill();
    ctx.globalAlpha = shieldAlpha * 0.35;
    ctx.strokeStyle = '#80f0ff';
    ctx.lineWidth = 1 * zoom;
    const shieldR2 = shieldR * 0.75;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = -rot * 1.5 + (i / sides) * Math.PI * 2 + 0.5;
      const px = headScreen.x + Math.cos(a) * shieldR2;
      const py = headScreen.y + Math.sin(a) * shieldR2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 0.5 + 0.5 * t;
  }

  // ── Walk path at dynamic step (based on radius), capped to maxSegs ──
  // Bot walk cache: reuse walked world positions every BOT_WALK_CACHE_INTERVAL frames.
  // P2: Compute maxWorldDist to early-exit walk for long snakes.
  // The furthest a visible segment can be from the head is the viewport diagonal + margin.
  const vpDiag = Math.sqrt(cw * cw + ch * ch) / zoom;
  const walkDistLimit = vpDiag + 500;
  // All snakes (player + bots) walk every frame — no caching.
  // Bot walk cache was removed to eliminate head-body separation bug.
  const walked = walkPathFixedStep(path, step, maxSegs, snake.angle, walkDistLimit);

  // ── BOOST AURA: Full-body glow effect (fallback) ──
  if (snake.boosting) {
    const boostPulse = 0.15 + 0.1 * Math.sin(now * 0.008);
    ctx.save();
    ctx.globalAlpha = boostPulse;
    // No shadowBlur — too expensive with many segments
    if (walked.count > 1) {
      ctx.strokeStyle = lightenHex(snake.color, 0.4);
      ctx.lineWidth = segRadius * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const s0x = walked.xs[walked.count - 1];
      const s0y = walked.ys[walked.count - 1];
      const scr0 = w2sOff(s0x, s0y);
      ctx.moveTo(scr0.x, scr0.y);
      for (let i = walked.count - 2; i >= 0; i--) {
        const scr = w2sOff(walked.xs[i], walked.ys[i]);
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

  // Check for preset-based visual props (preset-fish, preset-lion, etc.)
  // This lets bots and players with preset skins render with proper shapes/taper/glow
  const presetVis = !patternVis ? getPresetVisualProps(snake.skinId) : null;

  // No drop shadow — shadowBlur on every segment was causing massive
  // frame drops (650+ blurred fills/frame). The 3D gradient already
  // provides depth without the performance cost.

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
      const scr = w2sOff(wx, wy);
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
      const scr = w2sOff(wx, wy);
      const segAngle = walked.angles[i];
      const segColor = pColors[i % pColors.length] ?? snake.color;
      const segShape = resolveShapeStyle(pBodyStyle, i);
      const taperedR = segRadius * computeTaperRadius(i, walked.count, pTaper);
      drawSegmentShape(ctx, scr.x, scr.y, taperedR, segAngle, segShape, segColor, pGlow);
    }
  } else if (presetVis) {
    // Preset skin (preset-fish, preset-lion, etc.): same rendering as pattern-based
    const pColors = presetVis.colors;
    const pBodyStyle = presetVis.bodyStyle;
    const pTaper = presetVis.taperStyle;
    const pGlow = presetVis.glow;
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = w2sOff(wx, wy);
      const segAngle = walked.angles[i];
      const segColor = pColors[i % pColors.length] ?? snake.color;
      const segShape = resolveShapeStyle(pBodyStyle, i);
      const taperedR = segRadius * computeTaperRadius(i, walked.count, pTaper);
      drawSegmentShape(ctx, scr.x, scr.y, taperedR, segAngle, segShape, segColor, pGlow);
    }
  } else if (multiColor) {
    // Per-segment color: batch circles by color to minimize fillStyle changes.
    // Groups segments by their color, then draws each group as a single path.
    const colorGroups = new Map<string, number[]>();
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = w2sOff(wx, wy);
      const segColor = getSegmentColor(snake.skinId, i) ?? snake.color;
      let group = colorGroups.get(segColor);
      if (!group) { group = []; colorGroups.set(segColor, group); }
      group.push(scr.x, scr.y);
    }
    for (const [color, coords] of colorGroups) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = 0; j < coords.length; j += 2) {
        const sx = coords[j]; const sy = coords[j + 1];
        ctx.moveTo(sx + segRadius, sy);
        ctx.arc(sx, sy, segRadius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  } else {
    // BATCHED FLAT CIRCLES — 1 fill() call instead of 200+ drawImage calls.
    // This is the #1 performance optimization: eliminates per-segment OffscreenCanvas
    // lookup and GPU blit overhead. For bots (non-player), flat circles look clean
    // and the 3D gradient is not perceptible at small sizes anyway.
    ctx.fillStyle = snake.color;
    ctx.beginPath();
    for (let i = walked.count - 1; i >= 0; i--) {
      const wx = walked.xs[i];
      const wy = walked.ys[i];
      if (wx < vl || wx > vr || wy < vt || wy > vb) continue;
      const scr = w2sOff(wx, wy);
      ctx.moveTo(scr.x + segRadius, scr.y);
      ctx.arc(scr.x, scr.y, segRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // ── Head ──
  // Detect uniform taper: head matches body size when everything is uniform
  let isUniformTaper = false;
  if (customSegments) {
    isUniformTaper = customSegments.every((s) => Math.abs(s.sizeScale - 1.0) < 0.01);
  } else if (patternVis) {
    isUniformTaper = patternVis.taperStyle === 'uniform';
  } else if (presetVis) {
    isUniformTaper = presetVis.taperStyle === 'uniform';
  }
  const headScale = isUniformTaper ? 1.0 : 1.05;
  const headRadius = segRadius * headScale;
  if (headVisible) {
    // For pattern/preset skins, use the primary color for the head
    const visProps = patternVis || presetVis;
    const effectiveHeadColor = visProps ? (visProps.colors[0] ?? snake.headColor) : snake.headColor;
    // Flat head circle — much cheaper than drawImage for bots.
    // Gradient only for pattern/preset skins (rare for bots).
    if (visProps) {
      const headCircle = getCachedGradientCircle(effectiveHeadColor, headRadius, _cachedDpr);
      ctx.drawImage(headCircle, headScreen.x - headRadius, headScreen.y - headRadius, headRadius * 2, headRadius * 2);
    } else {
      ctx.fillStyle = effectiveHeadColor;
      ctx.beginPath();
      ctx.arc(headScreen.x, headScreen.y, headRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Direction pointer — player only, not bots
    if (snake.isPlayer) {
      drawDirectionPointer(ctx, snake.id, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting);
    }

    // Responsive eyes — P8: skip for far LOD bots
    // Skip if a custom eye cosmetic is equipped (it draws its own eyes)
    if (!isFar) {
      const eq2 = getCachedEquipped();
      const hasCustomEyes2 = eq2.eyes && eq2.eyes !== 'none';
      if (!hasCustomEyes2) {
        drawResponsiveEyes(ctx, headScreen.x, headScreen.y, snake.angle, snake.targetAngle, headRadius, snake.boosting, snake.id, now);
      }

      // Equipped face cosmetics (custom eyes draw here, others like hat/mouth always draw)
      renderEquippedCosmetics(ctx, { hx: headScreen.x, hy: headScreen.y, hr: headRadius, angle: snake.angle, time: now, boosting: snake.boosting, mouseScreenX, mouseScreenY });
    }

    // Name — P8: skip for far LOD bots
    if (!isFar && segRadius > 3) {
      let nameAlpha = snake.isPlayer ? 0.9 : 0.5;
      if (snake.isPlayer) {
        const elapsed = now - snake.spawnTime;
        if (elapsed > 3000) {
          nameAlpha = Math.max(0, 0.9 * (1 - (elapsed - 3000) / 1000));
        }
      }
      if (nameAlpha > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${nameAlpha})`;
        ctx.font = `${Math.max(10, 12 * zoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const nameX = Math.round(headScreen.x);
        const nameY = Math.round(headScreen.y - headRadius - 8 * zoom);
        ctx.fillText(snake.name, nameX, nameY);
      }
    }

  }

  // Collision chain debug rendering — hidden for production
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

  // ── 2. Head: tiny black dot at collision point (no red line) ──
  if (pts[0].r > 0) {
    const hp = pts[0];
    const frontX = hp.x + Math.cos(hp.a) * hp.r * 0.75;
    const frontY = hp.y + Math.sin(hp.a) * hp.r * 0.75;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(frontX, frontY, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)'; // restore red fill for squares
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

// ─── Direction Pointer (player-only steering arrow) ──────────────────
// Replaces the mouse cursor — shows where the player is steering.
// Visible curved line + arrowhead, stretches forward when boosting.

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
  // How much the steering deviates from current facing
  let steerDiff = steerAngle - faceAngle;
  while (steerDiff > Math.PI) steerDiff -= 2 * Math.PI;
  while (steerDiff < -Math.PI) steerDiff += 2 * Math.PI;

  const absDiff = Math.abs(steerDiff);

  // Boost slightly stretches the arrow forward
  const boostStretch = boosting ? 1.15 : 1.0;

  // Line length: 6× head radius, scales up to 8× for big snakes, ×1.15 when boosting
  const sizeScale = Math.min(1.4, 1.0 + (headRadius - 6) * 0.015);
  const lineLen = headRadius * 6.0 * sizeScale * boostStretch;
  const startDist = headRadius * 1.5;
  const endDist = startDist + lineLen;

  // Start point: in front of the head
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

  // Opacity: subtle when straight, brighter when turning, brightest when boosting
  const turnIntensity = Math.min(absDiff / 0.6, 1.0);
  const alpha = boosting ? 0.8 : 0.3 + 0.4 * turnIntensity;
  const lineW = boosting ? 2.5 : 1.8;

  // Direction line — hidden (arrowhead only)
  ctx.strokeStyle = `rgba(255, 255, 255, 0)`;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.stroke();

  // Arrowhead at the tip — bigger
  const arrowLen = headRadius * 1.3 * sizeScale * boostStretch;
  const arrowHalfAngle = 0.4;
  const arrowAlpha = Math.min(alpha * 1.2, 0.9);

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
  const maxShift = eyeRadius * 0.85;

  // ── SMOOTHING STATE (per-snake, keyed by snake ID) ──
  let smooth = pupilSmoothMap.get(snakeId);
  if (!smooth) {
    smooth = { shiftX: 0, shiftY: 0, prevAngle: moveAngle, angleReady: false, smoothAngle: moveAngle, prevSmoothAngle: moveAngle };
    pupilSmoothMap.set(snakeId, smooth);
  }

  // FIX 3: Per-frame smoothed angle — eliminates tick-only angle jumps.
  // snake.angle only updates on physics ticks; this lerp gives a continuous
  // angle every render frame so the eyes don't freeze between ticks.
  let angDiff = moveAngle - smooth.smoothAngle;
  while (angDiff > Math.PI) angDiff -= 2 * Math.PI;
  while (angDiff < -Math.PI) angDiff += 2 * Math.PI;
  smooth.smoothAngle += angDiff * 0.35;
  const smoothMoveAngle = smooth.smoothAngle;
  const perpAngle = smoothMoveAngle + Math.PI / 2;
  const eyeForward = headRadius * 0.32;
  // FIX #16: Prune stale entries without array allocation.
  // Iterate and delete first entries until under limit.
  if (pupilSmoothMap.size > 50) {
    let toRemove = pupilSmoothMap.size - 30;
    for (const key of pupilSmoothMap.keys()) {
      if (toRemove-- <= 0) break;
      pupilSmoothMap.delete(key);
    }
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
    angVel = smoothMoveAngle - smooth.prevSmoothAngle;
    while (angVel > Math.PI) angVel -= 2 * Math.PI;
    while (angVel < -Math.PI) angVel += 2 * Math.PI;
  }
  smooth.prevSmoothAngle = smoothMoveAngle;
  smooth.angleReady = true;

  // Steering delta for circular DIRECTION (use smoothed angle)
  let deltaAngle = targetAngle - smoothMoveAngle;
  while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
  while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
  const absDelta = Math.abs(deltaAngle);
  const absVel = Math.abs(angVel);

  // Look direction: use the full target direction (circular!), default to forward when idle
  const lookDir = absDelta < 0.06
    ? smoothMoveAngle    // idle → look forward
    : targetAngle;      // steering → look toward where we're going

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
    const ex = hx + Math.cos(smoothMoveAngle) * eyeForward + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(smoothMoveAngle) * eyeForward + Math.sin(perpAngle) * eyeOffset * side;

    if (isBlinking) {
      // ── BLINK: thin eyelid arcs (top + bottom) closing inward ──
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      // Top eyelid arc
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius * 0.75, smoothMoveAngle - 0.35, smoothMoveAngle + 0.35);
      ctx.stroke();
      // Bottom eyelid arc (slightly offset)
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius * 0.75, smoothMoveAngle + Math.PI - 0.35, smoothMoveAngle + Math.PI + 0.35);
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
