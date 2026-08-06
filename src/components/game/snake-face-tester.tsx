'use client';

/**
 * Snake Game Skin Tester — single canvas showing a moving snake
 * rendered with exact game parameters (zoom, eyes, shadow, gradient).
 *
 * Supports two modes:
 *   1. **Standalone** (default): shows skin selector buttons, fixed 580×260
 *   2. **Embedded** (embedded=true): accepts skinId/equippedCosmetics props,
 *      reads custom segments from localStorage, applies face cosmetics,
 *      configurable width/height/segments/scale.
 */

import { useEffect, useRef, useState } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';
import {
  readCustomSkinStateSafe,
  resolveShapeStyle,
  computeTaperRadius,
  drawSegmentShape,
} from '@/components/panels/cosmetics/cosmetics-utils';
import { renderEquippedCosmetics } from '@/lib/snake/face-cosmetics';
import type { CustomSegment, BodyStyle, TaperStyle } from '@/components/panels/cosmetics/cosmetics-types';

// ─── Color helpers ─────────────────────────────────────────────────────

function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

// ─── Game rendering params (exact match to render-snake-atlas.tsx) ─────

const GAME = {
  segRadius: SNAKE_RADIUS * CAMERA_BASE_ZOOM,  // 12 * 1.35 = 16.2
  headScale: 1.3,
  segStep: 14,
  lightenFactor: 0.35,
  lightenStop: 0.55,
  darkenFactor: 0.35,
  eyeRadiusRatio: 0.38,
  eyeOffsetRatio: 0.42,
  eyeForwardRatio: 0.32,
  pupilRadiusRatio: 0.52,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1.5,
  eyeBorderColor: 'rgba(0,0,0,0.5)',
  highlightOpacity: 0.8,
  shadowBlurRatio: 0.8,
  shadowOffsetYRatio: 0.3,
};

// ─── Skins (standalone mode) ──────────────────────────────────────────

const TEST_SKINS = [
  { id: 'skin-emerald', label: 'Emerald' },
  { id: 'skin-crimson', label: 'Crimson' },
  { id: 'skin-arctic', label: 'Arctic' },
  { id: 'skin-gold', label: 'Gold' },
  { id: 'skin-neon-pink', label: 'Neon Pink' },
  { id: 'skin-shadow', label: 'Shadow' },
];

// ─── Persistent position state (survives across effect re-runs) ───────
interface SnakePosState {
  headX: number;
  headY: number;
  angle: number;
  targetAngle: number;
  turnTimer: number;
  nextTurn: number;
  bufCount: number;
  initialized: boolean;
}

interface SnakeBuf {
  bx: Float64Array;
  by: Float64Array;
}

// ─── Detect custom skin mode from localStorage ────────────────────────

function getCustomSkinForId(skinId: string): {
  segments: CustomSegment[];
  colors: string[];
  bodyStyle: BodyStyle;
  taperStyle: TaperStyle;
  glow: boolean;
} | null {
  const stored = readCustomSkinStateSafe();
  if (!stored?.useCustomSkin || stored.currentSkin !== skinId || !stored.customSkinSegments?.length) {
    return null;
  }
  const segs = stored.customSkinSegments;
  const colors = segs.map((s: CustomSegment) => s.color);

  // Detect body style from shapes
  const shapes = new Set(segs.map((s: CustomSegment) => s.shape));
  let bodyStyle: BodyStyle = 'smooth';
  if (shapes.has('spike') && shapes.size > 1) bodyStyle = 'dragon';
  else if (shapes.has('square')) bodyStyle = 'armored';
  else if (shapes.has('diamond')) bodyStyle = 'crystal';
  else if (shapes.has('spike')) bodyStyle = 'obsidian';
  else if (shapes.has('star')) bodyStyle = 'stellar';
  else if (shapes.has('hexagon')) bodyStyle = 'fortress';
  else if (shapes.has('triangle')) bodyStyle = 'stingray';
  else if (shapes.has('ring')) bodyStyle = 'phantom';

  // Detect taper from sizeScale variation
  const scales = segs.map((s: CustomSegment) => s.sizeScale);
  const hasVariation = Math.max(...scales) - Math.min(...scales) > 0.1;
  const taperStyle: TaperStyle = hasVariation ? 'natural' : 'uniform';

  // Detect glow
  const glow = segs.some((s: CustomSegment) => s.glow);

  return { segments: segs, colors, bodyStyle, taperStyle, glow };
}

// ─── Main component ────────────────────────────────────────────────────

export function SnakeFaceTester({
  embedded = false,
  skinId,
  width = 580,
  height = 260,
  segments = 24,
  speed = 1.8,
  scale = 1,
}: {
  /** When true, hides skin selector buttons and uses skinId prop */
  embedded?: boolean;
  /** Skin to render (embedded mode or standalone override) */
  skinId?: string;
  /** Canvas logical width */
  width?: number;
  /** Canvas logical height */
  height?: number;
  /** Number of body segments */
  segments?: number;
  /** Movement speed */
  speed?: number;
  /** Scale multiplier for segment radius */
  scale?: number;
}) {
  const [selectedSkin, setSelectedSkin] = useState(skinId ?? 'skin-emerald');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  // Persistent position state — survives across effect re-runs
  const posRef = useRef<SnakePosState | null>(null);
  const bufRef = useRef<SnakeBuf | null>(null);
  const prevSegRef = useRef(segments);
  const prevWRef = useRef(width);
  const prevHRef = useRef(height);

  // Effective skin for rendering
  const effectiveSkinId = embedded && skinId ? skinId : selectedSkin;

  // Detect custom skin data for this skinId
  const customSkin = effectiveSkinId ? getCustomSkinForId(effectiveSkinId) : null;
  const isCustomMode = !!customSkin;

  // Resolve base colors
  let headColor = '#22c55e';
  let bodyColor = '#16a34a';
  if (effectiveSkinId) {
    try {
      const asset = getSkinAsset(effectiveSkinId);
      headColor = asset.headColor;
      bodyColor = asset.bodyColor;
    } catch { /* defaults */ }
  }
  // In custom mode, head uses first custom segment color
  if (isCustomMode && customSkin!.colors.length > 0) {
    headColor = customSkin!.colors[0];
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const W = width;
    const H = height;
    const SEGMENTS = segments;
    const SPEED = speed;

    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Mouse tracking on canvas
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);

    // Initialize or recover position from persistent ref
    if (!posRef.current || !posRef.current.initialized || prevWRef.current !== W || prevHRef.current !== H) {
      posRef.current = {
        headX: W * 0.5,
        headY: H * 0.5,
        angle: 0,
        targetAngle: 0,
        turnTimer: 0,
        nextTurn: 2000,
        bufCount: 0,
        initialized: true,
      };
      prevWRef.current = W;
      prevHRef.current = H;
    }

    // Reallocate buffer only if segment count changed
    const bufLen = SEGMENTS * 6;
    if (!bufRef.current || prevSegRef.current !== SEGMENTS) {
      bufRef.current = { bx: new Float64Array(bufLen), by: new Float64Array(bufLen) };
      posRef.current.bufCount = 0;
      prevSegRef.current = SEGMENTS;
    }
    const { bx, by } = bufRef.current;

    const segR = GAME.segRadius * scale;
    const hr = segR * GAME.headScale;
    const wallM = Math.max(segR + 5, Math.min(W, H) * 0.3);

    // Capture visual props in closure
    const curHeadColor = headColor;
    const curBodyColor = bodyColor;
    const curCustomSkin = customSkin;
    const curIsCustom = isCustomMode;

    let running = true;
    const loop = () => {
      if (!running) return;

      const st = posRef.current!;
      let headX = st.headX;
      let headY = st.headY;
      let angle = st.angle;
      let targetAngle = st.targetAngle;
      let turnTimer = st.turnTimer;
      let nextTurn = st.nextTurn;
      let bufCount = st.bufCount;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Update movement ──
      turnTimer += 16;
      if (turnTimer > nextTurn) {
        targetAngle = angle + (Math.random() - 0.5) * 1.8;
        turnTimer = 0;
        nextTurn = 1500 + Math.random() * 2000;
      }

      let diff = targetAngle - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      angle += diff * 0.04;

      headX += Math.cos(angle) * SPEED;
      headY += Math.sin(angle) * SPEED;

      // Bounce off walls
      if (headX < wallM) { targetAngle = 0; headX = wallM; }
      if (headX > W - wallM) { targetAngle = Math.PI; headX = W - wallM; }
      if (headY < wallM) { targetAngle = Math.PI / 2; headY = wallM; }
      if (headY > H - wallM) { targetAngle = -Math.PI / 2; headY = H - wallM; }

      // Persist position back to ref
      st.headX = headX;
      st.headY = headY;
      st.angle = angle;
      st.targetAngle = targetAngle;
      st.turnTimer = turnTimer;
      st.nextTurn = nextTurn;

      // Prepend to buffer
      for (let i = Math.min(bufCount, bufLen - 1); i > 0; i--) {
        bx[i] = bx[i - 1];
        by[i] = by[i - 1];
      }
      bx[0] = headX;
      by[0] = headY;
      bufCount = Math.min(bufCount + 1, bufLen);
      st.bufCount = bufCount;

      // ── Build segment positions from buffer ──
      const segs: { x: number; y: number; a: number }[] = [];
      let cx = headX, cy = headY;
      let srcIdx = 0;
      segs.push({ x: cx, y: cy, a: angle });

      for (let s = 1; s < SEGMENTS && srcIdx < bufCount - 1; s++) {
        let remaining = GAME.segStep;
        while (remaining > 0 && srcIdx < bufCount - 1) {
          const dx = bx[srcIdx + 1] - bx[srcIdx];
          const dy = by[srcIdx + 1] - by[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= remaining) {
            cx = bx[srcIdx] + (dx / len) * remaining;
            cy = by[srcIdx] + (dy / len) * remaining;
            bx[srcIdx] = cx;
            by[srcIdx] = cy;
            remaining = 0;
          } else {
            cx = bx[srcIdx + 1];
            cy = by[srcIdx + 1];
            remaining -= len;
            srcIdx++;
          }
        }
        const prev = segs[segs.length - 1];
        segs.push({ x: cx, y: cy, a: Math.atan2(cy - prev.y, cx - prev.x) });
      }

      // ── Draw ──
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      bg.addColorStop(0, '#111118');
      bg.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // ── Body segments ──
      ctx.save();

      if (curIsCustom && curCustomSkin) {
        // Custom skin mode: per-segment shape, color, taper, glow
        for (let i = segs.length - 1; i >= 1; i--) {
          const p = segs[i];
          const segData = curCustomSkin.segments[i % curCustomSkin.segments.length];
          const segColor = segData.color;
          const segShape = segData.shape;
          const segGlow = segData.glow;
          const segSizeScale = segData.sizeScale;
          const r = segR * segSizeScale;

          if (segShape === 'circle' && !segGlow) {
            // Standard 3D gradient circle
            if (!segGlow) {
              ctx.shadowColor = 'rgba(0,0,0,0.3)';
              ctx.shadowBlur = r * GAME.shadowBlurRatio;
              ctx.shadowOffsetY = r * GAME.shadowOffsetYRatio;
            }
            const grad = ctx.createRadialGradient(
              p.x - r * 0.3, p.y - r * 0.3, r * 0.1,
              p.x, p.y, r,
            );
            grad.addColorStop(0, lightenHex(segColor, GAME.lightenFactor));
            grad.addColorStop(GAME.lightenStop, segColor);
            grad.addColorStop(1, darkenHex(segColor, GAME.darkenFactor));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
          } else {
            // Custom shape or glow
            drawSegmentShape(ctx, p.x, p.y, r, p.a, segShape, segColor, segGlow);
          }
        }
      } else {
        // Standard mode: uniform body color with 3D gradient circles
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = segR * GAME.shadowBlurRatio;
        ctx.shadowOffsetY = segR * GAME.shadowOffsetYRatio;

        for (let i = segs.length - 1; i >= 1; i--) {
          const p = segs[i];
          const grad = ctx.createRadialGradient(
            p.x - segR * 0.3, p.y - segR * 0.3, segR * 0.1,
            p.x, p.y, segR,
          );
          grad.addColorStop(0, lightenHex(curBodyColor, GAME.lightenFactor));
          grad.addColorStop(GAME.lightenStop, curBodyColor);
          grad.addColorStop(1, darkenHex(curBodyColor, GAME.darkenFactor));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, segR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // ── Head — always circle with 3D gradient ──
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = hr * GAME.shadowBlurRatio;
      ctx.shadowOffsetY = hr * GAME.shadowOffsetYRatio;

      const hg = ctx.createRadialGradient(
        headX - hr * 0.3, headY - hr * 0.3, hr * 0.05,
        headX, headY, hr,
      );
      hg.addColorStop(0, lightenHex(curHeadColor, GAME.lightenFactor));
      hg.addColorStop(GAME.lightenStop, curHeadColor);
      hg.addColorStop(1, darkenHex(curHeadColor, GAME.darkenFactor));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(headX, headY, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── Eyes ──
      const eyeOff = hr * GAME.eyeOffsetRatio;
      const eyeR = hr * GAME.eyeRadiusRatio;
      const pupilR = eyeR * GAME.pupilRadiusRatio;
      const fwd = hr * GAME.eyeForwardRatio;
      const perp = angle + Math.PI / 2;

      let lookA = angle;
      const m = mouseRef.current;
      if (m) {
        const dx = m.x - headX;
        const dy = m.y - headY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) lookA = Math.atan2(dy, dx);
      }

      for (const side of [-1, 1]) {
        const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
        const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = GAME.eyeBorderColor;
        ctx.lineWidth = GAME.eyeBorderWidth;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        const shift = eyeR * GAME.pupilShiftRatio;
        const ppx = ex + Math.cos(lookA) * shift;
        const ppy = ey + Math.sin(lookA) * shift;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ppx, ppy, pupilR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${GAME.highlightOpacity})`;
        ctx.beginPath();
        ctx.arc(ppx - pupilR * 0.3, ppy - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Face cosmetics (embedded mode) ──
      if (embedded) {
        renderEquippedCosmetics(ctx, {
          hx: headX, hy: headY, hr, angle,
          time: performance.now(), boosting: false,
        });
      }

      // ── Direction pointer ──
      const ptrS = hr * 1.1;
      const ptrL = hr * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX + Math.cos(angle) * ptrS, headY + Math.sin(angle) * ptrS);
      ctx.lineTo(headX + Math.cos(angle) * (ptrS + ptrL), headY + Math.sin(angle) * (ptrS + ptrL));
      ctx.stroke();

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
    };
  }, [width, height, segments, speed, scale, effectiveSkinId, headColor, bodyColor, customSkin, isCustomMode, embedded]);

  // ── Render ──
  if (embedded) {
    return (
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg cursor-crosshair border border-white/10 w-full max-w-full"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Game Snake Tester</h2>
        <p className="text-sm text-white/50 mt-1">Exact game rendering params — hover to track eyes</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {TEST_SKINS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSkin(s.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedSkin === s.id
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
            }`
          }
          >
            {s.label}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg cursor-crosshair border border-white/10 w-full max-w-full mx-auto"
      />
    </div>
  );
}
