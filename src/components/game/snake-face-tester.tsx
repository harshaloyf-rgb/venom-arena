'use client';

/**
 * Snake Face Tester — side-by-side comparison of GAME vs PREVIEW eye rendering.
 * Uses EXACT parameters from both renderers so you can see the difference.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { SNAKE_RADIUS, CAMERA_BASE_ZOOM } from '@/lib/snake/config';
import { getSkinAsset } from '@/lib/snake/skin-registry';

// ─── Color helpers (same as both renderers) ─────────────────────────────

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

// ─── Draw a snake head + eyes with given parameters ─────────────────────

interface DrawParams {
  headRadius: number;
  headColor: string;
  bodyColor: string;
  eyeRadiusRatio: number;   // eyeR / headRadius
  eyeOffsetRatio: number;   // eye spread / headRadius
  eyeForwardRatio: number;  // forward placement / headRadius
  pupilRadiusRatio: number; // pupilR / eyeR
  pupilShiftRatio: number;  // pupil offset / eyeR
  eyeBorderWidth: number;
  eyeBorderColor: string;
  highlightOpacity: number;
  lightenFactor: number;
  lightenStop: number;
  darkenFactor: number;
  headAngle: number;
  lookAngle: number;
  hasShadow: boolean;
  shadowBlur: number;
  shadowOffsetY: number;
}

function drawSnakeHead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  p: DrawParams,
) {
  const hr = p.headRadius;
  const headGrad = ctx.createRadialGradient(
    cx - hr * 0.3, cy - hr * 0.3, hr * 0.05,
    cx, cy, hr,
  );
  headGrad.addColorStop(0, lightenHex(p.headColor, p.lightenFactor));
  headGrad.addColorStop(p.lightenStop, p.headColor);
  headGrad.addColorStop(1, darkenHex(p.headColor, p.darkenFactor));

  // Shadow
  if (p.hasShadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = p.shadowBlur;
    ctx.shadowOffsetY = p.shadowOffsetY;
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes
  const eyeOffset = hr * p.eyeOffsetRatio;
  const eyeRadius = hr * p.eyeRadiusRatio;
  const pupilRadius = eyeRadius * p.pupilRadiusRatio;
  const forwardOffset = hr * p.eyeForwardRatio;
  const perpAngle = p.headAngle + Math.PI / 2;

  for (const side of [-1, 1]) {
    const ex = cx + Math.cos(p.headAngle) * forwardOffset + Math.cos(perpAngle) * eyeOffset * side;
    const ey = cy + Math.sin(p.headAngle) * forwardOffset + Math.sin(perpAngle) * eyeOffset * side;

    // Eye white
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = p.eyeBorderColor;
    ctx.lineWidth = p.eyeBorderWidth;
    ctx.beginPath();
    ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil
    const pupilShift = eyeRadius * p.pupilShiftRatio;
    const px = ex + Math.cos(p.lookAngle) * pupilShift;
    const py = ey + Math.sin(p.lookAngle) * pupilShift;
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = `rgba(255,255,255,${p.highlightOpacity})`;
    ctx.beginPath();
    ctx.arc(px - pupilRadius * 0.3, py - pupilRadius * 0.35, pupilRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Draw a short body behind the head ──────────────────────────────────

function drawBodySegments(
  ctx: CanvasRenderingContext2D,
  headX: number, headY: number, angle: number,
  segRadius: number, count: number, color: string,
  lightenFactor: number, lightenStop: number, darkenFactor: number,
  hasShadow: boolean, shadowBlur: number, shadowOffsetY: number,
) {
  const step = segRadius * 1.2;

  if (hasShadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = shadowOffsetY;
  }

  for (let i = 0; i < count; i++) {
    // Trail behind the head
    const bx = headX - Math.cos(angle) * step * (i + 1.3);
    const by = headY - Math.sin(angle) * step * (i + 1.3) + Math.sin(i * 0.8) * 3;

    const grad = ctx.createRadialGradient(
      bx - segRadius * 0.3, by - segRadius * 0.3, segRadius * 0.1,
      bx, by, segRadius,
    );
    grad.addColorStop(0, lightenHex(color, lightenFactor));
    grad.addColorStop(lightenStop, color);
    grad.addColorStop(1, darkenHex(color, darkenFactor));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bx, by, segRadius * (1 - i * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }

  if (hasShadow) {
    ctx.restore();
  }
}

// ─── Parameter presets ──────────────────────────────────────────────────

const GAME_PARAMS: DrawParams = {
  headRadius: SNAKE_RADIUS * CAMERA_BASE_ZOOM, // 12 * 1.35 = 16.2
  eyeRadiusRatio: 0.38,
  eyeOffsetRatio: 0.42,
  eyeForwardRatio: 0.32,
  pupilRadiusRatio: 0.52,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1.5,
  eyeBorderColor: 'rgba(0,0,0,0.5)',
  highlightOpacity: 0.8,
  lightenFactor: 0.35,
  lightenStop: 0.55,
  darkenFactor: 0.35,
  headAngle: 0,
  lookAngle: 0,
  hasShadow: true,
  shadowBlur: 16.2 * 0.8,
  shadowOffsetY: 16.2 * 0.3,
  headColor: '#22c55e',
  bodyColor: '#16a34a',
};

const PREVIEW_PARAMS: DrawParams = {
  headRadius: 8 * 1.3, // 10.4 (preview uses segRadius=8, headScale=1.3)
  eyeRadiusRatio: 0.25,
  eyeOffsetRatio: 0.4,
  eyeForwardRatio: 0.3,
  pupilRadiusRatio: 0.55,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1,
  eyeBorderColor: 'rgba(0,0,0,0.3)',
  highlightOpacity: 0.7,
  lightenFactor: 0.3,
  lightenStop: 0.6,
  darkenFactor: 0.3,
  headAngle: 0,
  lookAngle: 0,
  hasShadow: false,
  shadowBlur: 0,
  shadowOffsetY: 0,
  headColor: '#22c55e',
  bodyColor: '#16a34a',
};

const FIXED_PARAMS: DrawParams = {
  headRadius: 8 * 1.3, // Same SIZE as preview, but GAME eye proportions
  eyeRadiusRatio: 0.38,
  eyeOffsetRatio: 0.42,
  eyeForwardRatio: 0.32,
  pupilRadiusRatio: 0.52,
  pupilShiftRatio: 0.7,
  eyeBorderWidth: 1.5,
  eyeBorderColor: 'rgba(0,0,0,0.5)',
  highlightOpacity: 0.8,
  lightenFactor: 0.35,
  lightenStop: 0.55,
  darkenFactor: 0.35,
  headAngle: 0,
  lookAngle: 0,
  hasShadow: true,
  shadowBlur: 10.4 * 0.8,
  shadowOffsetY: 10.4 * 0.3,
  headColor: '#22c55e',
  bodyColor: '#16a34a',
};

// ─── Skins to test ───────────────────────────────────────────────────────

const TEST_SKINS = [
  { id: 'skin-emerald', label: 'Emerald' },
  { id: 'skin-crimson', label: 'Crimson' },
  { id: 'skin-arctic', label: 'Arctic' },
  { id: 'skin-gold', label: 'Gold' },
  { id: 'skin-neon-pink', label: 'Neon Pink' },
  { id: 'skin-shadow', label: 'Shadow' },
];

// ─── Canvas row component ───────────────────────────────────────────────

function FaceCanvas({
  label,
  params,
  width = 200,
  height = 120,
  showBody = true,
  skinId,
  mouseRef,
}: {
  label: string;
  params: DrawParams;
  width?: number;
  height?: number;
  showBody?: boolean;
  skinId: string;
  mouseRef: React.RefObject<{ x: number; y: number } | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 8);
    ctx.fill();

    // Get skin colors
    let headColor = params.headColor;
    let bodyColor = params.bodyColor;
    try {
      const asset = getSkinAsset(skinId);
      headColor = asset.headColor;
      bodyColor = asset.bodyColor;
    } catch { /* use defaults */ }

    const p: DrawParams = { ...params, headColor, bodyColor };

    // Head position — centered-right to leave room for body on left
    const headX = width * 0.55;
    const headY = height * 0.5;

    // Mouse tracking for eyes
    const mRef = mouseRef.current;
    if (mRef) {
      const dx = mRef.x - headX;
      const dy = mRef.y - headY;
      if (Math.sqrt(dx * dx + dy * dy) > 2) {
        p.lookAngle = Math.atan2(dy, dx);
      }
    }

    // Body
    if (showBody) {
      drawBodySegments(
        ctx, headX, headY, p.headAngle,
        p.headRadius / 1.3, 8, bodyColor,
        p.lightenFactor, p.lightenStop, p.darkenFactor,
        p.hasShadow, p.shadowBlur, p.shadowOffsetY,
      );
    }

    // Head + Eyes
    drawSnakeHead(ctx, headX, headY, p);
  }, [params, width, height, skinId, showBody, mouseRef]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-white/60">{label}</span>
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg cursor-crosshair"
      />
    </div>
  );
}

// ─── Main tester panel ──────────────────────────────────────────────────

export function SnakeFaceTester() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedSkin, setSelectedSkin] = useState('skin-emerald');

  // Track mouse across the whole container for eye following
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleLeave = () => { mouseRef.current = null; };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Snake Face Comparison</h2>
        <p className="text-sm text-white/50 mt-1">Game canvas vs Preview — exact parameter match</p>
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

      {/* Row 1: Game vs Preview (different sizes) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          As-is comparison (different sizes + params)
        </h3>
        <div className="flex flex-wrap justify-center gap-6">
          <FaceCanvas
            label="GAME Canvas"
            params={GAME_PARAMS}
            width={240}
            height={150}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
          <FaceCanvas
            label="PREVIEW Canvas"
            params={PREVIEW_PARAMS}
            width={240}
            height={150}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
        </div>
      </div>

      {/* Row 2: Same size, different eye params */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          Same head size — only eye params differ
        </h3>
        <div className="flex flex-wrap justify-center gap-6">
          <FaceCanvas
            label="GAME eyes (0.38)"
            params={FIXED_PARAMS}
            width={200}
            height={120}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
          <FaceCanvas
            label="PREVIEW eyes (0.25)"
            params={PREVIEW_PARAMS}
            width={200}
            height={120}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
        </div>
      </div>

      {/* Row 3: Close-up heads only, no body */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">
          Close-up heads only (no body distraction)
        </h3>
        <div className="flex flex-wrap justify-center gap-6">
          <FaceCanvas
            label="GAME face"
            params={{ ...GAME_PARAMS, headRadius: 40 }}
            width={160}
            height={120}
            showBody={false}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
          <FaceCanvas
            label="PREVIEW face"
            params={{ ...PREVIEW_PARAMS, headRadius: 40 }}
            width={160}
            height={120}
            showBody={false}
            skinId={selectedSkin}
            mouseRef={mouseRef}
          />
        </div>
      </div>

      {/* Parameter diff table */}
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
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">headRadius</td><td className="pr-4">12 × 1.35 = <b>16.2</b></td><td className="pr-4">8 × 1.3 = <b>10.4</b></td><td className="text-white/40">56% bigger</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeRadius</td><td className="pr-4">hr × <b>0.38</b></td><td className="pr-4">hr × <b>0.25</b></td><td className="text-red-300">Eyes 52% smaller</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeOffset</td><td className="pr-4">hr × <b>0.42</b></td><td className="pr-4">hr × <b>0.40</b></td><td className="text-white/40">~same</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeForward</td><td className="pr-4">hr × <b>0.32</b></td><td className="pr-4">hr × <b>0.30</b></td><td className="text-white/40">~same</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">pupilRadius</td><td className="pr-4">eyeR × <b>0.52</b></td><td className="pr-4">eyeR × <b>0.55</b></td><td className="text-white/40">~same ratio</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeBorder</td><td className="pr-4"><b>1.5</b>px</td><td className="pr-4"><b>1</b>px</td><td className="text-amber-300">50% thinner</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">eyeBorderColor</td><td className="pr-4 font-mono">rgba(0,0,0,<b>0.5</b>)</td><td className="pr-4 font-mono">rgba(0,0,0,<b>0.3</b>)</td><td className="text-amber-300">Fainter border</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">highlightOpacity</td><td className="pr-4"><b>0.8</b></td><td className="pr-4"><b>0.7</b></td><td className="text-white/40">Slightly dimmer</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">lightenFactor</td><td className="pr-4"><b>0.35</b></td><td className="pr-4"><b>0.30</b></td><td className="text-white/40">Flatter 3D</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">lightenStop</td><td className="pr-4"><b>0.55</b></td><td className="pr-4"><b>0.60</b></td><td className="text-white/40">Flatter 3D</td></tr>
              <tr className="border-b border-white/5"><td className="py-1 pr-4 font-mono">darkenFactor</td><td className="pr-4"><b>0.35</b></td><td className="pr-4"><b>0.30</b></td><td className="text-white/40">Flatter 3D</td></tr>
              <tr><td className="py-1 pr-4 font-mono">hasShadow</td><td className="pr-4 text-emerald-400">✓ blur={SNAKE_RADIUS * CAMERA_BASE_ZOOM * 0.8}</td><td className="pr-4 text-red-400">✗ none</td><td className="text-red-300">No depth cue</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-center text-xs text-white/30">
        Move your mouse over the canvases — the eyes follow your cursor.
        The GAME face has bigger eyes, thicker borders, stronger 3D gradient, and drop shadow.
      </p>
    </div>
  );
}
