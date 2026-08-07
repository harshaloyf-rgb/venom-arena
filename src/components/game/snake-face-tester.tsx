'use client';

/**
 * Snake Game Skin Tester — single canvas showing a moving snake
 * rendered with exact game parameters (zoom, eyes, shadow, gradient).
 * Now includes a Test Score slider to preview snake fatness at any score.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SNAKE_RADIUS_MIN, SNAKE_RADIUS_GROWTH_RATE, SEGMENT_SPACING, computeBodyRadius } from '@/lib/snake/config';

/** Skin-preview length formula — decoupled from gameplay balance changes.
 *  Uses the original sqrt curve so skins always preview at consistent sizes. */
const PREVIEW_LENGTH_COEFF = 5;
const PREVIEW_START_LENGTH = 20;
function previewBodyLength(score: number): number {
  return Math.min(
    Math.floor(PREVIEW_START_LENGTH + PREVIEW_LENGTH_COEFF * Math.sqrt(score)),
    10000,
  );
}
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

// Body radius formula imported from config — single source of truth.

// ─── Game rendering params (exact match to render-snake-atlas.tsx) ─────

const GAME = {
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

// ─── Skins ──────────────────────────────────────────────────────────────

const TEST_SKINS = [
  { id: 'skin-emerald', label: 'Emerald' },
  { id: 'skin-crimson', label: 'Crimson' },
  { id: 'skin-arctic', label: 'Arctic' },
  { id: 'skin-gold', label: 'Gold' },
  { id: 'skin-neon-pink', label: 'Neon Pink' },
  { id: 'skin-shadow', label: 'Shadow' },
];

// ─── Score presets ──────────────────────────────────────────────────────

const SCORE_PRESETS = [
  { label: '0', score: 0 },
  { label: '50', score: 50 },
  { label: '200', score: 200 },
  { label: '500', score: 500 },
  { label: '2K', score: 2000 },
  { label: '10K', score: 10000 },
  { label: '100K', score: 100000 },
];

// ─── Main component ────────────────────────────────────────────────────

export function SnakeFaceTester() {
  const [selectedSkin, setSelectedSkin] = useState('skin-emerald');
  const [testScore, setTestScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const scoreRef = useRef(0);

  const W = 580;
  const H = 300;
  const SPEED = 1.8;

  // Compute values for display
  const bodyRadius = computeBodyRadius(testScore);
  const logicalLen = previewBodyLength(testScore);
  const segments = Math.min(Math.ceil((logicalLen * SEGMENT_SPACING) / GAME.segStep), 120); // cap for preview

  // Keep ref in sync with state
  useEffect(() => { scoreRef.current = testScore; }, [testScore]);

  const handleScoreSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setTestScore(v);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

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

    // Snake state
    let headX = W * 0.5;
    let headY = H * 0.5;
    let angle = 0;
    let targetAngle = 0;
    let turnTimer = 0;
    let nextTurn = 2000;

    // Position buffer
    const bufLen = 120 * 6; // max segments * oversample
    const px = new Float64Array(bufLen);
    const py = new Float64Array(bufLen);
    let bufCount = 0;

    let running = true;
    const loop = () => {
      if (!running) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const curRadius = computeBodyRadius(scoreRef.current);
      const curSegs = Math.min(
        Math.ceil((previewBodyLength(scoreRef.current) * SEGMENT_SPACING) / GAME.segStep),
        120,
      );

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
      const wallM = 70;
      if (headX < wallM) { targetAngle = 0; headX = wallM; }
      if (headX > W - wallM) { targetAngle = Math.PI; headX = W - wallM; }
      if (headY < wallM) { targetAngle = Math.PI / 2; headY = wallM; }
      if (headY > H - wallM) { targetAngle = -Math.PI / 2; headY = H - wallM; }

      // Prepend to buffer
      for (let i = Math.min(bufCount, bufLen - 1); i > 0; i--) {
        px[i] = px[i - 1];
        py[i] = py[i - 1];
      }
      px[0] = headX;
      py[0] = headY;
      bufCount = Math.min(bufCount + 1, bufLen);

      // ── Build segment positions from buffer ──
      const segs: { x: number; y: number; a: number }[] = [];
      let cx = headX, cy = headY;
      let srcIdx = 0;
      segs.push({ x: cx, y: cy, a: angle });

      for (let s = 1; s < curSegs && srcIdx < bufCount - 1; s++) {
        let remaining = GAME.segStep;
        while (remaining > 0 && srcIdx < bufCount - 1) {
          const dx = px[srcIdx + 1] - px[srcIdx];
          const dy = py[srcIdx + 1] - py[srcIdx];
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) { srcIdx++; continue; }
          if (len >= remaining) {
            cx = px[srcIdx] + (dx / len) * remaining;
            cy = py[srcIdx] + (dy / len) * remaining;
            px[srcIdx] = cx;
            py[srcIdx] = cy;
            remaining = 0;
          } else {
            cx = px[srcIdx + 1];
            cy = py[srcIdx + 1];
            remaining -= len;
            srcIdx++;
          }
        }
        if (srcIdx >= bufCount - 1) break;
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

      // Get skin
      let headColor = '#22c55e';
      let bodyColor = '#16a34a';
      try {
        const asset = getSkinAsset(selectedSkin);
        headColor = asset.headColor;
        bodyColor = asset.bodyColor;
      } catch { /* defaults */ }

      // Use dynamic radius instead of fixed SNAKE_RADIUS
      const segR = curRadius;
      const hr = segR * GAME.headScale;

      // Body shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = segR * GAME.shadowBlurRatio;
      ctx.shadowOffsetY = segR * GAME.shadowOffsetYRatio;

      for (let i = segs.length - 1; i >= 1; i--) {
        const p = segs[i];
        const grad = ctx.createRadialGradient(
          p.x - segR * 0.3, p.y - segR * 0.3, segR * 0.1,
          p.x, p.y, segR,
        );
        grad.addColorStop(0, lightenHex(bodyColor, GAME.lightenFactor));
        grad.addColorStop(GAME.lightenStop, bodyColor);
        grad.addColorStop(1, darkenHex(bodyColor, GAME.darkenFactor));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, segR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Head shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = hr * GAME.shadowBlurRatio;
      ctx.shadowOffsetY = hr * GAME.shadowOffsetYRatio;

      const hg = ctx.createRadialGradient(
        headX - hr * 0.3, headY - hr * 0.3, hr * 0.05,
        headX, headY, hr,
      );
      hg.addColorStop(0, lightenHex(headColor, GAME.lightenFactor));
      hg.addColorStop(GAME.lightenStop, headColor);
      hg.addColorStop(1, darkenHex(headColor, GAME.darkenFactor));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(headX, headY, hr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Eyes
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

      // Direction pointer
      const ptrS = hr * 1.1;
      const ptrL = hr * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX + Math.cos(angle) * ptrS, headY + Math.sin(angle) * ptrS);
      ctx.lineTo(headX + Math.cos(angle) * (ptrS + ptrL), headY + Math.sin(angle) * (ptrS + ptrL));
      ctx.stroke();

      // ── Info overlay: radius & segment count ──
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`radius: ${curRadius.toFixed(1)}px  |  segs: ${segs.length}/${curSegs}  |  score: ${scoreRef.current}`, 10, H - 22);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      c.removeEventListener('mousemove', onMove);
      c.removeEventListener('mouseleave', onLeave);
    };
  }, [selectedSkin]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white">Game Snake Tester</h2>
        <p className="text-sm text-white/50 mt-1">Exact game rendering — hover to track eyes. Test fatness at any score.</p>
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
            }`
          }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Score test controls */}
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60 font-mono">Test Score (radius preview)</span>
          <span className="text-xs font-mono">
            <span className="text-amber-400">Score: {testScore.toLocaleString()}</span>
            <span className="text-white/30 mx-2">|</span>
            <span className="text-emerald-400">Radius: {bodyRadius.toFixed(1)}px</span>
            <span className="text-white/30 mx-2">|</span>
            <span className="text-white/50">Length: {logicalLen} segs</span>
          </span>
        </div>

        {/* Score presets */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SCORE_PRESETS.map(p => (
            <button
              key={p.score}
              onClick={() => setTestScore(p.score)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                testScore === p.score
                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
              }`
            }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Score slider */}
        <input
          type="range"
          min={0}
          max={100000}
          step={50}
          value={testScore}
          onChange={handleScoreSlider}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-white/30 font-mono mt-0.5">
          <span>0</span>
          <span>25K</span>
          <span>50K</span>
          <span>75K</span>
          <span>100K</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: `${W}px`, height: `${H}px` }}
        className="rounded-lg cursor-crosshair border border-white/10 w-full max-w-full mx-auto"
      />
    </div>
  );
}
