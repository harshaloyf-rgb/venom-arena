'use client';

/**
 * Game-Accurate Skin Preview — renders the snake with EXACT game params
 * (eye size 0.38, border 1.5px, shadow, gradient 0.35) so the shop preview
 * matches what players see in-game.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { SkinAsset } from '@/lib/snake/types';
import { SkinAtlasManager } from '@/lib/snake/atlas';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM, SEGMENT_SPACING } from '@/lib/snake/config';
import { getSkinAsset, isMultiColorSkin, getSegmentColor } from '@/lib/snake/skin-registry';
import { renderEquippedCosmetics, getCosmeticById, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';
import { readCustomSkinStateSafe, drawSegmentShape } from '@/components/panels/cosmetics/cosmetics-utils';
import type { CustomSegment } from '@/components/panels/cosmetics/cosmetics-types';

// ─── Game-accurate constants (mirrors render-snake-atlas.tsx) ───────────

const HEAD_SCALE = 1.3;
const LIGHTEN = 0.35;
const LIGHTEN_STOP = 0.55;
const DARKEN = 0.35;
const EYE_RADIUS_RATIO = 0.38;
const EYE_OFFSET_RATIO = 0.42;
const EYE_FORWARD_RATIO = 0.32;
const PUPIL_RADIUS_RATIO = 0.52;
const PUPIL_SHIFT_RATIO = 0.7;
const EYE_BORDER_W = 1.5;
const EYE_BORDER_COLOR = 'rgba(0,0,0,0.5)';
const HIGHLIGHT_OPACITY = 0.8;
const SHADOW_BLUR_R = 0.8;
const SHADOW_OFFSET_Y_R = 0.3;

interface GameSkinPreviewProps {
  skinId: string;
  width?: number;
  height?: number;
  segments?: number;
  animated?: boolean;
  assetOverride?: SkinAsset;
  className?: string;
  equippedCosmetics?: EquippedCosmetics | null;
}

// Smooth pupil state for circular tracking
interface PupilSmooth { shiftX: number; shiftY: number; }

let sharedAtlasManager: SkinAtlasManager | null = null;
function getSharedAtlasManager(): SkinAtlasManager {
  if (!sharedAtlasManager) sharedAtlasManager = new SkinAtlasManager();
  return sharedAtlasManager;
}

// ─── Color helpers ─────────────────────────────────────────────────────

function lightenHex(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r + (255 - r) * f).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * f).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * f).toString(16).padStart(2, '0')}`;
}
function darkenHex(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r * (1 - f)).toString(16).padStart(2, '0')}${Math.round(g * (1 - f)).toString(16).padStart(2, '0')}${Math.round(b * (1 - f)).toString(16).padStart(2, '0')}`;
}

// ─── Component ─────────────────────────────────────────────────────────

export function GameSkinPreview({
  skinId, width = 220, height = 80, segments = 18,
  animated = true, assetOverride, equippedCosmetics, className = '',
}: GameSkinPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const pupilRef = useRef<PupilSmooth | null>(null);
  const prevHeadAngleRef = useRef<number>(0);

  const draw = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, time: number) => {
    const asset = assetOverride ?? getSkinAsset(skinId);
    const am = getSharedAtlasManager();
    if (!am.getAtlas(asset.id)) am.buildAtlas(asset);
    const atlas = am.getAtlas(asset.id);
    const multiColor = isMultiColorSkin(skinId);

    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    bg.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
    bg.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, 8); ctx.fill();

    // Layout
    const r = 8;
    const step = SEGMENT_SPACING;
    const totalLen = segments * step;
    const sx = (W - totalLen) / 2;
    const cy = H / 2;

    // Sine-wave positions
    const pos: { x: number; y: number; a: number }[] = [];
    let px = sx;
    for (let i = 0; i < segments; i++) {
      const w = animated ? Math.sin(time * 0.004 - i * 0.42) * 9 : Math.sin(-i * 0.42) * 9;
      pos.push({ x: px, y: cy + w, a: 0 });
      px += step;
    }
    // Compute angles from neighbours
    for (let i = 0; i < pos.length; i++) {
      const next = i < pos.length - 1 ? pos[i + 1] : pos[i];
      const prev = i > 0 ? pos[i - 1] : pos[i];
      pos[i].a = Math.atan2(next.y - prev.y, next.x - prev.x);
    }

    // Custom skin with segments? (presets or custom-lab-skin)
    const customSegs: CustomSegment[] | null = (() => {
      const s = readCustomSkinStateSafe();
      if (s?.useCustomSkin && s.currentSkin === skinId && s.customSkinSegments?.length) {
        return s.customSkinSegments;
      }
      return null;
    })();

    // ── Body (tail → head) ──
    for (let i = pos.length - 1; i >= 0; i--) {
      const p = pos[i];

      if (customSegs) {
        const seg = customSegs[i % customSegs.length];
        drawSegmentShape(ctx, p.x, p.y, r * seg.sizeScale, p.a, seg.shape, seg.color, seg.glow);
        continue;
      }

      if (atlas && !multiColor) {
        const region = atlas.body[i % atlas.body.length];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        if (asset.animation && asset.animation !== 'none') {
          am.applyEpicEffect(ctx, asset.animation, time * 0.001, 0, 0, r * 2, asset.bodyColor);
        }
        ctx.drawImage(atlas.canvas, region.x, region.y, region.width, region.height, -r, -r, r * 2, r * 2);
        am.resetEpicEffect(ctx);
        ctx.restore();
      } else {
        const col = multiColor ? (getSegmentColor(skinId, i) ?? asset.bodyColor) : asset.bodyColor;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = r * SHADOW_BLUR_R;
        ctx.shadowOffsetY = r * SHADOW_OFFSET_Y_R;
        const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, lightenHex(col, LIGHTEN));
        g.addColorStop(LIGHTEN_STOP, col);
        g.addColorStop(1, darkenHex(col, DARKEN));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // ── Head ──
    if (pos.length > 0) {
      const hp = pos[0];
      const hr = r * HEAD_SCALE;

      if (atlas && !multiColor) {
        const region = atlas.head;
        ctx.save();
        ctx.translate(hp.x, hp.y);
        ctx.rotate(hp.a);
        if (asset.animation && asset.animation !== 'none') {
          am.applyEpicEffect(ctx, asset.animation, time * 0.001, 0, 0, hr * 2, asset.headColor);
        }
        ctx.drawImage(atlas.canvas, region.x, region.y, region.width, region.height, -hr, -hr, hr * 2, hr * 2);
        am.resetEpicEffect(ctx);
        ctx.restore();
      } else {
        const hc = multiColor ? (getSegmentColor(skinId, 0) ?? asset.headColor) : asset.headColor;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = hr * SHADOW_BLUR_R;
        ctx.shadowOffsetY = hr * SHADOW_OFFSET_Y_R;
        const g = ctx.createRadialGradient(hp.x - hr * 0.3, hp.y - hr * 0.3, hr * 0.1, hp.x, hp.y, hr);
        g.addColorStop(0, lightenHex(hc, LIGHTEN));
        g.addColorStop(LIGHTEN_STOP, hc);
        g.addColorStop(1, darkenHex(hc, DARKEN));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // ── Eyes (game-accurate) — circular pupil tracking with asymmetric lerp ──
      const eyeOff = hr * EYE_OFFSET_RATIO;
      const eyeR = hr * EYE_RADIUS_RATIO;
      const pupR = eyeR * PUPIL_RADIUS_RATIO;
      const fwd = hr * EYE_FORWARD_RATIO;
      const perp = hp.a + Math.PI / 2;
      const maxShift = eyeR * PUPIL_SHIFT_RATIO;

      // Angular velocity from head angle changes (sine wave wiggle)
      const angVel = hp.a - prevHeadAngleRef.current;
      prevHeadAngleRef.current = hp.a;

      // Compute target pupil shift (circular 360°)
      let targetShiftX = 0, targetShiftY = 0;
      const m = mouseRef.current;
      if (m) {
        const dx = m.x - hp.x, dy = m.y - hp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          const rawLook = Math.atan2(dy, dx);
          let deltaA = rawLook - hp.a;
          while (deltaA > Math.PI) deltaA -= 2 * Math.PI;
          while (deltaA < -Math.PI) deltaA += 2 * Math.PI;
          const absD = Math.abs(deltaA);
          const DZ = 0.12, FZ = 0.45;
          const sr = absD < DZ ? 0 : absD < FZ ? (absD - DZ) / (FZ - DZ) : 1;
          const angVelC = Math.min(1, Math.abs(angVel) / 0.018);
          const combined = Math.min(1, Math.max(sr, angVelC * 0.75));
          const lookDir = Math.abs(deltaA) < 0.06 ? hp.a : rawLook;
          targetShiftX = Math.cos(lookDir) * maxShift * combined;
          targetShiftY = Math.sin(lookDir) * maxShift * combined;
        }
      }
      // Angular velocity wiggle contribution (sine wave)
      if (!m || Math.abs(angVel) > 0.005) {
        const angVelC = Math.min(1, Math.abs(angVel) / 0.018);
        const turnShiftX = Math.cos(hp.a) * maxShift * angVelC * 0.75;
        const turnShiftY = Math.sin(hp.a) * maxShift * angVelC * 0.75;
        const curDist = Math.sqrt(targetShiftX * targetShiftX + targetShiftY * targetShiftY);
        const turnDist = Math.sqrt(turnShiftX * turnShiftX + turnShiftY * turnShiftY);
        if (turnDist > curDist) { targetShiftX = turnShiftX; targetShiftY = turnShiftY; }
      }

      // Asymmetric lerp
      if (!pupilRef.current) pupilRef.current = { shiftX: 0, shiftY: 0 };
      const ps = pupilRef.current;
      const targetDist = Math.sqrt(targetShiftX * targetShiftX + targetShiftY * targetShiftY);
      const currentDist = Math.sqrt(ps.shiftX * ps.shiftX + ps.shiftY * ps.shiftY);
      const isReturning = targetDist < currentDist;
      const LERP_OUT = 0.10, LERP_BACK = 0.03;
      const lerpSpeed = isReturning ? LERP_BACK : LERP_OUT;
      if (targetDist < 0.1 && currentDist < 0.1) {
        ps.shiftX *= 0.97;
        ps.shiftY *= 0.97;
      } else {
        ps.shiftX += (targetShiftX - ps.shiftX) * lerpSpeed;
        ps.shiftY += (targetShiftY - ps.shiftY) * lerpSpeed;
      }

      for (const side of [-1, 1]) {
        const ex = hp.x + Math.cos(hp.a) * fwd + Math.cos(perp) * eyeOff * side;
        const ey = hp.y + Math.sin(hp.a) * fwd + Math.sin(perp) * eyeOff * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = EYE_BORDER_COLOR;
        ctx.lineWidth = EYE_BORDER_W;
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        const ppx = ex + ps.shiftX;
        const ppy = ey + ps.shiftY;
        ctx.fillStyle = '#111111';
        ctx.beginPath(); ctx.arc(ppx, ppy, pupR, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${HIGHLIGHT_OPACITY})`;
        ctx.beginPath(); ctx.arc(ppx - pupR * 0.3, ppy - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
      }

      // Face cosmetics
      if (equippedCosmetics) {
        const slots: Array<'wings'|'flag'|'ears'|'hat'|'goggles'|'mouth'|'nose'|'eyes'> = ['wings', 'flag', 'ears', 'hat', 'goggles', 'mouth', 'nose', 'eyes'];
        for (const slot of slots) {
          const id = equippedCosmetics[slot];
          if (!id || id === 'none') continue;
          const c = getCosmeticById(id);
          if (c) c.draw(ctx, { hx: hp.x, hy: hp.y, hr, angle: hp.a, time, boosting: false });
        }
      } else {
        renderEquippedCosmetics(ctx, { hx: hp.x, hy: hp.y, hr, angle: hp.a, time, boosting: false });
      }

      // Rarity glow
      if (asset.rarity === 'epic' || asset.rarity === 'legendary') {
        const gi = 0.2 + 0.1 * Math.sin(time * 0.003);
        ctx.save(); ctx.globalAlpha = gi;
        const gg = ctx.createRadialGradient(hp.x, hp.y, hr, hp.x, hp.y, hr * 2.5);
        gg.addColorStop(0, asset.bodyColor); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, hr * 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }, [skinId, segments, animated, assetOverride, equippedCosmetics]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouseRef.current = { x: (e.clientX - rect.left) * (width / rect.width), y: (e.clientY - rect.top) * (height / rect.height) };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove); c.addEventListener('mouseleave', onLeave);

    if (!animated) { draw(ctx, width, height, 0); return () => { c.removeEventListener('mousemove', onMove); c.removeEventListener('mouseleave', onLeave); }; }

    let running = true;
    const loop = (t: number) => { if (!running) return; draw(ctx, width, height, t); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); c.removeEventListener('mousemove', onMove); c.removeEventListener('mouseleave', onLeave); };
  }, [draw, width, height, animated]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} className={`block ${className}`} />;
}
