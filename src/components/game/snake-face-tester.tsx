'use client';

/**
 * Snake Face Tester — LIVE sine-wave animated side-by-side comparison.
 * Both snakes share IDENTICAL motion (sine wave wiggle, exactly like skin-preview).
 * Only rendering parameters differ (eye size, shadow, gradient, border).
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

// ─── Sine-wave snake canvas ─────────────────────────────────────────────
// Both canvases receive the EXACT same positions array so motion is 1:1 identical.
// Only the draw calls differ per cfg.

function SineWaveSnakeCanvas({
  cfg,
  skinId,
  width = 480,
  height = 120,
  segments = 22,
  sharedTimeRef,
  label,
  labelColor,
}: {
  cfg: RendererConfig;
  skinId: string;
  width?: number;
  height?: number;
  segments?: number;
  sharedTimeRef: React.RefObject<number>;
  label: string;
  labelColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  // Track mouse on this canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - r.left) * (width / r.width),
        y: (e.clientY - r.top) * (height / r.height),
      };
    };
    const onLeave = () => { mouseRef.current = null; };
    c.addEventListener('mousemove', onMove);
    c.addEventListener('mouseleave', onLeave);
    return () => {
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
    };
  }, [width, height]);

  // Shared animation parameters — identical for both canvases
  const WIGGLE_AMP = 18;
  const WIGGLE_FREQ = 0.42;
  const WIGGLE_SPEED = 0.004;

  const draw = useCallback((
    ctx: CanvasRenderingContext2D,
    time: number,
  ) => {
    ctx.clearRect(0, 0, width, height);

    // Dark background with subtle radial glow
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
    bgGrad.addColorStop(0, '#111118');
    bgGrad.addColorStop(1, '#0a0a0f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < width; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
    }
    for (let gy = 0; gy < height; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
    }

    // ── Compute sine-wave positions (identical to skin-preview-game.tsx) ──
    const segStep = SEGMENT_SPACING;
    const totalLen = segments * segStep;
    const startX = (width - totalLen) / 2;
    const centerY = height / 2;

    const positions: { x: number; y: number; angle: number }[] = [];
    let cx = startX;

    for (let i = 0; i < segments; i++) {
      const wiggle = Math.sin(time * WIGGLE_SPEED - i * WIGGLE_FREQ) * WIGGLE_AMP;
      positions.push({
        x: cx,
        y: centerY + wiggle,
        angle: 0, // will compute below
      });
      cx += segStep;
    }

    // Compute per-segment angle from position differences
    for (let i = 0; i < positions.length; i++) {
      if (i === 0) {
        const dx = positions[1].x - positions[0].x;
        const dy = positions[1].y - positions[0].y;
        positions[0].angle = Math.atan2(dy, dx);
      } else {
        const dx = positions[i].x - positions[i - 1].x;
        const dy = positions[i].y - positions[i - 1].y;
        positions[i].angle = Math.atan2(dy, dx);
      }
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

    // ── Draw body (tail → head for layering) with optional shadow ──
    if (cfg.hasShadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = segR * cfg.shadowBlurRatio;
      ctx.shadowOffsetY = segR * cfg.shadowOffsetYRatio;
    }

    for (let i = positions.length - 1; i >= 1; i--) {
      const pos = positions[i];
      const grad = ctx.createRadialGradient(
        pos.x - segR * 0.3, pos.y - segR * 0.3, segR * 0.1,
        pos.x, pos.y, segR,
      );
      grad.addColorStop(0, lightenHex(bodyColor, cfg.lightenFactor));
      grad.addColorStop(cfg.lightenStop, bodyColor);
      grad.addColorStop(1, darkenHex(bodyColor, cfg.darkenFactor));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, segR, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cfg.hasShadow) ctx.restore();

    // ── Draw head ──
    const headPos = positions[0];
    const hx = headPos.x;
    const hy = headPos.y;
    const headAngle = headPos.angle;

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
    const perpA = headAngle + Math.PI / 2;

    // Pupils track mouse (or face forward)
    let lookAngle = headAngle;
    const m = mouseRef.current;
    if (m) {
      const dx = m.x - hx;
      const dy = m.y - hy;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        lookAngle = Math.atan2(dy, dx);
      }
    }

    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(headAngle) * forwardOff + Math.cos(perpA) * eyeOffset * side;
      const ey = hy + Math.sin(headAngle) * forwardOff + Math.sin(perpA) * eyeOffset * side;

      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = cfg.eyeBorderColor;
      ctx.lineWidth = cfg.eyeBorderWidth;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupil
      const shift = eyeR * cfg.pupilShiftRatio;
      const px = ex + Math.cos(lookAngle) * shift;
      const py = ey + Math.sin(lookAngle) * shift;
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(px, py, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Highlight dot
      ctx.fillStyle = `rgba(255,255,255,${cfg.highlightOpacity})`;
      ctx.beginPath();
      ctx.arc(px - pupilR * 0.3, py - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Label ──
    ctx.fillStyle = labelColor;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 12, 10);

    // ── Sub-info ──
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`segR=${cfg.segRadius.toFixed(1)}  eyeR=${(cfg.segRadius * cfg.headScale * cfg.eyeRadiusRatio).toFixed(1)}  shadow=${cfg.hasShadow ? '✓' : '✗'}`, 12, 28);
  }, [cfg, skinId, width, height, segments, label, labelColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const loop = (time: number) => {
      if (!running) return;
      sharedTimeRef.current = time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, time);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [draw, width, height, sharedTimeRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="rounded-lg cursor-crosshair border border-white/10 w-full max-w-full"
    />
  );
}

// ─── Main panel ─────────────────────────────────────────────────────────

export function SnakeFaceTester() {
  const [selectedSkin, setSelectedSkin] = useState('skin-emerald');
  const sharedTimeRef = useRef(0);

  return (
    <div className="flex flex-col gap-5 p-4 max-w-5xl mx-auto">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Sine-Wave Snake Face Comparison</h2>
        <p className="text-sm text-white/50 mt-1">
          Identical motion — only rendering params differ (eye size, shadow, gradient)
        </p>
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

      {/* Row 1: GAME vs PREVIEW — full size (shows body size difference) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          Full Size — GAME (zoomed, big eyes, shadow) vs PREVIEW (small, flat, no shadow)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SineWaveSnakeCanvas
            cfg={GAME_CFG}
            skinId={selectedSkin}
            width={480}
            height={130}
            segments={22}
            sharedTimeRef={sharedTimeRef}
            label="GAME PARAMS"
            labelColor="#4ade80"
          />
          <SineWaveSnakeCanvas
            cfg={PREVIEW_CFG}
            skinId={selectedSkin}
            width={480}
            height={130}
            segments={22}
            sharedTimeRef={sharedTimeRef}
            label="PREVIEW PARAMS"
            labelColor="#f87171"
          />
        </div>
      </div>

      {/* Row 2: Same body size, only face rendering differs */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80">
          Same Body Size — Only FACE rendering differs (eye size, border, shadow, gradient)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SineWaveSnakeCanvas
            cfg={FIXED_CFG}
            skinId={selectedSkin}
            width={480}
            height={130}
            segments={22}
            sharedTimeRef={sharedTimeRef}
            label="GAME FACE (fixed size)"
            labelColor="#22d3ee"
          />
          <SineWaveSnakeCanvas
            cfg={PREVIEW_CFG}
            skinId={selectedSkin}
            width={480}
            height={130}
            segments={22}
            sharedTimeRef={sharedTimeRef}
            label="PREVIEW FACE (original)"
            labelColor="#f472b6"
          />
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
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeRadius</td><td className="pr-4">hr × <b>0.38</b></td><td className="pr-4">hr × <b>0.25</b></td><td className="text-red-300">Eyes 52% smaller</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeBorder</td><td className="pr-4"><b>1.5px</b> rgba(0,0,0,0.5)</td><td className="pr-4"><b>1px</b> rgba(0,0,0,0.3)</td><td className="text-amber-300">Fainter border</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">3D gradient</td><td className="pr-4">lighten <b>0.35</b> @ 0.55</td><td className="pr-4">lighten <b>0.30</b> @ 0.60</td><td className="text-amber-300">Flatter look</td></tr>
              <tr><td className="py-1 pr-4 font-mono">shadow</td><td className="pr-4 text-emerald-400">✓ blur + offsetY</td><td className="pr-4 text-red-400">✗ none</td><td className="text-red-300">No depth cue</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-white/30">
        Hover over each canvas — eyes follow your cursor. Both snakes share identical sine-wave motion.
      </p>
    </div>
  );
}
