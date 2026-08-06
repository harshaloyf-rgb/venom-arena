'use client';

/**
 * Reusable game-accurate roaming snake preview.
 * - Pre-simulates buffer on init so snake appears fully formed (no growing).
 * - Each instance gets unique movement via seeded hash of skinId/colors.
 * - economy mode: skips shadows, gradients, grid, cosmetics — for 30+ card grids.
 */

import { useEffect, useRef } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';
import { resolveShapeStyle, computeTaperRadius, drawSegmentShape, readCustomSkinStateSafe, getSkinVisualProps } from './cosmetics-utils';
import type { BodyStyle, TaperStyle, CustomSegment } from './cosmetics-types';
import { renderEquippedCosmetics, readEquippedCosmetics, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';

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

// ─── Seeded random for deterministic per-instance behavior ─────────────

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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

// Pre-allocated segment array (avoids GC pressure in 30+ canvas loops)
const _segs: { x: number; y: number; a: number }[] = [];
function ensureSegs(n: number) {
  if (_segs.length < n) {
    for (let i = _segs.length; i < n; i++) _segs.push({ x: 0, y: 0, a: 0 });
  }
  return _segs;
}

// ─── Component ─────────────────────────────────────────────────────────

export function GameSnakePreview({
  skinId,
  headColor: headColorProp,
  bodyColor: bodyColorProp,
  width = 480,
  height = 220,
  segments = 24,
  speed = 1.2,
  scale = 1,
  showLabel = false,
  economy = false,
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
  economy?: boolean;
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

  // Auto-detect lab-mode props: (1) pattern-based from skin registry,
  // (2) custom segments from localStorage (presets / DNA lab).
  let autoColors: string[] | undefined;
  let autoBodyStyle: BodyStyle | undefined;
  let autoTaper: TaperStyle | undefined;
  let autoGlow: boolean | undefined;
  if (skinId && !colors) {
    // 1. Check for custom segments in localStorage (presets / DNA lab)
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
      const scales = segs.map((s: CustomSegment) => s.sizeScale);
      const hasVariation = Math.max(...scales) - Math.min(...scales) > 0.1;
      autoTaper = hasVariation ? 'natural' : 'uniform';
      autoGlow = segs.some((s: CustomSegment) => s.glow);
    } else {
      // 2. Check for pattern-based visual props (manufactured skins)
      const vis = getSkinVisualProps(skinId);
      if (vis) {
        autoColors = vis.colors;
        autoBodyStyle = vis.bodyStyle;
        autoTaper = vis.taperStyle;
        autoGlow = vis.glow;
      }
    }
  }
  const effectiveColors = colors ?? autoColors;
  const isLabMode = effectiveColors && effectiveColors.length > 0;
  const effectiveBodyStyle = bodyStyle ?? autoBodyStyle ?? 'smooth';
  const effectiveTaper = taperStyle ?? autoTaper ?? 'natural';
  const effectiveGlow = glow ?? autoGlow ?? false;

  // Derive a unique seed from skinId or color combination
  const instanceSeed = (() => {
    if (skinId) return hashString(skinId);
    if (colors && colors.length > 0) return hashString(colors.join(','));
    return hashString(resolvedHead + resolvedBody);
  })();

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Mouse tracking (only for non-economy mode)
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    if (!economy) {
      c.addEventListener('mousemove', onMove);
      c.addEventListener('mouseleave', onLeave);
    }

    // Reallocate buffer only if segment count changed
    const bufLen = segments * 6;
    if (!bufRef.current || prevSegRef.current !== segments) {
      bufRef.current = { bx: new Float64Array(bufLen), by: new Float64Array(bufLen) };
      posRef.current = null; // Force fresh init with pre-simulation
      prevSegRef.current = segments;
    }
    const { bx, by } = bufRef.current;

    const segR = G.segR * scale;
    const hr = segR * G.headScale;
    const wallM = Math.max(segR + 5, Math.min(width, height) * 0.3);

    // Initialize with UNIQUE per-instance state + pre-simulate buffer
    if (!posRef.current || !posRef.current.initialized) {
      const rng = seededRandom(instanceSeed);
      const initAngle = rng() * Math.PI * 2;
      const offsetX = (rng() - 0.5) * width * 0.4;
      const offsetY = (rng() - 0.5) * height * 0.4;

      const startX = Math.max(wallM, Math.min(width - wallM, width * 0.5 + offsetX));
      const startY = Math.max(wallM, Math.min(height - wallM, height * 0.5 + offsetY));

      posRef.current = {
        headX: startX,
        headY: startY,
        angle: initAngle,
        targetAngle: initAngle + (rng() - 0.5) * 1.5,
        turnTimer: rng() * 1500,
        nextTurn: 1500 + rng() * 2000,
        bufCount: 0,
        initialized: true,
      };

      // PRE-SIMULATE: Walk the snake forward for bufLen frames to fill
      // the entire buffer. Snake appears fully formed from the first frame.
      const preRng = seededRandom(instanceSeed + 7919);
      let sx = startX, sy = startY, sa = initAngle;
      let sta = posRef.current.targetAngle;
      let stTimer = posRef.current.turnTimer;
      let stNext = posRef.current.nextTurn;

      for (let f = 0; f < bufLen; f++) {
        stTimer += 16;
        if (stTimer > stNext) {
          sta = sa + (preRng() - 0.5) * 1.8;
          stTimer = 0;
          stNext = 1500 + preRng() * 2000;
        }
        let d = sta - sa;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        sa += d * 0.04;

        sx += Math.cos(sa) * speed;
        sy += Math.sin(sa) * speed;

        // Bounce during pre-sim
        if (sx < wallM) { sta = 0; sx = wallM; }
        if (sx > width - wallM) { sta = Math.PI; sx = width - wallM; }
        if (sy < wallM) { sta = Math.PI / 2; sy = wallM; }
        if (sy > height - wallM) { sta = -Math.PI / 2; sy = height - wallM; }

        bx[f] = sx;
        by[f] = sy;
      }

      // Update state to post-simulation position
      posRef.current.headX = sx;
      posRef.current.headY = sy;
      posRef.current.angle = sa;
      posRef.current.targetAngle = sta;
      posRef.current.turnTimer = stTimer;
      posRef.current.nextTurn = stNext;
      posRef.current.bufCount = bufLen;
    }

    // Pre-compute colors for simple mode (avoids per-frame lightenHex/darkenHex)
    const bodyLight = !isLabMode ? lightenHex(resolvedBody, G.lighten) : '';
    const bodyDark = !isLabMode ? darkenHex(resolvedBody, G.darken) : '';
    const headLight = lightenHex(resolvedHead, G.lighten);
    const headDark = darkenHex(resolvedHead, G.darken);

    // Capture current visual props in closure
    const curColors = effectiveColors;
    const curBodyStyle = effectiveBodyStyle;
    const curTaper = effectiveTaper;
    const curGlow = effectiveGlow;
    const curHeadCol = resolvedHead;
    const curBodyCol = resolvedBody;
    const curLabMode = isLabMode;

    // Reusable segment array
    const segs = ensureSegs(segments);

    // Frame skip counter for economy mode (render every 2nd frame)
    let frameSkip = 0;

    let running = true;
    const loop = () => {
      if (!running) return;

      // Economy: skip every other frame for drawing (still simulate movement)
      frameSkip++;
      const shouldDraw = !economy || (frameSkip % 2 === 0);

      const st = posRef.current!;
      let headX = st.headX;
      let headY = st.headY;
      let angle = st.angle;
      let targetAngle = st.targetAngle;
      let turnTimer = st.turnTimer;
      let nextTurn = st.nextTurn;
      let bufCount = st.bufCount;

      // ── Movement (always simulate, even on skip frames) ──
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

      // ── Draw (skip on economy off-frames) ──
      if (!shouldDraw) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Build segments (reuse pre-allocated array)
      let segCount = 0;
      let cx = headX, cy = headY, srcIdx = 0;
      segs[0].x = cx; segs[0].y = cy; segs[0].a = angle;
      segCount = 1;

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
        const prev = segs[segCount - 1];
        segs[segCount].x = cx; segs[segCount].y = cy; segs[segCount].a = Math.atan2(cy - prev.y, cx - prev.x);
        segCount++;
      }

      // Clear & background
      ctx.clearRect(0, 0, width, height);
      if (economy) {
        // Flat background — no gradient
        ctx.fillStyle = '#0e0e14';
        ctx.fillRect(0, 0, width, height);
      } else {
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
      }

      // Head color
      const headCol = curLabMode ? (curColors![0] ?? '#22c55e') : curHeadCol;

      // Body segments
      if (economy) {
        // ECONOMY: no shadows, flat fills for circles, skip cosmetics
        for (let i = segCount - 1; i >= 1; i--) {
          const p = segs[i];
          let segColor: string;
          if (curLabMode) {
            segColor = curColors![i % curColors!.length] ?? '#ffffff';
          } else {
            segColor = curBodyCol;
          }
          let rMul = 1.0;
          if (curLabMode) rMul = computeTaperRadius(i, segments, curTaper);
          const r = segR * rMul;
          const segShape = curLabMode ? resolveShapeStyle(curBodyStyle, i) : 'circle' as const;

          if (segShape === 'circle' && !curGlow && !curLabMode) {
            const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
            grad.addColorStop(0, bodyLight);
            grad.addColorStop(G.lightenStop, segColor);
            grad.addColorStop(1, bodyDark);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          } else {
            drawSegmentShape(ctx, p.x, p.y, r, p.a, segShape, segColor, curGlow);
          }
        }

        // Head — simple gradient, no shadow
        const hg = ctx.createRadialGradient(headX - hr * 0.3, headY - hr * 0.3, hr * 0.05, headX, headY, hr);
        hg.addColorStop(0, headLight);
        hg.addColorStop(G.lightenStop, headCol);
        hg.addColorStop(1, headDark);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(headX, headY, hr, 0, Math.PI * 2); ctx.fill();

        // Simple eyes (no mouse tracking, no cosmetics)
        const eyeOff = hr * G.eyeOff;
        const eyeR = hr * G.eyeR;
        const pupR = eyeR * G.pupR;
        const fwd = hr * G.eyeFwd;
        const perp = angle + Math.PI / 2;
        for (const side of [-1, 1]) {
          const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
          const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
          const shift = eyeR * G.pupShift;
          ctx.fillStyle = '#111111';
          ctx.beginPath(); ctx.arc(ex + Math.cos(angle) * shift, ey + Math.sin(angle) * shift, pupR, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${G.highlight})`;
          ctx.beginPath(); ctx.arc(ex + Math.cos(angle) * shift - pupR * 0.3, ey + Math.sin(angle) * shift - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // FULL MODE: shadows, gradients, mouse-tracking eyes, cosmetics
        ctx.save();
        if (!curGlow) {
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = segR * G.shadowBlur;
          ctx.shadowOffsetY = segR * G.shadowOffY;
        }

        for (let i = segCount - 1; i >= 1; i--) {
          const p = segs[i];
          let segColor: string;
          if (curLabMode) {
            segColor = curColors![i % curColors!.length] ?? '#ffffff';
          } else {
            segColor = curBodyCol;
          }
          let rMul = 1.0;
          if (curLabMode) rMul = computeTaperRadius(i, segments, curTaper);
          const r = segR * rMul;
          const segShape = curLabMode ? resolveShapeStyle(curBodyStyle, i) : 'circle' as const;

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

        // Head
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

        // Responsive eyes
        const eq = readEquippedCosmetics();
        const hasCustomEyes = eq.eyes && eq.eyes !== 'none';

        if (!hasCustomEyes) {
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
        }

        // All equipped face cosmetics
        renderEquippedCosmetics(ctx, {
          hx: headX, hy: headY, hr, angle,
          time: performance.now(), boosting: false,
        });
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      if (!economy) {
        c.removeEventListener('mousemove', onMove);
        c.removeEventListener('mouseleave', onLeave);
      }
    };
  }, [width, height, segments, speed, scale, resolvedHead, resolvedBody, effectiveBodyStyle, effectiveTaper, effectiveGlow, isLabMode, effectiveColors, instanceSeed, economy]);

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
