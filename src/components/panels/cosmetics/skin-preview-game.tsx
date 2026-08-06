'use client';

/**
 * Game-Accurate Skin Preview — shows the EXACT same snake rendering
 * that appears in the actual game canvas. Uses the atlas-based renderer
 * so what you see in the shop IS what you get in-game.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { SkinAsset } from '@/lib/snake/types';
import { SkinAtlasManager } from '@/lib/snake/atlas';
import { SNAKE_RADIUS, SEGMENT_SPACING, HEAD_SPRITE_SIZE } from '@/lib/snake/config';
import { getSkinAsset, isMultiColorSkin, getSegmentColor } from '@/lib/snake/skin-registry';
import { renderEquippedCosmetics, getCosmeticById, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';
import { readCustomSkinStateSafe, drawSegmentShape, computeTaperRadius } from '@/components/panels/cosmetics/cosmetics-utils';
import type { CustomSegment } from '@/components/panels/cosmetics/cosmetics-types';

interface GameSkinPreviewProps {
  /** Skin ID (cosmetic ID, preset ID, or 'custom-lab-skin') */
  skinId: string;
  /** Canvas width in CSS pixels */
  width?: number;
  /** Canvas height in CSS pixels */
  height?: number;
  /** Number of body segments to show */
  segments?: number;
  /** Whether to show a wiggle animation */
  animated?: boolean;
  /** Optional SkinAsset override (avoids re-lookup) */
  assetOverride?: SkinAsset;
  /** Extra CSS classes */
  className?: string;
  /** Override equipped cosmetics for preview */
  equippedCosmetics?: EquippedCosmetics | null;
}

// Shared atlas manager for all previews (builds once, reuses)
let sharedAtlasManager: SkinAtlasManager | null = null;

function getSharedAtlasManager(): SkinAtlasManager {
  if (!sharedAtlasManager) {
    sharedAtlasManager = new SkinAtlasManager();
  }
  return sharedAtlasManager;
}

export function GameSkinPreview({
  skinId,
  width = 220,
  height = 80,
  segments = 18,
  animated = true,
  assetOverride,
  equippedCosmetics,
  className = '',
}: GameSkinPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback((
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    time: number,
  ) => {
    const asset = assetOverride ?? getSkinAsset(skinId);
    const atlasManager = getSharedAtlasManager();

    // Ensure atlas is built for this skin
    if (!atlasManager.getAtlas(asset.id)) {
      atlasManager.buildAtlas(asset);
    }
    const atlas = atlasManager.getAtlas(asset.id);

    const multiColor = isMultiColorSkin(skinId);

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background: subtle dark gradient
    const bgGrad = ctx.createRadialGradient(canvasW / 2, canvasH / 2, 0, canvasW / 2, canvasH / 2, canvasW / 2);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvasW, canvasH, 8);
    ctx.fill();

    // Calculate segment layout
    const segRadius = 8;
    const segStep = SEGMENT_SPACING;
    const headScale = 1.3;
    const totalLen = segments * segStep;
    const startX = (canvasW - totalLen) / 2;
    const centerY = canvasH / 2;

    // Generate wiggle positions
    const positions: { x: number; y: number; angle: number }[] = [];
    let cx = startX;
    let cy = centerY;
    let baseAngle = 0; // moving right

    for (let i = 0; i < segments; i++) {
      // Sinusoidal wiggle
      const wiggle = animated
        ? Math.sin(time * 0.004 - i * 0.42) * 9
        : Math.sin(-i * 0.42) * 9;

      const perpX = -Math.sin(baseAngle);
      const perpY = Math.cos(baseAngle);

      positions.push({
        x: cx,
        y: cy + wiggle,
        angle: baseAngle,
      });

      cx += segStep;
    }

    // Check for custom lab skin segments with shapes/taper/glow
    const customSegments: CustomSegment[] | null = (() => {
      if (skinId === 'custom-lab-skin') {
        const state = readCustomSkinStateSafe();
        if (state?.customSkinSegments?.length) return state.customSkinSegments;
      }
      return null;
    })();

    // Draw body (tail to head for layering)
    for (let i = positions.length - 1; i >= 0; i--) {
      const pos = positions[i];
      const r = segRadius;

      // Custom lab skin with shapes — use drawSegmentShape
      if (customSegments) {
        const seg = customSegments[i % customSegments.length];
        const taperedR = r * seg.sizeScale;
        drawSegmentShape(
          ctx, pos.x, pos.y, taperedR,
          pos.angle, seg.shape, seg.color, seg.glow,
        );
        continue;
      }

      if (atlas && !multiColor) {
        // Use atlas texture
        const bodyIdx = i % atlas.body.length;
        const region = atlas.body[bodyIdx];

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(pos.angle);

        // Apply epic effects
        if (asset.animation && asset.animation !== 'none') {
          atlasManager.applyEpicEffect(ctx, asset.animation, time * 0.001, 0, 0, r * 2, asset.bodyColor);
        }

        ctx.drawImage(
          atlas.canvas,
          region.x, region.y, region.width, region.height,
          -r, -r, r * 2, r * 2,
        );

        atlasManager.resetEpicEffect(ctx);
        ctx.restore();
      } else if (multiColor) {
        // Multi-color: alternating segments with gradient 3D effect
        const segColor = getSegmentColor(skinId, i) ?? asset.bodyColor;

        ctx.save();
        // 3D gradient
        const grad = ctx.createRadialGradient(
          pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1,
          pos.x, pos.y, r,
        );
        grad.addColorStop(0, lightenHex(segColor, 0.25));
        grad.addColorStop(0.6, segColor);
        grad.addColorStop(1, darkenHex(segColor, 0.25));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Fallback: solid with 3D gradient
        ctx.save();
        const grad = ctx.createRadialGradient(
          pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1,
          pos.x, pos.y, r,
        );
        grad.addColorStop(0, lightenHex(asset.bodyColor, 0.25));
        grad.addColorStop(0.6, asset.bodyColor);
        grad.addColorStop(1, darkenHex(asset.bodyColor, 0.25));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw head (last position = head)
    if (positions.length > 0) {
      const headPos = positions[0];
      const hr = segRadius * headScale;

      if (atlas && !multiColor) {
        const region = atlas.head;
        ctx.save();
        ctx.translate(headPos.x, headPos.y);
        ctx.rotate(headPos.angle);

        if (asset.animation && asset.animation !== 'none') {
          atlasManager.applyEpicEffect(ctx, asset.animation, time * 0.001, 0, 0, hr * 2, asset.headColor);
        }

        ctx.drawImage(
          atlas.canvas,
          region.x, region.y, region.width, region.height,
          -hr, -hr, hr * 2, hr * 2,
        );

        atlasManager.resetEpicEffect(ctx);
        ctx.restore();
      } else {
        const headColor = multiColor
          ? (getSegmentColor(skinId, 0) ?? asset.headColor)
          : asset.headColor;

        ctx.save();
        const grad = ctx.createRadialGradient(
          headPos.x - hr * 0.3, headPos.y - hr * 0.3, hr * 0.1,
          headPos.x, headPos.y, hr,
        );
        grad.addColorStop(0, lightenHex(headColor, 0.3));
        grad.addColorStop(0.6, headColor);
        grad.addColorStop(1, darkenHex(headColor, 0.3));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw eyes on head
      const eyeOffset = hr * 0.4;
      const eyeR = hr * 0.25;
      const pupilR = eyeR * 0.55;
      const forwardOffset = hr * 0.3;

      for (const side of [-1, 1]) {
        const ex = headPos.x + forwardOffset;
        const ey = headPos.y + eyeOffset * side;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ex + pupilR * 0.3, ey, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(ex + pupilR * 0.1 - pupilR * 0.3, ey - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Face cosmetics preview
      if (equippedCosmetics) {
        // Draw each equipped cosmetic
        const slots: Array<'wings'|'flag'|'ears'|'hat'|'goggles'|'mouth'|'nose'|'eyes'> = ['wings', 'flag', 'ears', 'hat', 'goggles', 'mouth', 'nose', 'eyes'];
        for (const slot of slots) {
          const id = equippedCosmetics[slot];
          if (!id || id === 'none') continue;
          const cosmetic = getCosmeticById(id);
          if (cosmetic) cosmetic.draw(ctx, {
            hx: headPos.x, hy: headPos.y, hr, angle: headPos.angle, time, boosting: false
          });
        }
      } else {
        renderEquippedCosmetics(ctx, {
          hx: headPos.x, hy: headPos.y, hr, angle: headPos.angle, time, boosting: false
        });
      }

      // Glow effect for rare+ skins
      if (asset.rarity === 'epic' || asset.rarity === 'legendary') {
        const glowIntensity = 0.2 + 0.1 * Math.sin(time * 0.003);
        ctx.save();
        ctx.globalAlpha = glowIntensity;
        const glowGrad = ctx.createRadialGradient(headPos.x, headPos.y, hr, headPos.x, headPos.y, hr * 2.5);
        glowGrad.addColorStop(0, asset.bodyColor);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(headPos.x, headPos.y, hr * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [skinId, segments, animated, assetOverride, equippedCosmetics]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!animated) {
      draw(ctx, width, height, 0);
      return;
    }

    let running = true;
    const loop = (time: number) => {
      if (!running) return;
      draw(ctx, width, height, time);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [draw, width, height, animated]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`block ${className}`}
    />
  );
}

// ─── Color helpers (duplicated from atlas.ts to avoid circular deps) ────────

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
