'use client';

// ============================================================================
// Venom Arena — Atlas-Based Snake Renderer
// Uses SkinAtlasManager for fast drawImage() calls instead of procedural drawing.
// Supports all rarity tiers: common, rare, epic (animated), legendary (particles).
// Updated: body uses taperRadius, head drawn as ellipse, no direction arrow.
// ============================================================================

import type {
  CameraState,
  RenderSegment,
  SnakeIdentity,
} from '@/lib/snake/types';
import type { SnakeConfig } from '@/lib/snake/config';
import { RARITY_CONFIG } from '@/lib/snake/types';
import { SkinAtlasManager } from './atlas';
import { worldToScreen, isOnScreen } from './camera';
import { drawHat } from './hats';
import { drawFace } from './face';

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

// ── Particle emitter output for legendary skins ────────────────────────────

/** Emitted particle data (returned to caller for overlay renderer) */
export interface EmittedParticle {
  x: number;
  y: number;
  type: 'glow' | 'bubbles' | 'sparkles' | 'fire' | 'void' | 'electric';
  color: string;
  secondaryColor?: string;
  speed: number;
  spread: number;
  lifetime: number;
  size: number;
  gravity?: number;
  glow?: number;
}

// ── Main renderer ──────────────────────────────────────────────────────────

/**
 * Render a complete snake using the atlas system.
 * Body segments use taperRadius for size. Head is drawn as an elongated ellipse
 * with 3D gradient. No direction arrow.
 *
 * @param displayW Display (CSS) width — NOT ctx.canvas.width.
 * @param displayH Display (CSS) height — NOT ctx.canvas.height.
 */
export function renderSnakeAtlas(
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
  atlasManager: SkinAtlasManager,
): EmittedParticle[] {
  if (segments.length === 0) return [];

  const rarity: string = identity.skinRarity ?? 'common';
  const skinId = identity.skinId || `skin_${identity.id}`;

  // ── Head culling ──────────────────────────────────────────────────
  const headSeg = segments[0];
  if (!isOnScreen(headSeg.x, headSeg.y, headSeg.visualRadius * 2, camera, displayW, displayH)) {
    return [];
  }

  // ── Initialize atlas if needed ────────────────────────────────────
  if (!atlasManager.hasSkin(skinId)) {
    atlasManager.initSkin(
      skinId,
      identity.primaryColor,
      identity.secondaryColor,
      rarity as 'common' | 'rare' | 'epic' | 'legendary',
      identity.bodyStyle,
      identity.hat,
    );
  }

  atlasManager.updateTime(time);

  const emittedParticles: EmittedParticle[] = [];
  const lastIdx = segments.length - 1;

  // ── Legendary: glow underlay pass ─────────────────────────────────
  if (rarity === 'legendary') {
    atlasManager.drawGlowUnderlay(
      ctx, skinId, segments, camera, displayW, displayH, time,
    );
  }

  // ── Draw body segments (tail → head, skip i=0) ────────────────────
  for (let i = segments.length - 1; i >= 1; i--) {
    const seg = segments[i];
    const screen = worldToScreen(seg.x, seg.y, camera, displayW, displayH);
    const screenR = seg.taperRadius * camera.zoom;

    if (screenR < 0.5) continue;

    // Spawn protection shimmer
    if (spawnProtected) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(time * 8) * 0.2;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 15;
    }

    if (i === lastIdx) {
      // ── Tail ───────────────────────────────────────────────────
      atlasManager.drawTail(
        ctx, skinId, screen.x, screen.y, screenR,
        seg.angle, seg.color,
        rarity as 'common' | 'rare' | 'epic' | 'legendary',
      );

      // Legendary: emit tail particles
      if (rarity === 'legendary' && seg.emitParticles) {
        const tailP = atlasManager.getTailParticleConfig(skinId);
        if (tailP) {
          emittedParticles.push({
            x: screen.x, y: screen.y,
            type: tailP.type, color: tailP.color,
            secondaryColor: tailP.secondaryColor,
            speed: tailP.speed, spread: tailP.spread,
            lifetime: tailP.lifetime, size: tailP.size,
            gravity: tailP.gravity, glow: tailP.glow,
          });
        }
      }
    } else {
      // ── Body ───────────────────────────────────────────────────
      atlasManager.drawBody(
        ctx, skinId, screen.x, screen.y, screenR,
        seg.angle, seg.color,
        rarity as 'common' | 'rare' | 'epic' | 'legendary',
        i, time,
      );
    }

    if (spawnProtected) {
      ctx.restore();
    }
  }

  // ── Draw head as elongated ellipse ────────────────────────────────
  const headScreen = worldToScreen(headSeg.x, headSeg.y, camera, displayW, displayH);
  const headTaperR = headSeg.taperRadius * camera.zoom;
  const headColor = identity.primaryColor;

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

    // 3D gradient for ellipse (radial with offset)
    const hx = -radiusX * 0.25;
    const hy = -radiusY * 0.30;
    const grad = ctx.createRadialGradient(hx, hy, headTaperR * 0.05, 0, 0, Math.max(radiusX, radiusY));
    grad.addColorStop(0, brightenLocal(headColor, 0.35));
    grad.addColorStop(0.5, headColor);
    grad.addColorStop(1, darkenLocal(headColor, 0.30));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();

    if (spawnProtected) {
      ctx.restore();
    }

    // Legendary: emit head particles
    if (rarity === 'legendary' && headSeg.emitParticles) {
      const headP = atlasManager.getHeadParticleConfig(skinId);
      if (headP) {
        emittedParticles.push({
          x: headScreen.x, y: headScreen.y,
          type: headP.type, color: headP.color,
          secondaryColor: headP.secondaryColor,
          speed: headP.speed, spread: headP.spread,
          lifetime: headP.lifetime, size: headP.size,
          gravity: headP.gravity, glow: headP.glow,
        });
      }
    }
  }

  // ── Draw hat on head ──────────────────────────────────────────────
  const headScreenR = headSeg.taperRadius * camera.zoom;

  if (identity.hat !== 'none') {
    drawHat(ctx, identity.hat, headScreen.x, headScreen.y, headScreenR, headAngle);
  }

  // ── Draw face (ALWAYS for player, respect lowQuality for bots) ────
  if (isPlayer) {
    drawFace(ctx, headScreen.x, headScreen.y, headScreenR, headAngle, time);
  } else if (!lowQuality) {
    drawFace(ctx, headScreen.x, headScreen.y, headScreenR, headAngle, time);
  }

  // No direction arrow — the elongated head shape shows direction

  return emittedParticles;
}

// ── Utility: get rarity glow intensity ─────────────────────────────────────

/**
 * Get the glow intensity for a given rarity tier.
 * Useful for the overlay renderer to configure particle effects.
 */
export function getRarityGlowIntensity(rarity: string): number {
  const cfg = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
  return cfg?.glowIntensity ?? 0;
}
