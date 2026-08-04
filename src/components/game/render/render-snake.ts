// ============================================================================
// Venom Arena — Snake Renderer (Procedural Fallback)
// Smooth connected body with taper, elliptical head, 3D gradient, no arrow.
// Delegates to atlas renderer when SkinAtlasManager is available.
// ============================================================================

import type {
  CameraState,
  RenderSegment,
  SnakeIdentity,
} from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';
import type { ResolvedSkin } from '@/lib/snake/skin-types';
import { resolveSkin } from '@/lib/snake/skin-resolver';
import { worldToScreen, isOnScreen } from './camera';
import { drawHat } from './hats';
import { drawFace } from './face';
import type { SkinAtlasManager } from './atlas';
import { renderSnakeAtlas } from './render-snake-atlas';
import { create3DGradient } from './gradient';

// ── Color helpers (local, for ellipse gradient) ───────────────────────────

function brightenLocal(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const cl = (v: number) => Math.min(255, Math.round(v + (255 - v) * amount));
  return '#' + [cl(r), cl(g), cl(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function darkenLocal(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const cl = (v: number) => Math.round(v * (1 - amount));
  return '#' + [cl(r), cl(g), cl(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Render a complete snake with skin, hat, face, and effects.
 * If an atlasManager is provided and the snake has a known skinId,
 * delegates to the atlas-based renderer for better performance.
 *
 * @param displayW Display (CSS) width — NOT ctx.canvas.width (backing store).
 * @param displayH Display (CSS) height — NOT ctx.canvas.height (backing store).
 */
export function renderSnake(
  ctx: CanvasRenderingContext2D,
  identity: SnakeIdentity,
  segments: RenderSegment[],
  camera: CameraState,
  config: SnakeConfig,
  time: number,
  isPlayer: boolean,
  lowQuality: boolean,
  headAngle: number,
  boosting: boolean,
  spawnProtected: boolean,
  displayW: number,
  displayH: number,
  atlasManager?: SkinAtlasManager | null,
): void {
  if (segments.length === 0) return;

  // ── Atlas delegation: use fast sprite rendering when available ───────
  if (atlasManager && identity.skinId) {
    renderSnakeAtlas(
      ctx, identity, segments, camera, config, time,
      isPlayer, lowQuality, headAngle, boosting, spawnProtected,
      displayW, displayH, atlasManager,
    );
    return;
  }

  // ── Fallback: procedural renderer (backward compatible) ──────────────

  // Resolve skin for this frame
  const skin = resolveSkin(identity, segments.length, time);

  // Check if head is on screen (rough cull)
  const headSeg = segments[0];
  if (!isOnScreen(headSeg.x, headSeg.y, headSeg.visualRadius * 2, camera, displayW, displayH)) {
    return;
  }

  // ── Draw body glow (if any segment has glow) ─────────────────────
  if (skin.hasGlow) {
    renderGlowPass(ctx, segments, skin, camera, displayW, displayH, config);
  }

  // ── Draw body segments (tail → head for correct layering) ───────
  for (let i = segments.length - 1; i >= 1; i--) {
    const seg = segments[i];
    const resolved = skin.segments[i] ?? skin.segments[skin.segments.length - 1];

    // Screen position
    const screen = worldToScreen(seg.x, seg.y, camera, displayW, displayH);
    const screenR = seg.taperRadius * camera.zoom;

    // Skip tiny or off-screen segments
    if (screenR < 0.5) continue;

    // Spawn protection shimmer
    if (spawnProtected) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.2;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 15;
    }

    // Draw 3D-shaded circle using taperRadius
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenR, 0, Math.PI * 2);
    ctx.fillStyle = create3DGradient(ctx, screen.x, screen.y, screenR, resolved.color, config);
    ctx.fill();

    if (spawnProtected) {
      ctx.restore();
    }
  }

  // ── Draw head as elongated ellipse ────────────────────────────────
  const headScreen = worldToScreen(headSeg.x, headSeg.y, camera, displayW, displayH);
  const headTaperR = headSeg.taperRadius * camera.zoom;
  const headColor = skin.segments[0]?.color ?? identity.primaryColor;

  if (headTaperR >= 0.5) {
    if (spawnProtected) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.2;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 15;
    }

    const radiusX = headTaperR * 1.35;
    const radiusY = headTaperR * 1.0;

    ctx.save();
    ctx.translate(headScreen.x, headScreen.y);
    ctx.rotate(headAngle);

    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);

    // Subtle 3D gradient — soft highlight, no concentrated white dot
    const hx = -radiusX * 0.2;
    const hy = -radiusY * 0.2;
    const grad = ctx.createRadialGradient(hx, hy, headTaperR * 0.2, 0, 0, Math.max(radiusX, radiusY));
    grad.addColorStop(0, brightenLocal(headColor, 0.12));
    grad.addColorStop(0.6, headColor);
    grad.addColorStop(1, darkenLocal(headColor, 0.20));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();

    if (spawnProtected) {
      ctx.restore();
    }
  }

  // ── Draw hat on head ──────────────────────────────────────────────
  const headScreenR = headSeg.taperRadius * camera.zoom;

  if (identity.hat !== 'none') {
    drawHat(ctx, identity.hat, headScreen.x, headScreen.y, headScreenR, headAngle);
  }

  // ── Draw face on head ─────────────────────────────────────────────
  const shouldDrawFace = isPlayer || !(lowQuality && identity.isBot);
  if (shouldDrawFace) {
    drawFace(ctx, headScreen.x, headScreen.y, headScreenR, headAngle, time);
  }

  // No direction arrow — the elongated head shape shows direction
}

// ── Glow Pass ────────────────────────────────────────────────────────────

function renderGlowPass(
  ctx: CanvasRenderingContext2D,
  segments: RenderSegment[],
  skin: ResolvedSkin,
  camera: CameraState,
  displayW: number,
  displayH: number,
  config: SnakeConfig,
): void {
  ctx.save();

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const resolved = skin.segments[i];
    if (!resolved?.glow) continue;

    const screen = worldToScreen(seg.x, seg.y, camera, displayW, displayH);
    const screenR = seg.taperRadius * camera.zoom;
    if (screenR < 0.5) continue;

    ctx.shadowColor = resolved.color;
    ctx.shadowBlur = config.neonGlowBlur;
    ctx.globalAlpha = config.neonGlowIntensity;

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, screenR, 0, Math.PI * 2);
    ctx.fillStyle = resolved.color;
    ctx.fill();
  }

  ctx.restore();
}
