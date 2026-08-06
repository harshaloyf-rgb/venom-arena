'use client';

/**
 * Venom Painter — "Build Your Venom" canvas.
 *
 * Shows a snake outline (segment circles) with eyes.
 * User picks a color, then clicks segments to paint them.
 * Delete removes color from selected segment. Reset clears all.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, RotateCcw, Save } from 'lucide-react';
import { PALETTE_COLORS } from './cosmetics-types';
import type { BodyStyle, TaperStyle } from './cosmetics-types';
import { generateCustomSegments, readCustomSkinStateSafe, writeCustomSkinState, lightenHex, darkenHex } from './cosmetics-utils';
import type { CustomSkinState } from './cosmetics-types';

interface VenomPainterProps {
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSaved?: () => void;
}

const NUM_SEGS = 20;
const BG_OPTIONS = [
  { id: 'dark', color: '#0a0a14' },
  { id: 'navy', color: '#0f172a' },
  { id: 'purple', color: '#1e0a2e' },
  { id: 'green', color: '#0a1e14' },
];

export function VenomPainter({ onToast, onSaved }: VenomPainterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [segmentColors, setSegmentColors] = useState<(string | null)[]>(
    () => Array(NUM_SEGS).fill(null),
  );
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE_COLORS[0].hex);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [bgId, setBgId] = useState('dark');
  const [shape, setShape] = useState<BodyStyle>('smooth');
  const [taper, setTaper] = useState<TaperStyle>('natural');
  const [glow, setGlow] = useState(true);
  const segPositions = useRef<Array<{ x: number; y: number }>>([]);

  // Compute S-curve segment positions
  useEffect(() => {
    const pts: Array<{ x: number; y: number }> = [];
    const W = 420;
    const H = 160;
    for (let i = 0; i < NUM_SEGS; i++) {
      const t = i / (NUM_SEGS - 1);
      pts.push({
        x: 35 + t * (W - 70),
        y: H / 2 + Math.sin(t * Math.PI * 2.2) * (H * 0.28),
      });
    }
    segPositions.current = pts;
  }, []);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const pts = segPositions.current;
    if (pts.length === 0) return;

    const bgColor = BG_OPTIONS.find((b) => b.id === bgId)?.color ?? '#0a0a14';

    // Hex grid background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw segments tail→head
    for (let i = pts.length - 1; i >= 1; i--) {
      const pt = pts[i];
      const prevPt = pts[i - 1] || pt;
      const segAngle = Math.atan2(prevPt.y - pt.y, prevPt.x - pt.x);
      const col = segmentColors[i];
      const isSelected = selectedSeg === i;

      // Compute taper radius
      let sizeScale = 1.0;
      if (taper === 'uniform') sizeScale = 1.0;
      else if (taper === 'natural') sizeScale = Math.max(0.65, 1.25 - (i / NUM_SEGS) * 0.55);
      else if (taper === 'wave') sizeScale = 1.0 + Math.sin(i * 0.95) * 0.22;
      else if (taper === 'heavy') sizeScale = Math.max(0.55, 1.35 - (i / NUM_SEGS) * 0.8);

      const r = Math.max(8 * sizeScale, 3);

      ctx.save();
      if (col && glow) {
        ctx.shadowBlur = r * 1.5;
        ctx.shadowColor = col;
      }

      if (col) {
        // Painted segment — 3D gradient
        const grad = ctx.createRadialGradient(pt.x - r * 0.3, pt.y - r * 0.3, r * 0.1, pt.x, pt.y, r);
        grad.addColorStop(0, lightenHex(col, 0.3));
        grad.addColorStop(0.6, col);
        grad.addColorStop(1, darkenHex(col, 0.3));
        ctx.fillStyle = grad;
      } else {
        // Empty segment — dark outline
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
      }

      // Draw circle (keeping it simple for the painter)
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.stroke();
      } else if (!col) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Head (index 0)
    const head = pts[0];
    const nextPt = pts[1] || head;
    const headAngle = Math.atan2(head.y - nextPt.y, head.x - nextPt.x);
    const headCol = segmentColors[0] || '#333333';
    const headR = 11;

    ctx.save();
    if (segmentColors[0] && glow) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = headCol;
    }
    const hGrad = ctx.createRadialGradient(head.x - headR * 0.3, head.y - headR * 0.3, headR * 0.1, head.x, head.y, headR);
    hGrad.addColorStop(0, lightenHex(headCol, 0.35));
    hGrad.addColorStop(0.6, headCol);
    hGrad.addColorStop(1, darkenHex(headCol, 0.3));
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
    ctx.fill();
    if (selectedSeg === 0) {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // Eyes (always visible)
    const eyeFwd = headR * 0.3;
    const eyeOff = headR * 0.45;
    const eyeR = headR * 0.28;
    const pupilR = eyeR * 0.55;
    const perpA = headAngle + Math.PI / 2;

    for (const side of [-1, 1]) {
      const ex = head.x + Math.cos(headAngle) * eyeFwd + Math.cos(perpA) * eyeOff * side;
      const ey = head.y + Math.sin(headAngle) * eyeFwd + Math.sin(perpA) * eyeOff * side;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(headAngle) * pupilR * 0.3, ey + Math.sin(headAngle) * pupilR * 0.3, pupilR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(ex - pupilR * 0.3, ey - pupilR * 0.35, pupilR * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [segmentColors, selectedSeg, bgId, shape, taper, glow]);

  // Handle canvas click — select/paint segment
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Find closest segment
      let closestIdx = -1;
      let closestDist = Infinity;
      for (let i = 0; i < segPositions.current.length; i++) {
        const pt = segPositions.current[i];
        const d = Math.hypot(mx - pt.x, my - pt.y);
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0 && closestDist < 22) {
        if (selectedSeg === closestIdx && segmentColors[closestIdx]) {
          // Clicking same painted segment → remove color
          setSegmentColors((prev) => {
            const next = [...prev];
            next[closestIdx] = null;
            return next;
          });
          setSelectedSeg(null);
        } else {
          // Paint with selected color
          setSelectedSeg(closestIdx);
          setSegmentColors((prev) => {
            const next = [...prev];
            next[closestIdx] = selectedColor;
            return next;
          });
        }
      }
    },
    [selectedSeg, segmentColors, selectedColor],
  );

  const handleReset = () => {
    setSegmentColors(Array(NUM_SEGS).fill(null));
    setSelectedSeg(null);
    onToast?.('Canvas cleared.', 'info');
  };

  const handleSave = () => {
    const paintedColors = segmentColors.filter((c): c is string => c !== null);
    if (paintedColors.length === 0) {
      onToast?.('Paint at least 1 segment!', 'error');
      return;
    }
    // Build color sequence from painted segments (in order, skipping nulls)
    const colorSeq = segmentColors.filter((c): c is string => c !== null);
    const segments = generateCustomSegments(colorSeq, shape, taper, glow);
    const next: CustomSkinState = {
      useCustomSkin: true,
      currentSkin: 'custom-lab-skin',
      customSkinSegments: segments,
    };
    writeCustomSkinState(next);
    onToast?.('Venom saved and equipped!', 'success');
    onSaved?.();
  };

  const handleDelete = () => {
    if (selectedSeg !== null) {
      setSegmentColors((prev) => {
        const next = [...prev];
        next[selectedSeg] = null;
        return next;
      });
      setSelectedSeg(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/60">
        <canvas
          ref={canvasRef}
          width={420}
          height={160}
          className="block w-full h-auto rounded-2xl cursor-crosshair"
          onClick={handleCanvasClick}
        />
      </div>

      <div className="grid grid-cols-9 gap-1.5 px-1">
        {PALETTE_COLORS.map((col) => (
          <button
            key={col.hex}
            type="button"
            onClick={() => setSelectedColor(col.hex)}
            className={`aspect-square rounded-full border-2 transition-all cursor-pointer ${
              selectedColor === col.hex
                ? 'border-white scale-110 shadow-lg'
                : 'border-transparent hover:border-slate-500 hover:scale-105'
            }`}
            style={{ backgroundColor: col.hex }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={selectedSeg === null}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-bold transition cursor-pointer hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-950/20 border border-rose-800/20 text-rose-400 text-xs font-bold transition cursor-pointer hover:bg-rose-950/30"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
      </div>

      {/* Shape / Taper / Glow — compact row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Shape mini-selector */}
        <div className="flex items-center gap-1 bg-slate-950 rounded-lg border border-slate-800/60 p-1">
          {(['smooth', 'dragon', 'armored', 'crystal', 'obsidian', 'basilisk'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                shape === s ? 'bg-purple-600/30 text-purple-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.slice(0, 4)}
            </button>
          ))}
        </div>

        {/* Taper mini-selector */}
        <div className="flex items-center gap-1 bg-slate-950 rounded-lg border border-slate-800/60 p-1">
          {(['natural', 'uniform', 'wave', 'heavy'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTaper(t)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                taper === t ? 'bg-purple-600/30 text-purple-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.slice(0, 4)}
            </button>
          ))}
        </div>

        
        <button
          type="button"
          onClick={() => setGlow(!glow)}
          className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold border transition cursor-pointer ${
            glow
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          {glow ? 'GLOW ON' : 'GLOW OFF'}
        </button>
      </div>
    </div>
  );
}
