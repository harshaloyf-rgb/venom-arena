'use client';

/**
 * Reusable game-accurate roaming snake preview.
 * Supports two modes:
 *   1. Simple mode (skinId / headColor+bodyColor) — used in skin cards
 *   2. Lab mode (colors[] + bodyStyle + taperStyle + glow) — used in Genetic Lab
 *
 * Position state is stored in a persistent ref so color/style/segment
 * changes do NOT reset the snake's position (fixes the teleporting bug).
 */

import { useEffect, useRef } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';
import { resolveShapeStyle, computeTaperRadius, drawSegmentShape, readCustomSkinStateSafe } from './cosmetics-utils';
import type { BodyStyle, TaperStyle, CustomSegment } from './cosmetics-types';
import { renderEquippedCosmetics, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';

// ─── Color helpers ─────────────────────────────────────────────────────

function lightenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r + (255 - r) * factor).toString(16).padStart(2, '0')}${Math.round(g + (255 - g) * factor).toString(16).padStart(2, '0')}${Math.round(b + (255 - b) * factor).toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

// ─── Game rendering constants (exact match to render-snake-atlas.tsx) ──

const G = {
  segR: SNAKE_RADIUS * CAMERA_BASE_ZOOM,  // 16.2
  headScale: 1.3,
  step: 14,
  lighten: 0.35,
  lightenStop: 0.55,
  darken: 0.35,
  eyeR: 0.38,
  eyeOff: 0.42,
  eyeFwd: 0.32,
  pupR: 0.52,
  pupShift: 0.7,
  eyeBorderW: 1.5,
  eyeBorder: 'rgba(0,0,0,0.5)',
  highlight: 0.8,
  shadowBlur: 0.8,
  shadowOffY: 0.3,
};

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

// ─── Component ─────────────────────────────────────────────────────────

export function GameSnakePreview({
  skinId,
  headColor: headColorProp,
  bodyColor: bodyColorProp,
  width = 480,
  height = 220,
  segments = 24,
  speed = 1.8,
  scale = 1,
  showLabel = false,
  // Lab mode props
  colors,
  bodyStyle,
  taperStyle,
  glow,
  // Face cosmetics
  equippedCosmetics,
}: {
  skinId?: string;
  headColor?: string;
  bodyColor?: string;
  width?: number;
  height?: number;
  segments?: number;
  speed?: number;
  scale?: number;
  showLabel?: boolean;
  // Genetic Lab mode
  colors?: string[];
  bodyStyle?: BodyStyle;
  taperStyle?: TaperStyle;
  glow?: boolean;
  // Face cosmetics
  equippedCosmetics?: EquippedCosmetics | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  // Persistent position state — survives across effect re-runs
  const posRef = useRef<SnakePosState | null>(null);
  const bufRef = useRef<SnakeBuf | null>(null);
  const prevSegRef = useRef(segments);

  // Resolve colors for this render (stable, no side effects)
  const resolvedHead = (() => {
    if (colors && colors.length > 0) return colors[0];
    if (headColorProp) return headColorProp;
    if (skinId) {
      try { return getSkinAsset(skinId).headColor; } catch { /* */ }
    }
    return '#22c55e';
  })();

  const resolvedBody = (() => {
    if (colors && colors.length > 0) return colors[1] ?? colors[0];
    if (bodyColorProp) return bodyColorProp;
    if (skinId) {
      try { return getSkinAsset(skinId).bodyColor; } catch { /* */ }
    }
    return '#16a34a';
  })();

  // Auto-detect lab-mode props from localStorage when a skinId with custom
  // segments is equipped (e.g. presets stored via handleEquipSlitherPreset).
  let autoColors: string[] | undefined;
  let autoBodyStyle: BodyStyle | undefined;
  let autoTaper: TaperStyle | undefined;
  let autoGlow: boolean | undefined;
  if (skinId && !colors) {
    const stored = readCustomSkinStateSafe();
    if (stored?.useCustomSkin && stored.currentSkin === skinId && stored.customSkinSegments?.length) {
      const segs = stored.customSkinSegments;
      autoColors = segs.map((s: CustomSegment) => s.color);
      const shapes = new Set(segs.map((s: CustomSegment) => s.shape));
      if (shapes.has('spike') && shapes.size > 1) autoBodyStyle = 'dragon';
      else if (shapes.has('square')) autoBodyStyle = 'armored';
      else if (shapes.has('diamond')) autoBodyStyle = 'crystal';
      else if (shapes.has('spike')) autoBodyStyle = 'obsidian';
      else autoBodyStyle = 'smooth';
      // Detect taper from sizeScale variation
      const scales = segs.map((s: CustomSegment) => s.sizeScale);
      const hasVariation = Math.max(...scales) - Math.min(...scales) > 0.1;
      autoTaper = hasVariation ? 'natural' : 'uniform';
      autoGlow = segs.some((s: CustomSegment) => s.glow);
    }
  }
  const effectiveColors = colors ?? autoColors;
  const isLabMode = effectiveColors && effectiveColors.length > 0;
  const effectiveBodyStyle = bodyStyle ?? autoBodyStyle ?? 'smooth';
  const effectiveTaper = taperStyle ?? autoTaper ?? 'natural';
  const effectiveGlow = glow ?? autoGlow ?? false;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Mouse tracking
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);

    // Initialize or recover position from persistent ref
    if (!posRef.current || !posRef.current.initialized) {
      posRef.current = {
        headX: width * 0.5,
        headY: height * 0.5,
        angle: 0,
        targetAngle: 0,
        turnTimer: 0,
        nextTurn: 2000,
        bufCount: 0,
        initialized: true,
      };
    }

    // Reallocate buffer only if segment count changed
    const bufLen = segments * 6;
    if (!bufRef.current || prevSegRef.current !== segments) {
      bufRef.current = { bx: new Float64Array(bufLen), by: new Float64Array(bufLen) };
      posRef.current.bufCount = 0;
      prevSegRef.current = segments;
    }
    const { bx, by } = bufRef.current;

    const segR = G.segR * scale;
    const hr = segR * G.headScale;
    const wallM = Math.max(segR + 5, Math.min(width, height) * 0.3);

    // Capture current visual props in closure — they update when effect re-runs
    const curColors = effectiveColors;
    const curBodyStyle = effectiveBodyStyle;
    const curTaper = effectiveTaper;
    const curGlow = effectiveGlow;
    const curHeadCol = resolvedHead;
    const curBodyCol = resolvedBody;
    const curLabMode = isLabMode;
    const curCosmetics = equippedCosmetics ?? null;

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

      // ── Movement ──
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

      headX += Math.cos(angle) * speed;
      headY += Math.sin(angle) * speed;

      // Bounce
      if (headX < wallM) { targetAngle = 0; headX = wallM; }
      if (headX > width - wallM) { targetAngle = Math.PI; headX = width - wallM; }
      if (headY < wallM) { targetAngle = Math.PI / 2; headY = wallM; }
      if (headY > height - wallM) { targetAngle = -Math.PI / 2; headY = height - wallM; }

      // Persist position back to ref
      st.headX = headX;
      st.headY = headY;
      st.angle = angle;
      st.targetAngle = targetAngle;
      st.turnTimer = turnTimer;
      st.nextTurn = nextTurn;

      // Buffer
      for (let i = Math.min(bufCount, bufLen - 1); i > 0; i--) {
        bx[i] = bx[i - 1];
        by[i] = by[i - 1];
      }
      bx[0] = headX;
      by[0] = headY;
      bufCount = Math.min(bufCount + 1, bufLen);
      st.bufCount = bufCount;

      // Build segments
      const segs: { x: number; y: number; a: number }[] = [];
      let cx = headX, cy = headY, srcIdx = 0;
      segs.push({ x: cx, y: cy, a: angle });

      for (let s = 1; s < segments && srcIdx < bufCount - 1; s++) {
        let rem = G.step;
        while (rem > 0 && srcIdx < bufCount - 1) {
          const dx = bx[srcIdx + 1] - bx[srcIdx];
          const dy = by[srcIdx + 1] - by[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= rem) {
            cx = bx[srcIdx] + (dx / len) * rem;
            cy = by[srcIdx] + (dy / len) * rem;
            bx[srcIdx] = cx; by[srcIdx] = cy;
            rem = 0;
          } else {
            cx = bx[srcIdx + 1]; cy = by[srcIdx + 1];
            rem -= len; srcIdx++;
          }
        }
        const prev = segs[segs.length - 1];
        segs.push({ x: cx, y: cy, a: Math.atan2(cy - prev.y, cx - prev.x) });
      }

      // ── Draw ──
      ctx.clearRect(0, 0, width, height);

      // Background
      const bg = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
      bg.addColorStop(0, '#111118');
      bg.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
      }

      // Head color
      const headCol = curLabMode
        ? (curColors![0] ?? '#22c55e')
        : curHeadCol;

      ctx.save();
      if (!curGlow) {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = segR * G.shadowBlur;
        ctx.shadowOffsetY = segR * G.shadowOffY;
      }

      // Body segments
      for (let i = segs.length - 1; i >= 1; i--) {
        const p = segs[i];

        // Per-segment color
        let segColor: string;
        if (curLabMode) {
          segColor = curColors![i % curColors!.length] ?? '#ffffff';
        } else {
          segColor = curBodyCol;
        }

        // Per-segment taper radius (lab mode uses computed taper; simple mode = uniform)
        let rMul = 1.0;
        if (curLabMode) {
          rMul = computeTaperRadius(i, segments, curTaper);
        }
        const r = segR * rMul;

        // Per-segment shape
        const segShape = curLabMode
          ? resolveShapeStyle(curBodyStyle, i)
          : 'circle' as const;

        if (segShape === 'circle' && !curGlow) {
          const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
          grad.addColorStop(0, lightenHex(segColor, G.lighten));
          grad.addColorStop(G.lightenStop, segColor);
          grad.addColorStop(1, darkenHex(segColor, G.darken));
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        } else {
          drawSegmentShape(ctx, p.x, p.y, r, p.a, segShape, segColor, curGlow);
        }
      }
      ctx.restore();

      // Head — always circle with 3D gradient
      ctx.save();
      if (curGlow) {
        ctx.shadowBlur = hr * 1.8;
        ctx.shadowColor = headCol;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = hr * G.shadowBlur;
        ctx.shadowOffsetY = hr * G.shadowOffY;
      }
      const hg = ctx.createRadialGradient(headX - hr * 0.3, headY - hr * 0.3, hr * 0.05, headX, headY, hr);
      hg.addColorStop(0, lightenHex(headCol, G.lighten));
      hg.addColorStop(G.lightenStop, headCol);
      hg.addColorStop(1, darkenHex(headCol, G.darken));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(headX, headY, hr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Eyes
      const eyeOff = hr * G.eyeOff;
      const eyeR = hr * G.eyeR;
      const pupR = eyeR * G.pupR;
      const fwd = hr * G.eyeFwd;
      const perp = angle + Math.PI / 2;

      let lookA = angle;
      const m = mouseRef.current;
      if (m) {
        const dx = m.x - headX, dy = m.y - headY;
        if (Math.sqrt(dx * dx + dy * dy) > 5) lookA = Math.atan2(dy, dx);
      }

      for (const side of [-1, 1]) {
        const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
        const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = G.eyeBorder;
        ctx.lineWidth = G.eyeBorderW;
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        const shift = eyeR * G.pupShift;
        const ppx = ex + Math.cos(lookA) * shift;
        const ppy = ey + Math.sin(lookA) * shift;
        ctx.fillStyle = '#111111';
        ctx.beginPath(); ctx.arc(ppx, ppy, pupR, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${G.highlight})`;
        ctx.beginPath(); ctx.arc(ppx - pupR * 0.3, ppy - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
      }

      // Face cosmetics (rendered on top of default eyes)
      if (curCosmetics) {
        renderEquippedCosmetics(ctx, {
          hx: headX, hy: headY, hr, angle,
          time: performance.now(), boosting: false,
        });
      }

      // Direction pointer
      const ptrS = hr * 1.1, ptrL = hr * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round';
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
  }, [width, height, segments, speed, scale, resolvedHead, resolvedBody, effectiveBodyStyle, effectiveTaper, effectiveGlow, isLabMode, effectiveColors, equippedCosmetics]);

  // Get skin name for label
  let skinName = '';
  if (showLabel && skinId) {
    try {
      const asset = getSkinAsset(skinId);
      skinName = asset.name;
    } catch { /* no name */ }
  }

  return (
    <div className="flex flex-col items-center w-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="rounded-lg block"
      />
      {showLabel && skinName && (
        <span className="text-[9px] text-slate-500 mt-1 truncate max-w-full text-center leading-tight">
          {skinName}
        </span>
      )}
    </div>
  );
}
