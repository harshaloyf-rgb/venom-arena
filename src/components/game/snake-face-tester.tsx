'use client';

/**
 * Snake Face Tester — LIVE animated side-by-side comparison.
 * Two fully slithering snakes with exact GAME vs PREVIEW parameters.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM, SEGMENT_SPACING } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';

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

// ─── Renderer config — mirrors exact game/preview code ─────────────────

interface RendererConfig {
  label: string;
  segRadius: number;
  headScale: number;
  segStep: number;
  lightenFactor: number;
  lightenStop: number;
  darkenFactor: number;
  eyeRadiusRatio: number;
  eyeOffsetRatio: number;
  eyeForwardRatio: number;
  pupilRadiusRatio: number;
  pupilShiftRatio: number;
  eyeBorderWidth: number;
  eyeBorderColor: string;
  highlightOpacity: number;
  hasShadow: boolean;
  shadowBlurRatio: number;
  shadowOffsetYRatio: number;
}

const GAME_CFG: RendererConfig = {
  label: 'GAME',
  segRadius: SNAKE_RADIUS * CAMERA_BASE_ZOOM,  // 12 * 1.35 = 16.2
  headScale: 1.3,
  segStep: 14,                   // BODY_DRAW_STEP from game renderer
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
  hasShadow: true,
  shadowBlurRatio: 0.8,
  shadowOffsetYRatio: 0.3,
};

const PREVIEW_CFG: RendererConfig = {
  label: 'PREVIEW',
  segRadius: 8,
  headScale: 1.3,
  segStep: SEGMENT_SPACING,                  // 8
  lightenFactor: 0.3,
  lightenStop: 0.6,
  darkenFactor: 0.3,
  eyeRadiusRatio: 0.25,
  eyeOffsetRatio: 0.4,
  eyeForwardRatio: 0.3,
  pupilRadiusRatio: 0.55,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1,
  eyeBorderColor: 'rgba(0,0,0,0.3)',
  highlightOpacity: 0.7,
  hasShadow: false,
  shadowBlurRatio: 0,
  shadowOffsetYRatio: 0,
};

const FIXED_CFG: RendererConfig = {
  ...PREVIEW_CFG,
  label: 'FIXED',
  eyeRadiusRatio: 0.38,
  eyeOffsetRatio: 0.42,
  eyeForwardRatio: 0.32,
  pupilRadiusRatio: 0.52,
  eyeBorderWidth: 1.5,
  eyeBorderColor: 'rgba(0,0,0,0.5)',
  highlightOpacity: 0.8,
  lightenFactor: 0.35,
  lightenStop: 0.55,
  darkenFactor: 0.35,
  hasShadow: true,
  shadowBlurRatio: 0.8,
  shadowOffsetYRatio: 0.3,
};

// ─── Skins ──────────────────────────────────────────────────────────────

const TEST_SKINS = [
  { id: 'skin-emerald', label: 'Emerald' },
  { id: 'skin-crimson', label: 'Crimson' },
  { id: 'skin-arctic', label: 'Arctic' },
  { id: 'skin-gold', label: 'Gold' },
  { id: 'skin-neon-pink', label: 'Neon Pink' },
  { id: 'skin-shadow', label: 'Shadow' },
];

// ─── Live snake canvas ──────────────────────────────────────────────────

function LiveSnakeCanvas({
  cfg,
  skinId,
  width = 400,
  height = 200,
  segments = 22,
  speed = 1.5,
  mouseRef,
  label,
}: {
  cfg: RendererConfig;
  skinId: string;
  width?: number;
  height?: number;
  segments?: number;
  speed?: number;
  mouseRef: React.RefObject<{ x: number; y: number } | null>;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const localMouseRef = useRef<{ x: number; y: number } | null>(null);

  // Track mouse on this specific canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      localMouseRef.current = { x: (e.clientX - r.left) * (width / r.width), y: (e.clientY - r.top) * (height / r.height) };
    };
    const onLeave = () => { localMouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);
    return () => { c.removeEventListener('mousemove', onMove); c.removeEventListener('mouseleave', onLeave); };
  }, [width, height]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let headX = width * 0.65;
    let headY = height / 2;
    let angle = 0;
    let targetAngle = 0;
    let turnTimer = 0;
    let nextTurn = 2000;

    // Path buffer
    const pathX = new Float64Array(segments * 4);
    const pathY = new Float64Array(segments * 4);
    let pathLen = 0;

    let running = true;
    const loop = (time: number) => {
      if (!running) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Update head position ──
      turnTimer += 16;
      if (turnTimer > nextTurn) {
        targetAngle = angle + (Math.random() - 0.5) * 1.8;
        turnTimer = 0;
        nextTurn = 1500 + Math.random() * 2000;
      }

      // Smooth turn
      let diff = targetAngle - angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      angle += diff * 0.04;

      // Move forward
      headX += Math.cos(angle) * speed;
      headY += Math.sin(angle) * speed;

      // Bounce off walls
      const margin = 60;
      if (headX < margin) { targetAngle = 0; headX = margin; }
      if (headX > width - margin) { targetAngle = Math.PI; headX = width - margin; }
      if (headY < margin) { targetAngle = Math.PI / 2; headY = margin; }
      if (headY > height - margin) { targetAngle = -Math.PI / 2; headY = height - margin; }

      // Add to path (unshift for efficient drawing)
      // Shift everything right and insert at 0
      for (let i = Math.min(pathLen, pathX.length - 1); i > 0; i--) {
        pathX[i] = pathX[i - 1];
        pathY[i] = pathY[i - 1];
      }
      pathX[0] = headX;
      pathY[0] = headY;
      pathLen = Math.min(pathLen + 1, pathX.length);

      // ── Draw ──
      ctx.clearRect(0, 0, width, height);

      // Background — game arena dark
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
      }

      // Get skin colors
      let headColor = '#22c55e';
      let bodyColor = '#16a34a';
      try {
        const asset = getSkinAsset(skinId);
        headColor = asset.headColor;
        bodyColor = asset.bodyColor;
      } catch { /* defaults */ }

      const segR = cfg.segRadius;
      const hr = segR * cfg.headScale;
      const step = cfg.segStep;
      const maxDrawSegs = Math.min(segments, pathLen);

      // Calculate which path indices to draw (fixed spacing)
      const drawPositions: { x: number; y: number; ang: number }[] = [];
      let walkDist = 0;
      let pIdx = 0;

      for (let s = 0; s < maxDrawSegs && pIdx < pathLen - 1; s++) {
        // Walk along path at fixed step
        while (pIdx < pathLen - 1) {
          const dx = pathX[pIdx + 1] - pathX[pIdx];
          const dy = pathY[pIdx + 1] - pathY[pIdx];
          const segLen = Math.sqrt(dx * dx + dy * dy);
          if (segLen < 0.01) { pIdx++; continue; }

          if (walkDist + segLen >= step) {
            const frac = (step - walkDist) / segLen;
            const wx = pathX[pIdx] + dx * frac;
            const wy = pathY[pIdx] + dy * frac;
            const wa = Math.atan2(dy, dx);
            drawPositions.push({ x: wx, y: wy, ang: wa });
            walkDist = 0;
            // Partially consume this segment
            pathX[pIdx] = wx;
            pathY[pIdx] = wy;
            break;
          } else {
            walkDist += segLen;
            pIdx++;
          }
        }
        if (walkDist === 0 && pIdx >= pathLen - 1) break;
      }

      // Reset path for next frame (restore consumed path)
      // Rebuild path from head
      // Actually, we modified pathX/Y in-place. Let's just use headX/headY directly.
      // Simpler: regenerate path positions from scratch using interpolation
      drawPositions.length = 0;

      // Simple approach: use head as position 0, then walk backward through path
      const segCount = Math.min(maxDrawSegs, pathLen);
      let cx = headX, cy = headY;
      let accDist = 0;
      let srcIdx = 0;
      drawPositions.push({ x: cx, y: cy, ang: angle });

      for (let s = 1; s < segCount && srcIdx < pathLen - 1; s++) {
        let remaining = step;
        while (remaining > 0 && srcIdx < pathLen - 1) {
          const dx = pathX[srcIdx + 1] - pathX[srcIdx];
          const dy = pathY[srcIdx + 1] - pathY[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= remaining) {
            cx = pathX[srcIdx] + (dx / len) * remaining;
            cy = pathY[srcIdx] + (dy / len) * remaining;
            pathX[srcIdx] = cx;
            pathY[srcIdx] = cy;
            remaining = 0;
          } else {
            cx = pathX[srcIdx + 1];
            cy = pathY[srcIdx + 1];
            remaining -= len;
            srcIdx++;
          }
        }
        const prev = drawPositions[drawPositions.length - 1];
        const a = Math.atan2(cy - prev.y, cx - prev.x);
        drawPositions.push({ x: cx, y: cy, ang: a });
      }

      // ── Draw body (tail to head) with shadow ──
      if (cfg.hasShadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = segR * cfg.shadowBlurRatio;
        ctx.shadowOffsetY = segR * cfg.shadowOffsetYRatio;
      }

      for (let i = drawPositions.length - 1; i >= 1; i--) {
        const pos = drawPositions[i];
        const r = segR;
        const grad = ctx.createRadialGradient(
          pos.x - r * 0.3, pos.y - r * 0.3, r * 0.1,
          pos.x, pos.y, r,
        );
        grad.addColorStop(0, lightenHex(bodyColor, cfg.lightenFactor));
        grad.addColorStop(cfg.lightenStop, bodyColor);
        grad.addColorStop(1, darkenHex(bodyColor, cfg.darkenFactor));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (cfg.hasShadow) ctx.restore();

      // ── Draw head ──
      const hx = headX, hy = headY;

      if (cfg.hasShadow) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = hr * cfg.shadowBlurRatio;
        ctx.shadowOffsetY = hr * cfg.shadowOffsetYRatio;
      }

      const headGrad = ctx.createRadialGradient(
        hx - hr * 0.3, hy - hr * 0.3, hr * 0.05,
        hx, hy, hr,
      );
      headGrad.addColorStop(0, lightenHex(headColor, cfg.lightenFactor));
      headGrad.addColorStop(cfg.lightenStop, headColor);
      headGrad.addColorStop(1, darkenHex(headColor, cfg.darkenFactor));
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();

      if (cfg.hasShadow) ctx.restore();

      // ── Eyes ──
      const eyeOffset = hr * cfg.eyeOffsetRatio;
      const eyeR = hr * cfg.eyeRadiusRatio;
      const pupilR = eyeR * cfg.pupilRadiusRatio;
      const forwardOff = hr * cfg.eyeForwardRatio;
      const perpA = angle + Math.PI / 2;

      // Look angle: track mouse or face forward
      let lookAngle = angle;
      const m = localMouseRef.current;
      if (m) {
        const dx = m.x - hx;
        const dy = m.y - hy;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          lookAngle = Math.atan2(dy, dx);
        }
      }

      for (const side of [-1, 1]) {
        const ex = hx + Math.cos(angle) * forwardOff + Math.cos(perpA) * eyeOffset * side;
        const ey = hy + Math.sin(angle) * forwardOff + Math.sin(perpA) * eyeOffset * side;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = cfg.eyeBorderColor;
        ctx.lineWidth = cfg.eyeBorderWidth;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const shift = eyeR * cfg.pupilShiftRatio;
        const px = ex + Math.cos(lookAngle) * shift;
        const py = ey + Math.sin(lookAngle) * shift;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(px, py, pupilR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${cfg.highlightOpacity})`;
        ctx.beginPath();
        ctx.arc(px - pupilR * 0.3, py - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Direction pointer (like game) ──
      const ptrStart = hr * 1.1;
      const ptrLen = hr * 3;
      const ptrX = hx + Math.cos(angle) * (ptrStart + ptrLen);
      const ptrY = hy + Math.sin(angle) * (ptrStart + ptrLen);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(angle) * ptrStart, hy + Math.sin(angle) * ptrStart);
      ctx.lineTo(ptrX, ptrY);
      ctx.stroke();

      // ── Name label ──
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${Math.max(10, 12)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, hx, hy - hr - 8);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [cfg, skinId, width, height, segments, speed, label]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-white/60">{label}</span>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg cursor-crosshair border border-white/10"
      />
    </div>
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────

export function SnakeFaceTester() {
  const [selectedSkin, setSelectedSkin] = useState('skin-emerald');
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div className="flex flex-col gap-6 p-4 max-w-5xl mx-auto">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Live Snake Comparison</h2>
        <p className="text-sm text-white/50 mt-1">Both snakes move in real-time — exact game vs preview parameters</p>
      </div>

      {/* Skin selector */}
      <div className="flex flex-wrap justify-center gap-2">
        {TEST_SKINS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSkin(s.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedSkin === s.id
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Row 1: Full size comparison */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          Full size — GAME (zoomed, big eyes, shadow) vs PREVIEW (small, flat, no shadow)
        </h3>
        <div className="flex flex-wrap justify-center gap-4">
          <LiveSnakeCanvas cfg={GAME_CFG} skinId={selectedSkin} width={420} height={220} segments={24} speed={1.8} mouseRef={mouseRef} label="GAME" />
          <LiveSnakeCanvas cfg={PREVIEW_CFG} skinId={selectedSkin} width={420} height={220} segments={24} speed={1.8} mouseRef={mouseRef} label="PREVIEW" />
        </div>
      </div>

      {/* Row 2: Same base size, only face params differ */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80">
          Same body size — only FACE rendering differs (eye size, shadow, gradient)
        </h3>
        <div className="flex flex-wrap justify-center gap-4">
          <LiveSnakeCanvas cfg={FIXED_CFG} skinId={selectedSkin} width={360} height={200} segments={22} speed={1.8} mouseRef={mouseRef} label="GAME FACE" />
          <LiveSnakeCanvas cfg={PREVIEW_CFG} skinId={selectedSkin} width={360} height={200} segments={22} speed={1.8} mouseRef={mouseRef} label="PREVIEW FACE" />
        </div>
      </div>

      {/* Parameter table */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80 mb-3">
          Exact parameter differences
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-white/10 text-white/50">
                <th className="py-1.5 pr-4">Parameter</th>
                <th className="py-1.5 pr-4 text-emerald-400">Game</th>
                <th className="py-1.5 pr-4 text-red-400">Preview</th>
                <th className="py-1.5 text-white/40">Impact</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">segRadius</td><td className="pr-4">12 × 1.35 = <b>16.2</b></td><td className="pr-4">hardcoded <b>8</b></td><td className="text-red-300">Body 2× smaller</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">segStep</td><td className="pr-4"><b>BODY_DRAW_STEP = 14</b></td><td className="pr-4"><b>SEGMENT_SPACING = 8</b></td><td className="text-amber-300">Different spacing</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeRadius</td><td className="pr-4">hr × <b>0.38</b></td><td className="pr-4">hr × <b>0.25</b></td><td className="text-red-300">Eyes 52% smaller</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeBorder</td><td className="pr-4"><b>1.5px</b> rgba(0,0,0,0.5)</td><td className="pr-4"><b>1px</b> rgba(0,0,0,0.3)</td><td className="text-amber-300">Fainter border</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">3D gradient</td><td className="pr-4">lighten <b>0.35</b> @ 0.55</td><td className="pr-4">lighten <b>0.30</b> @ 0.60</td><td className="text-amber-300">Flatter look</td></tr>
              <tr><td className="py-1 pr-4 font-mono">shadow</td><td className="pr-4 text-emerald-400">✓ blur + offsetY</td><td className="pr-4 text-red-400">✗ none</td><td className="text-red-300">No depth cue</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-white/30">
        Move your mouse over each canvas — the eyes follow your cursor. Both snakes auto-navigate the arena.
      </p>
    </div>
  );
}
