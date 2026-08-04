// ============================================================================
// Venom Arena — Snake Renderer
// Full render pipeline combining shapes, gradient, hats, face, arrow, glow.
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
import { drawShape } from './shapes';
import { drawHat } from './hats';
import { drawFace } from './face';
import { drawDirectionArrow } from './arrow';
import type { SkinAtlasManager } from './atlas';
import { renderSnakeAtlas } from './render-snake-atlas';

/**
 * Render a complete snake with skin, hat, face, and effects.
 * If an atlasManager is provided and the snake has a known skinId,
 * delegates to the atlas-based renderer for better performance.
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
  atlasManager?: SkinAtlasManager | null,
): void {
  if (segments.length === 0) return;

  // ── Atlas delegation: use fast sprite rendering when available ───────
  if (atlasManager && identity.skinId) {
    renderSnakeAtlas(
      ctx, identity, segments, camera, config, time,
      isPlayer, lowQuality, headAngle, boosting, spawnProtected,
      atlasManager,
    );
    return;
  }

  // ── Fallback: procedural renderer (backward compatible) ──────────────

  // Resolve skin for this frame
  const skin = resolveSkin(identity, segments.length, time);

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  // Check if head is on screen (rough cull)
  const headSeg = segments[0];
  if (!isOnScreen(headSeg.x, headSeg.y, headSeg.visualRadius * 2, camera, canvasW, canvasH)) {
    return;
  }

  // ── Draw body glow (if any segment has glow) ─────────────────────
  if (skin.hasGlow) {
    renderGlowPass(ctx, segments, skin, camera, canvasW, canvasH, config);
  }

  // ── Draw segments (tail → head for correct layering) ─────────────
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const resolved = skin.segments[i] ?? skin.segments[skin.segments.length - 1];

    // Screen position
    const screen = worldToScreen(seg.x, seg.y, camera, canvasW, canvasH);
    const screenR = seg.visualRadius * camera.zoom;

    // Skip tiny or off-screen segments
    if (screenR < 0.5) continue;

    // Spawn protection shimmer
    if (spawnProtected && i === 0) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.2;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 15;
    }

    // Draw the segment shape
    drawShape(ctx, resolved.shape, screen.x, screen.y, screenR, seg.angle, resolved.color, config);

    if (spawnProtected && i === 0) {
      ctx.restore();
    }
  }

  // ── Draw hat on head ──────────────────────────────────────────────
  const headScreen = worldToScreen(headSeg.x, headSeg.y, camera, canvasW, canvasH);
  const headScreenR = headSeg.visualRadius * camera.zoom;

  if (identity.hat !== 'none') {
    drawHat(ctx, identity.hat, headScreen.x, headScreen.y, headScreenR, headAngle);
  }

  // ── Draw face on head ─────────────────────────────────────────────
  const shouldDrawFace = isPlayer || !(lowQuality && identity.isBot);
  if (shouldDrawFace) {
    drawFace(ctx, headScreen.x, headScreen.y, headScreenR, headAngle, time);
  }

  // ── Draw direction arrow (player only) ────────────────────────────
  if (isPlayer) {
    drawDirectionArrow(
      ctx,
      headScreen.x,
      headScreen.y,
      headAngle,
      headScreenR,
      boosting,
      identity.primaryColor,
    );
  }
}

// ── Glow Pass ────────────────────────────────────────────────────────────

function renderGlowPass(
  ctx: CanvasRenderingContext2D,
  segments: RenderSegment[],
  skin: ResolvedSkin,
  camera: CameraState,
  canvasW: number,
  canvasH: number,
  config: SnakeConfig,
): void {
  ctx.save();

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const resolved = skin.segments[i];
    if (!resolved?.glow) continue;

    const screen = worldToScreen(seg.x, seg.y, camera, canvasW, canvasH);
    const screenR = seg.visualRadius * camera.zoom;
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