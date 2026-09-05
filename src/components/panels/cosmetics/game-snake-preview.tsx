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
import { resolveShapeStyle, computeTaperRadius, drawSegmentShape, readCustomSkinStateSafe, getSkinVisualProps, lightenHex, darkenHex } from './cosmetics-utils';
import { drawCharacterFace, getCharacterFaceForSkin } from './character-faces';
import type { BodyStyle, TaperStyle, CustomSegment } from './cosmetics-types';
import { getCosmeticById, readEquippedCosmetics, type EquippedCosmetics } from '@/lib/snake/face-cosmetics';

// ─── Seeded random for deterministic per-instance behavior ─────

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
  segR: SNAKE_RADIUS * CAMERA_BASE_ZOOM,  // 4.8
  // GAME PARITY (2026-09-05): was 1.3 — shop heads looked fatter than the
  // arena. Game fallback/atlas paths draw the head at 1.05 × body radius
  // (render-snake-atlas.tsx headScale / headDrawSize), 1.0 for uniform taper.
  headScale: 1.05,
  // step is now computed dynamically: segR * 1.35 (matches game density)
  step: 0, // placeholder — overridden by local variable
  stepRatio: 1.35, // step = segR * stepRatio  (game ≈ 0.667 * diameter)
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

// ─── Persistent position state (survives across effect re-runs) ────
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

// ─── Component ──────────────────────────────────

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
  responsive = false,
  // Lab mode props
  colors,
  bodyStyle,
  taperStyle,
  glow,
  // Face cosmetics
  equippedCosmetics,
  showCosmetics = false,
  // Premium character-face skin (explicit id wins; otherwise resolved from skinId)
  characterFace,
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
  responsive?: boolean;
  // Genetic Lab mode
  colors?: string[];
  bodyStyle?: BodyStyle;
  taperStyle?: TaperStyle;
  glow?: boolean;
  // Face cosmetics
  equippedCosmetics?: EquippedCosmetics | null;
  /** ONLY the Face Cosmetics equip editor sets this — shows equipped cosmetics
   *  on the preview snake. Every other preview stays pure (product rule). */
  showCosmetics?: boolean;
  // Premium character-face skin
  characterFace?: string | null;
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
    // Character-face skins: the head circle IS the face base — explicit
    // headColor wins over colors[0] (which holds the BODY color there).
    if (characterFace && headColorProp) return headColorProp;
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

  // Premium character-face skin: explicit prop wins, else resolve via skinId.
  // The face REPLACES the default eyes (it draws its own).
  const resolvedFace = (() => {
    if (characterFace) return characterFace;
    if (skinId) {
      try { return getCharacterFaceForSkin(skinId); } catch { /* */ }
    }
    return null;
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
      // Skip index 0 when detecting taper — it may have stale sizeScale from old code
      const scales = segs.length > 2
        ? segs.slice(1).map((s: CustomSegment) => s.sizeScale)
        : segs.map((s: CustomSegment) => s.sizeScale);
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
  // Glow disabled in previews — glow only renders in-game while boosting
  const effectiveGlow = false;

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

    // Mouse tracking (always — cheap, only fires on hover)
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

    // Segment radius and wall margin (needed for step computation)
    const segR = G.segR * scale;
    const wallM = Math.max(segR + 5, Math.min(width, height) * 0.3);

    // Compute step to match game visual density:
    // Game: bodyDrawStep = max(bodyRadius*1.3, 4) / min(zoom,1)
    // In screen space: step_screen = bodyDrawStep * zoom = ~6.4px
    // With segR=4.8, diameter=9.6, ratio = 6.4/9.6 ≈ 0.667
    // step = diameter * 0.667 = segR * 2 * 0.667 = segR * 1.33
    const localStep = segR * G.stepRatio;

    // Reallocate buffer only if segment count changed
    // Need more buffer entries for tighter spacing
    // step/speed = entries per segment. Buffer must hold segments * entries.
    const entriesPerSeg = Math.ceil(localStep / speed) + 2;
    // Head pad: body segment 0 now starts one full draw-step BEHIND the head
    // (game parity), so the buffer needs one extra step worth of entries.
    const headPad = entriesPerSeg + 2;
    const bufLen = (economy
      ? segments * Math.min(entriesPerSeg, 8)
      : segments * Math.min(entriesPerSeg * 2, 24)) + headPad;
    if (!bufRef.current || prevSegRef.current !== segments) {
      bufRef.current = { bx: new Float64Array(bufLen), by: new Float64Array(bufLen) };
      posRef.current = null; // Force fresh init with pre-simulation
      prevSegRef.current = segments;
    }
    const { bx, by } = bufRef.current;

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

    // Pre-compute colors for ALL modes (avoids per-frame lightenHex/darkenHex)
    const headLight = lightenHex(resolvedHead, G.lighten);
    const headDark = darkenHex(resolvedHead, G.darken);

    // For non-lab (single color) — pre-compute once
    const bodyLight = !isLabMode ? lightenHex(resolvedBody, G.lighten) : '';
    const bodyDark = !isLabMode ? darkenHex(resolvedBody, G.darken) : '';

    // For lab mode — pre-compute lighten/darken for each unique color
    const labColorMap = new Map<string, { light: string; dark: string }>();
    if (isLabMode && effectiveColors) {
      const seen = new Set<string>();
      for (const c of effectiveColors) {
        if (!seen.has(c)) {
          seen.add(c);
          labColorMap.set(c, { light: lightenHex(c, G.lighten), dark: darkenHex(c, G.darken) });
        }
      }
    }

    // PRODUCT RULE (2026-09-05): NO equipped cosmetics in ANY snake preview by
    // default — previews show the pure skin (default eyes unless a character
    // face owns the head). ONLY the Face Cosmetics equip editor passes
    // showCosmetics so users can see what they are equipping.
    const cachedEquipped = showCosmetics ? readEquippedCosmetics() : null;
    const hasCustomEyesCached = !!(cachedEquipped?.eyes && cachedEquipped.eyes !== 'none');

    // Pre-cache cosmetic draw functions (avoid getCosmeticById lookup every frame)
    const cosmeticSlots: Array<'wings'|'flag'|'ears'|'hat'|'goggles'|'mouth'|'nose'|'eyes'> =
      ['wings', 'flag', 'ears', 'hat', 'goggles', 'mouth', 'nose', 'eyes'];
    const cachedCosmetics: Array<{ draw: (ctx: CanvasRenderingContext2D, p: any) => void } | null> = [];
    for (const slot of cosmeticSlots) {
      const id = cachedEquipped?.[slot as keyof EquippedCosmetics];
      if (!id || id === 'none') { cachedCosmetics.push(null); continue; }
      cachedCosmetics.push(getCosmeticById(id) ?? null);
    }

    // Pre-compute taper radii (avoid per-frame math for lab mode)
    const precomputedTaper = new Float64Array(segments);
    if (isLabMode) {
      for (let i = 0; i < segments; i++) {
        precomputedTaper[i] = computeTaperRadius(i, segments, effectiveTaper);
      }
    }

    // Capture current visual props in closure
    const curColors = effectiveColors;
    const curBodyStyle = effectiveBodyStyle;
    const curTaper = effectiveTaper;
    const curGlow = effectiveGlow;
    // Head matches body size when taper is uniform
    const effectiveHeadScale = curTaper === 'uniform' ? 1.0 : G.headScale;
    const hr = segR * effectiveHeadScale;
    const curHeadCol = resolvedHead;
    const curBodyCol = resolvedBody;
    const curLabMode = isLabMode;
    const curFace = resolvedFace;

    // Reusable segment array
    const segs = ensureSegs(segments);

    // Frame skip counter for economy mode (render every 2nd frame)
    let frameSkip = 0;

    // Visibility tracking — pause rAF when off-screen (huge perf win with 20+ cards)
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        // Resume loop if became visible and not already running
        if (isVisible && running && !animRef.current) {
          animRef.current = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.0 }, // trigger as soon as any pixel enters/exits
    );
    observer.observe(c);

    let running = true;
    const loop = () => {
      if (!running) return;

      // Off-screen → skip entirely (no movement sim, no draw, no rAF)
      if (!isVisible) {
        animRef.current = 0;
        return;
      }

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
      // GAME PARITY FIX (2026-09-05) — "coin snake arrowhead on the face":
      // The game renderer (walkPathFixedStep) starts the body ONE full draw-step
      // BEHIND the head, and every body-segment angle points TAIL-WARD. The
      // preview used to pin segment 0 AT the head center with a FORWARD angle,
      // so forward-pointing shapes (obsidian spikes, stingray triangles) poked
      // out past the face in previews but never in-game.
      let segCount = 0;
      let cx = headX, cy = headY, srcIdx = 0;
      const advance = (dist: number): void => {
        let rem = dist;
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
      };

      // Segment 0 sits one full step behind the head, angle tail-ward —
      // exactly where walkPathFixedStep places walked[0] in-game.
      advance(localStep);
      segs[0].x = cx; segs[0].y = cy;
      segs[0].a = Math.atan2(cy - headY, cx - headX);
      segCount = 1;

      for (let s = 1; s < segments && srcIdx < bufCount - 1; s++) {
        advance(localStep);
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

      // Head color — character-face skins always use the face base color
      const headCol = curFace ? curHeadCol : (curLabMode ? (curColors![0] ?? '#22c55e') : curHeadCol);

      // ── Body spine line (matches game renderer — fills any gaps) ──
      // GAME PARITY: spine starts AT THE HEAD (game JUNCTION FIX) and uses the
      // game's 1.6× width / 0.85 alpha.
      if (segCount > 1) {
        ctx.save();
        ctx.strokeStyle = curLabMode ? (curColors![0] ?? curBodyCol) : curBodyCol;
        ctx.lineWidth = segR * 1.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        for (let i = 0; i < segCount; i++) {
          ctx.lineTo(segs[i].x, segs[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Body segments
      if (economy) {
        // ECONOMY: no shadows, flat fills for circles, skip cosmetics
        for (let i = segCount - 1; i >= 0; i--) {
          const p = segs[i];
          let segColor: string;
          if (curLabMode) {
            segColor = curColors![i % curColors!.length] ?? '#ffffff';
          } else {
            segColor = curBodyCol;
          }
          let rMul = 1.0;
          if (curLabMode) rMul = precomputedTaper[i];
          const r = segR * rMul;
          const segShape = curLabMode ? resolveShapeStyle(curBodyStyle, i) : 'circle' as const;

          if (segShape === 'circle' && !curGlow) {
            const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
            const cm = curLabMode ? labColorMap.get(segColor) : null;
            grad.addColorStop(0, cm ? cm.light : bodyLight);
            grad.addColorStop(G.lightenStop, segColor);
            grad.addColorStop(1, cm ? cm.dark : bodyDark);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          } else {
            drawSegmentShape(ctx, p.x, p.y, r, p.a, segShape, segColor, curGlow);
          }
        }

        // Head — simple gradient, no shadow.
        // Character-face skins: NO fill — the face paints its own full head.
        if (!curFace) {
          const hg = ctx.createRadialGradient(headX - hr * 0.3, headY - hr * 0.3, hr * 0.05, headX, headY, hr);
          hg.addColorStop(0, headLight);
          hg.addColorStop(G.lightenStop, headCol);
          hg.addColorStop(1, headDark);
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(headX, headY, hr, 0, Math.PI * 2); ctx.fill();
        }

        // Full character head (replaces fill + default eyes entirely)
        if (curFace) {
          drawCharacterFace(ctx, headX, headY, hr, angle, curFace, performance.now());
        }

        // Responsive eyes (deadzone + relative tracking, same as game canvas)
        if (!curFace) {
        const eyeOff = hr * G.eyeOff;
        const eyeR = hr * G.eyeR;
        const pupR = eyeR * G.pupR;
        const fwd = hr * G.eyeFwd;
        const perp = angle + Math.PI / 2;
        const maxShift = eyeR * G.pupShift;
        const now = performance.now();

        // Compute delta angle (mouse relative to head direction)
        let deltaAngle = 0;
        const m = mouseRef.current;
        if (m) {
          const dx = m.x - headX, dy = m.y - headY;
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            const rawLook = Math.atan2(dy, dx);
            deltaAngle = rawLook - angle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
          }
        }
        const absDelta = Math.abs(deltaAngle);
        const DEADZONE = 0.12, FULL_ZONE = 0.45;
        const shiftRatio = absDelta < DEADZONE ? 0 : absDelta < FULL_ZONE ? (absDelta - DEADZONE) / (FULL_ZONE - DEADZONE) : 1;
        const pupilShift = maxShift * shiftRatio;
        const lookDir = absDelta < 0.001 ? angle : angle + deltaAngle;

        for (const side of [-1, 1]) {
          const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
          const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
          const ppx = ex + Math.cos(lookDir) * pupilShift;
          const ppy = ey + Math.sin(lookDir) * pupilShift;
          ctx.fillStyle = '#111111';
          ctx.beginPath(); ctx.arc(ppx, ppy, pupR, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${G.highlight})`;
          ctx.beginPath(); ctx.arc(ppx - pupR * 0.3, ppy - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        }
      } else {
        // FULL MODE: shadows, gradients, mouse-tracking eyes, cosmetics
        // ── Body spine line (matches game renderer) ──
        if (segCount > 1) {
          ctx.save();
          ctx.strokeStyle = curLabMode ? (curColors![0] ?? curBodyCol) : curBodyCol;
          ctx.lineWidth = segR * 1.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          for (let i = 0; i < segCount; i++) {
            ctx.lineTo(segs[i].x, segs[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        if (!curGlow) {
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = segR * G.shadowBlur;
          ctx.shadowOffsetY = segR * G.shadowOffY;
        }

        for (let i = segCount - 1; i >= 0; i--) {
          const p = segs[i];
          let segColor: string;
          if (curLabMode) {
            segColor = curColors![i % curColors!.length] ?? '#ffffff';
          } else {
            segColor = curBodyCol;
          }
          let rMul = 1.0;
          if (curLabMode) rMul = precomputedTaper[i];
          const r = segR * rMul;
          const segShape = curLabMode ? resolveShapeStyle(curBodyStyle, i) : 'circle' as const;

          if (segShape === 'circle' && !curGlow) {
            const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
            const cm = curLabMode ? labColorMap.get(segColor) : null;
            grad.addColorStop(0, cm ? cm.light : bodyLight);
            grad.addColorStop(G.lightenStop, segColor);
            grad.addColorStop(1, cm ? cm.dark : bodyDark);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          } else {
            drawSegmentShape(ctx, p.x, p.y, r, p.a, segShape, segColor, curGlow);
          }
        }
        ctx.restore();

        // Head
        // Character-face skins: no shadow/fill — the face paints its own head
        if (curFace) {
          drawCharacterFace(ctx, headX, headY, hr, angle, curFace, performance.now());
        } else {
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
        hg.addColorStop(0, headLight);
        hg.addColorStop(G.lightenStop, headCol);
        hg.addColorStop(1, headDark);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(headX, headY, hr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        }

        // Eyes (previews always show default eyes — no equipped cosmetics)
        if (!curFace) {
          const eyeOff = hr * G.eyeOff;
          const eyeR = hr * G.eyeR;
          const pupR = eyeR * G.pupR;
          const fwd = hr * G.eyeFwd;
          const perp = angle + Math.PI / 2;
          const maxShift = eyeR * G.pupShift;

          // Deadzone + relative tracking (same as game canvas)
          let deltaAngle = 0;
          const m2 = mouseRef.current;
          if (m2) {
            const dx = m2.x - headX, dy = m2.y - headY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
              const rawLook = Math.atan2(dy, dx);
              deltaAngle = rawLook - angle;
              while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
              while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
            }
          }
          const absDelta = Math.abs(deltaAngle);
          const DZ = 0.12, FZ = 0.45;
          const sr = absDelta < DZ ? 0 : absDelta < FZ ? (absDelta - DZ) / (FZ - DZ) : 1;
          const pupilShift = maxShift * sr;
          const lookDir = absDelta < 0.001 ? angle : angle + deltaAngle;

          for (const side of [-1, 1]) {
            const ex = headX + Math.cos(angle) * fwd + Math.cos(perp) * eyeOff * side;
            const ey = headY + Math.sin(angle) * fwd + Math.sin(perp) * eyeOff * side;

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = G.eyeBorder;
            ctx.lineWidth = G.eyeBorderW;
            ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

            const ppx = ex + Math.cos(lookDir) * pupilShift;
            const ppy = ey + Math.sin(lookDir) * pupilShift;
            ctx.fillStyle = '#111111';
            ctx.beginPath(); ctx.arc(ppx, ppy, pupR, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = `rgba(255,255,255,${G.highlight})`;
            ctx.beginPath(); ctx.arc(ppx - pupR * 0.3, ppy - pupR * 0.35, pupR * 0.3, 0, Math.PI * 2); ctx.fill();
          }
        }

        // Cosmetics — ONLY in the equip editor (showCosmetics); all other
        // previews show the pure skin with nothing applied.
        if (showCosmetics) {
          const cosParams = { hx: headX, hy: headY, hr, angle, time: performance.now(), boosting: false };
          for (let ci = 0; ci < cachedCosmetics.length; ci++) {
            if (cachedCosmetics[ci]) cachedCosmetics[ci]!.draw(ctx, cosParams);
          }
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      observer.disconnect();
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
    };
  }, [width, height, segments, speed, scale, resolvedHead, resolvedBody, resolvedFace, effectiveBodyStyle, effectiveTaper, effectiveGlow, isLabMode, effectiveColors, instanceSeed, economy, showCosmetics]);

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
        style={responsive
          ? { maxWidth: '100%', height: 'auto' }
          : { width: '100%', height: `${height}px` }
        }
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